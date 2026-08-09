import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import config from '../config/environment.js';

// In-memory only — single local user, no need to persist run status itself
// (the skill's own output persists to dealerships/vehicles as usual).
//
// This spawns the full interactive `carfax-analyzer`/`dealership-analyzer`/
// `vehicle-research` *skills* via the claude CLI — still the trigger
// mechanism for dealership-analyzer and vehicle-research until their
// hard-coded workflow equivalents (see services/workflows/) are built.
// Vehicle/VIN research itself now runs through workflowRunner.js instead —
// see vehicleWorkflow.js — since that's the one this pass reimplemented.
const runs = new Map();

// `claude -p` runs non-interactively and exits — there's no TTY to answer a
// mid-run permission prompt, so `acceptEdits` is the narrowest mode that
// still lets the skill's Write/Edit persistence step complete unattended.
// WebFetch calls rely on the project's existing settings.local.json
// allowlist; anything needing the claude-in-chrome browser tools has no user
// to hand control to and will fail here — see the trigger-design note in the
// plan this was built from.
function buildArgs(prompt) {
  return ['-p', prompt, '--output-format', 'text', '--permission-mode', 'acceptEdits'];
}

export function startRun(prompt) {
  const id = randomUUID();
  const emitter = new EventEmitter();
  const record = { emitter, buffer: [], done: false, exitCode: null, error: null, child: null };
  runs.set(id, record);

  const child = spawn('claude', buildArgs(prompt), {
    cwd: config.projectRoot,
    env: process.env,
  });
  record.child = child;

  const onData = (source) => (data) => {
    const text = data.toString();
    const chunk = { source, text };
    record.buffer.push(chunk);
    emitter.emit('chunk', chunk);
  };

  child.stdout.on('data', onData('stdout'));
  child.stderr.on('data', onData('stderr'));

  child.on('error', (err) => {
    record.error = err.message;
    record.done = true;
    emitter.emit('done', { exitCode: null, error: err.message });
  });

  child.on('close', (exitCode) => {
    record.done = true;
    record.exitCode = exitCode;
    emitter.emit('done', { exitCode, error: record.error });
  });

  // Runs are only kept around long enough for a browser tab to stream them —
  // trim old finished runs so this doesn't grow unbounded across a long session.
  setTimeout(
    () => {
      if (record.done) runs.delete(id);
    },
    30 * 60 * 1000,
  );

  return id;
}

export function getRun(id) {
  return runs.get(id);
}

export function cancelRun(id) {
  const record = runs.get(id);
  if (!record || record.done) return false;
  record.child?.kill('SIGTERM');
  return true;
}
