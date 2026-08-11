// Translates the raw technical error strings this app's research runs throw
// into a short reason + a direct next step, shown in the research modal
// instead of a bare "Fetch failed (403) for https://...". Kept deliberately
// terse (a few words each) — not an explanation of the mechanism, just what
// failed and what to do about it. The original message is never discarded,
// just relegated to a `technical` field the modal shows in the log.
const USE_CLI = 'Run it through the Claude Code CLI instead.';

const RULES = [
  { test: /Fetch failed \(403\)/, reason: 'Site blocked the request (bot detection).', action: USE_CLI },
  { test: /Fetch failed \(401\)/, reason: 'Site requires login.', action: USE_CLI },
  { test: /Fetch failed \(404\)/, reason: 'Page not found.', action: 'Check the URL is correct.' },
  { test: /Fetch failed \(429\)/, reason: 'Rate-limited.', action: 'Wait a bit and try again, or ' + USE_CLI.toLowerCase() },
  { test: /Fetch failed \(5\d\d\)/, reason: "Site's server errored.", action: 'Try again later.' },
  { test: /Fetch failed \((\d+)\)/, reason: 'Request failed.', action: USE_CLI },
  { test: /ENOTFOUND|EAI_AGAIN/, reason: "Domain doesn't resolve.", action: 'Check the URL for typos.' },
  { test: /ECONNREFUSED|ECONNRESET/, reason: 'Connection failed.', action: 'Try again.' },
  { test: /aborted|AbortError|timed? ?out/i, reason: 'Timed out.', action: 'Try again.' },
  { test: /Could not parse claude output/, reason: "Claude CLI didn't return a result.", action: 'Run it in a terminal to see what happened.' },
  { test: /NHTSA could not decode that VIN/, reason: 'VIN not recognized.', action: 'Double-check the VIN.' },
];

export function friendlyError(rawMessage) {
  for (const rule of RULES) {
    if (rule.test.test(rawMessage || '')) {
      return { message: `Failed: ${rule.reason} ${rule.action}`, technical: rawMessage };
    }
  }
  return { message: `Failed. ${USE_CLI}`, technical: rawMessage };
}

export function friendlyExitError(exitCode) {
  return { message: `Failed (exit ${exitCode}). ${USE_CLI}`, technical: `exit code ${exitCode}` };
}
