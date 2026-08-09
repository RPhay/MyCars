import { spawn } from 'child_process';
import { randomUUID } from 'crypto';
import { EventEmitter } from 'events';
import config from '../config/environment.js';

// In-memory only — single local user, no need to persist run status itself
// (the skill's own output persists to dealerships/vehicles as usual).
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
  const record = { emitter, buffer: [], done: false, exitCode: null, error: null };
  runs.set(id, record);

  const child = spawn('claude', buildArgs(prompt), {
    cwd: config.projectRoot,
    env: process.env,
  });

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

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i; // VINs exclude I, O, Q

export function looksLikeVin(value) {
  return VIN_PATTERN.test(value.trim());
}

// NHTSA's public VIN decoder — no auth, no permission prompt (this is a
// direct server-side fetch, not a Claude tool call). Verified response shape
// by hand before building this: Series is closer to this project's "model"
// convention (e.g. "2-Series") than NHTSA's own Model field, which is often
// closer to a trim (e.g. "M235i") — see vehicle-research/SKILL.md Step 1 for
// why getting this mapping wrong causes duplicate folders for the same car.
export async function decodeVin(vin) {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`NHTSA decode request failed (${res.status})`);
  const data = await res.json();
  const result = data.Results && data.Results[0];
  if (!result || !result.Make || !result.ModelYear) {
    throw new Error('NHTSA could not decode that VIN.');
  }

  const model = result.Series && result.Series.trim() ? result.Series.trim() : result.Model || '';
  const trimParts = [result.Model, result.Trim].filter((v) => v && v.trim() && v.trim() !== model);
  const trim = [...new Set(trimParts.map((v) => v.trim()))].join(' ');

  return {
    year: result.ModelYear,
    make: result.Make,
    model,
    trim,
  };
}

const VEHICLE_INFO_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    year: { type: 'string' },
    make: { type: 'string' },
    model: { type: 'string' },
    trim: { type: 'string' },
  },
  required: ['year', 'make', 'model'],
});

// Blocking (not streamed) extraction call, for the vehicle-research form's
// "prefill from URL" button — fetches the page and asks for structured
// year/make/model/trim back. Confirmed envelope shape by running `claude -p
// ... --output-format json --json-schema ...` directly: the top-level object
// has `structured_output` already parsed (no need to re-parse `.result`) and
// `is_error` to check for failure.
export function extractVehicleInfo(url) {
  return new Promise((resolve, reject) => {
    const prompt = `Extract this vehicle's year, make, model, and trim from the page at ${url}. If a field genuinely isn't determinable, omit it rather than guessing.`;
    const child = spawn(
      'claude',
      [
        '-p',
        prompt,
        '--output-format',
        'json',
        '--json-schema',
        VEHICLE_INFO_SCHEMA,
        '--permission-mode',
        'acceptEdits',
      ],
      { cwd: config.projectRoot, env: process.env },
    );

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));

    child.on('error', (err) => reject(err));

    child.on('close', () => {
      let parsed;
      try {
        parsed = JSON.parse(stdout);
      } catch {
        return reject(new Error('Could not parse extraction output: ' + (stderr || stdout).slice(0, 500)));
      }
      if (parsed.is_error || !parsed.structured_output) {
        return reject(new Error(parsed.result || 'Extraction failed'));
      }
      resolve(parsed.structured_output);
    });
  });
}
