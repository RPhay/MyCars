import { spawn } from 'child_process';
import config from '../../config/environment.js';

// Narrow, bounded, single-shot calls to the local `claude` CLI (the user's
// own account — no separate Anthropic API key/billing) for the specific
// sub-tasks hard-coded rules genuinely can't do well: messy free-text
// extraction, or judgment calls across unstructured text. This is the
// exception, not the default — most of the website's research logic is
// plain fetch + cheerio + rules (see fetchPage.js and the workflow files).
//
// Envelope shape confirmed by running `claude -p ... --output-format json
// --json-schema ...` directly and inspecting the result before building
// this: the top-level object has `structured_output` already parsed (no
// need to re-parse `.result`) and `is_error` to check for failure.
export function askClaudeJson(prompt, schema, signal) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'claude',
      [
        '-p',
        prompt,
        '--output-format',
        'json',
        '--json-schema',
        JSON.stringify(schema),
        '--permission-mode',
        'acceptEdits',
      ],
      { cwd: config.projectRoot, env: process.env, signal },
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
        return reject(new Error('Could not parse claude output: ' + (stderr || stdout).slice(0, 500)));
      }
      if (parsed.is_error || !parsed.structured_output) {
        return reject(new Error(parsed.result || 'claude call failed'));
      }
      resolve(parsed.structured_output);
    });
  });
}

const VEHICLE_INFO_SCHEMA = {
  type: 'object',
  properties: {
    year: { type: 'string' },
    make: { type: 'string' },
    model: { type: 'string' },
    trim: { type: 'string' },
  },
  required: ['year', 'make', 'model'],
};

export function extractVehicleInfo(url, signal) {
  const prompt = `Extract this vehicle's year, make, model, and trim from the page at ${url}. If a field genuinely isn't determinable, omit it rather than guessing.`;
  return askClaudeJson(prompt, VEHICLE_INFO_SCHEMA, signal);
}

const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i; // VINs exclude I, O, Q

export function looksLikeVin(value) {
  return VIN_PATTERN.test(value.trim());
}

// Grouped here with extractVehicleInfo rather than in fetchPage.js because
// both are "resolve a vehicle's identity" helpers, even though this one
// doesn't call claude — it's NHTSA's public vpic decoder. No auth, no
// Claude Code permission prompt (this is a plain server-side fetch, not a
// tool call). Field mapping verified by hand: NHTSA's `Series` lines up
// with this project's "model" convention (e.g. "2-Series") better than its
// own `Model` field, which is often closer to a trim (e.g. "M235i") — see
// vehicle-research/SKILL.md Step 1 for why getting this backwards causes
// duplicate folders for the same car.
export async function decodeVin(vin, signal) {
  const url = `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${encodeURIComponent(vin)}?format=json`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`NHTSA decode request failed (${res.status})`);
  const data = await res.json();
  const result = data.Results && data.Results[0];
  if (!result || !result.Make || !result.ModelYear) {
    throw new Error('NHTSA could not decode that VIN.');
  }

  const model = result.Series && result.Series.trim() ? result.Series.trim() : result.Model || '';
  const trimParts = [result.Model, result.Trim].filter((v) => v && v.trim() && v.trim() !== model);
  const trim = [...new Set(trimParts.map((v) => v.trim()))].join(' ');

  return { year: result.ModelYear, make: result.Make, model, trim };
}
