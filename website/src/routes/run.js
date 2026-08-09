import { Router } from 'express';
import { startRun, getRun, extractVehicleInfo, decodeVin, looksLikeVin } from '../services/skillRunner.js';
import { findVehicleByVin } from '../services/researchStore.js';

const router = Router();

function isHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

router.get('/', (req, res) => {
  res.render('pages/run-forms', { title: 'Run a skill', error: null });
});

router.post('/carfax', (req, res) => {
  const url = (req.body.url || '').trim();
  if (!isHttpUrl(url)) {
    return res.render('pages/run-forms', { title: 'Run a skill', error: 'Enter a valid URL for carfax-analyzer.' });
  }
  const researchTypeFirst = req.body.researchTypeFirst === 'on';
  const typeResearchInstruction = researchTypeFirst
    ? 'If this vehicle\'s make/model/year has not been researched yet, run vehicle-research first. This has already been decided via the web form — do not ask about it.'
    : 'If this vehicle\'s make/model/year has not been researched yet, skip offering to research it first and just proceed. This has already been decided via the web form — do not ask about it.';
  const prompt = `Use the carfax-analyzer skill to analyze this vehicle: ${url}\n\n${typeResearchInstruction}`;
  const id = startRun(prompt);
  res.redirect(`/run/view/${id}`);
});

router.post('/dealership', (req, res) => {
  const url = (req.body.url || '').trim();
  if (!isHttpUrl(url)) {
    return res.render('pages/run-forms', { title: 'Run a skill', error: 'Enter a valid URL for dealership-analyzer.' });
  }
  const spotCheck = req.body.spotCheck === 'on';
  const sampleSize = Math.max(1, Math.min(10, parseInt(req.body.sampleSize, 10) || 3));
  const spotCheckInstruction = spotCheck
    ? `Carfax spot-check: yes, sample ${sampleSize} inventory vehicles. This has already been decided via the web form — do not ask about it, just do it.`
    : `Carfax spot-check: skip it. This has already been decided via the web form — do not ask about it.`;
  const prompt = `Use the dealership-analyzer skill to analyze this dealership: ${url}\n\n${spotCheckInstruction}`;
  const id = startRun(prompt);
  res.redirect(`/run/view/${id}`);
});

router.post('/vehicle-research', (req, res) => {
  const make = (req.body.make || '').trim();
  const model = (req.body.model || '').trim();
  const year = (req.body.year || '').trim();
  const trim = (req.body.trim || '').trim();
  if (!make || !model || !/^\d{4}$/.test(year)) {
    return res.render('pages/run-forms', {
      title: 'Run a skill',
      error: 'Make, model, and a 4-digit year are required for vehicle-research.',
    });
  }
  const trimPart = trim ? `, trim: ${trim}` : '';
  const prompt = `Use the vehicle-research skill to research this vehicle type: ${year} ${make} ${model}${trimPart}.`;
  const id = startRun(prompt);
  res.redirect(`/run/view/${id}`);
});

router.post('/vehicle-research/prefill', async (req, res) => {
  const input = (req.body.input || '').trim();
  if (!input) {
    return res.status(400).json({ error: 'Enter a VIN or a URL.' });
  }

  try {
    if (looksLikeVin(input)) {
      const existing = await findVehicleByVin(input);
      if (existing) return res.json(existing);
      const decoded = await decodeVin(input);
      return res.json(decoded);
    }

    if (isHttpUrl(input)) {
      const info = await extractVehicleInfo(input);
      return res.json(info);
    }

    return res.status(400).json({ error: "That doesn't look like a VIN or a URL." });
  } catch (err) {
    res.status(502).json({ error: err.message || 'Could not resolve vehicle info from that input.' });
  }
});

router.get('/view/:id', (req, res) => {
  const record = getRun(req.params.id);
  if (!record) {
    return res.status(404).render('pages/404', { title: 'Not Found' });
  }
  res.render('pages/run-view', { title: 'Run output', id: req.params.id });
});

// Server-Sent Events stream of a run's output. Replays whatever was already
// buffered before this subscriber connected, then streams live.
router.get('/events/:id', (req, res) => {
  const record = getRun(req.params.id);
  if (!record) {
    res.status(404).end();
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  for (const chunk of record.buffer) {
    send('chunk', chunk);
  }
  if (record.done) {
    send('done', { exitCode: record.exitCode, error: record.error });
    res.end();
    return;
  }

  const onChunk = (chunk) => send('chunk', chunk);
  const onDone = (info) => {
    send('done', info);
    res.end();
  };

  record.emitter.on('chunk', onChunk);
  record.emitter.on('done', onDone);

  req.on('close', () => {
    record.emitter.off('chunk', onChunk);
    record.emitter.off('done', onDone);
  });
});

export default router;
