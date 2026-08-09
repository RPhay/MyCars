import { Router } from 'express';
import { startWorkflow, answerQuestion, cancelWorkflow, getWorkflowRun } from '../services/workflows/workflowRunner.js';
import { vehicleWorkflow } from '../services/workflows/vehicleWorkflow.js';
import { startRun, getRun, cancelRun } from '../services/skillRunner.js';

const router = Router();

// Two producers feed the same modal: hard-coded workflows (workflowRunner —
// structured phase/question events) and the still-CLI-based skills
// (skillRunner — raw claude stdout/stderr). Both get normalized to the same
// SSE vocabulary here so the frontend doesn't need to know which one it's
// looking at: `phase` (structured status), `output` (raw text passthrough),
// `question` (workflow-only), `done`, `error`, `cancelled`.

router.post('/runs/vehicle', (req, res) => {
  const input = (req.body.input || '').trim();
  if (!input) return res.status(400).json({ error: 'Enter a VIN or a URL.' });
  const id = startWorkflow(vehicleWorkflow, { input });
  res.json({ id, kind: 'workflow' });
});

router.post('/runs/skill', (req, res) => {
  const { skill, make, model, year, trim, url, spotCheck, sampleSize } = req.body;
  let prompt;
  if (skill === 'vehicle-research') {
    if (!make || !model || !/^\d{4}$/.test(year || '')) {
      return res.status(400).json({ error: 'make, model, and a 4-digit year are required.' });
    }
    prompt = `Use the vehicle-research skill to research this vehicle type: ${year} ${make} ${model}${trim ? `, trim: ${trim}` : ''}.`;
  } else if (skill === 'dealership-analyzer') {
    if (!url) return res.status(400).json({ error: 'A dealership URL is required.' });
    const spotCheckInstruction =
      spotCheck === true || spotCheck === 'true'
        ? `Carfax spot-check: yes, sample ${Math.max(1, Math.min(10, parseInt(sampleSize, 10) || 3))} inventory vehicles. This has already been decided — do not ask about it.`
        : 'Carfax spot-check: skip it. This has already been decided — do not ask about it.';
    prompt = `Use the dealership-analyzer skill to analyze this dealership: ${url}\n\n${spotCheckInstruction}`;
  } else {
    return res.status(400).json({ error: 'Unknown skill.' });
  }
  const id = startRun(prompt);
  res.json({ id, kind: 'skill' });
});

router.get('/runs/:id/events', (req, res) => {
  const { id } = req.params;
  const workflowRecord = getWorkflowRun(id);
  const skillRecord = workflowRecord ? null : getRun(id);

  if (!workflowRecord && !skillRecord) {
    return res.status(404).end();
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  if (workflowRecord) {
    for (const { event, data } of workflowRecord.buffer) send(event, data);
    if (workflowRecord.done) return res.end();

    const onEvent = ({ event, data }) => send(event, data);
    workflowRecord.emitter.on('event', onEvent);
    req.on('close', () => workflowRecord.emitter.off('event', onEvent));
    return;
  }

  // skillRunner record: translate its chunk/done shape into the shared vocabulary.
  for (const chunk of skillRecord.buffer) send('output', chunk);
  if (skillRecord.done) {
    send('done', { exitCode: skillRecord.exitCode, error: skillRecord.error });
    return res.end();
  }

  const onChunk = (chunk) => send('output', chunk);
  const onDone = (info) => {
    send('done', info);
    res.end();
  };
  skillRecord.emitter.on('chunk', onChunk);
  skillRecord.emitter.on('done', onDone);
  req.on('close', () => {
    skillRecord.emitter.off('chunk', onChunk);
    skillRecord.emitter.off('done', onDone);
  });
});

router.post('/runs/:id/answer', (req, res) => {
  const ok = answerQuestion(req.params.id, req.body.answer);
  res.json({ ok });
});

router.post('/runs/:id/cancel', (req, res) => {
  const ok = cancelWorkflow(req.params.id) || cancelRun(req.params.id);
  res.json({ ok });
});

export default router;
