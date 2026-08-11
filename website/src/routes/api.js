import { Router } from 'express';
import { startWorkflow, answerQuestion, cancelWorkflow, getWorkflowRun } from '../services/workflows/workflowRunner.js';
import { vehicleWorkflow } from '../services/workflows/vehicleWorkflow.js';
import { findAllWorkflow } from '../services/workflows/findAllWorkflow.js';
import { startRun, getRun, cancelRun } from '../services/skillRunner.js';
import { friendlyError, friendlyExitError } from '../services/friendlyError.js';

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

router.post('/runs/workflow', (req, res) => {
  const { workflow, make, model } = req.body;
  if (workflow === 'find-all') {
    if (!make || !model) {
      return res.status(400).json({ error: 'make and model are required.' });
    }
    const id = startWorkflow(findAllWorkflow, { make, model });
    res.json({ id, kind: 'workflow' });
  } else {
    res.status(400).json({ error: 'Unknown workflow.' });
  }
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

  // Both producers' raw error text (a fetch status, a claude exit code, ...)
  // gets translated to plain English + a concrete next step here, in this
  // one normalization point, rather than leaking "Fetch failed (403) for
  // https://..." straight into the modal — see friendlyError.js. cliPrompt is
  // a ready-to-paste `claude -p "..."` equivalent for the same task, so a
  // failure (most commonly bot-detection this app's plain fetch can't get
  // past) offers a real next step, not just "try the CLI" with nothing to
  // paste in. For a skill run it's literally the prompt already used to
  // launch it; for the hard-coded vehicle workflow, the nearest CLI
  // equivalent is carfax-analyzer on the same input.
  const cliPrompt = workflowRecord
    ? `Use the carfax-analyzer skill to analyze this vehicle: ${workflowRecord.input?.input || ''}`
    : skillRecord.prompt;

  const send = (event, data) => {
    if (event === 'error') {
      data = { ...data, ...friendlyError(data.error), cliPrompt };
    }
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  if (workflowRecord) {
    for (const { event, data } of workflowRecord.buffer) send(event, data);
    if (workflowRecord.done) return res.end();

    const onEvent = ({ event, data }) => send(event, data);
    workflowRecord.emitter.on('event', onEvent);
    req.on('close', () => workflowRecord.emitter.off('event', onEvent));
    return;
  }

  // skillRunner record: translate its chunk/done shape into the shared
  // vocabulary. A non-zero exit with no explicit spawn error still means the
  // run failed (e.g. the claude CLI hit an unhandled permission prompt or
  // crashed) — surface that as an error rather than letting the modal read
  // "exitCode: 1, error: null" as success.
  const sendSkillDone = (info) => {
    if (info.exitCode !== 0 && !info.error) {
      return send('done', { ...info, ...friendlyExitError(info.exitCode), cliPrompt });
    }
    if (info.error) {
      return send('done', { ...info, ...friendlyError(info.error), cliPrompt });
    }
    send('done', info);
  };

  for (const chunk of skillRecord.buffer) send('output', chunk);
  if (skillRecord.done) {
    sendSkillDone({ exitCode: skillRecord.exitCode, error: skillRecord.error });
    return res.end();
  }

  const onChunk = (chunk) => send('output', chunk);
  const onDone = (info) => {
    sendSkillDone(info);
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
