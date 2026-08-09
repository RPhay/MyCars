import fs from 'fs/promises';
import path from 'path';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

// Mirrors researchStore.js's header parser (kept independent on purpose —
// this is the write side, that's the read side, and research-storage.md is
// the contract keeping them compatible, not a shared code dependency).
function parseExisting(raw) {
  const lines = raw.split('\n');
  let i = 1; // skip title
  while (i < lines.length && lines[i].trim() === '') i++;
  while (i < lines.length && /^- .+/.test(lines[i])) i++;

  const body = lines.slice(i).join('\n');
  const sections = {};
  const sectionMatches = [...body.matchAll(/^## (.+)\n([\s\S]*?)(?=\n## |$)/gm)];
  for (const m of sectionMatches) {
    sections[m[1].trim()] = m[2].trim();
  }

  const changelogLines = (sections['Changelog'] || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  delete sections['Changelog'];

  return { sections, changelogLines };
}

/**
 * Renders (and returns) a research markdown file matching research-storage.md's
 * shape, updating in place if `existingRaw` is given: body sections replaced
 * with fresh content, a dated Changelog line appended noting which sections
 * changed (or that nothing did), Last updated bumped regardless.
 *
 * @param {object} opts
 * @param {string} opts.title - the "# ..." heading
 * @param {[string, string][]} opts.fields - ordered [label, value] header bullets (value may contain markdown links)
 * @param {[string, string][]} opts.sections - ordered [heading, content] body sections
 * @param {string} [opts.existingRaw] - prior file content, if updating
 */
export function renderResearchFile({ title, fields, sections, existingRaw }) {
  const prior = existingRaw ? parseExisting(existingRaw) : { sections: {}, changelogLines: [] };

  const changed = [];
  for (const [heading, content] of sections) {
    const priorContent = prior.sections[heading];
    if (priorContent === undefined) continue; // new section, not a "change" to an existing one
    if (priorContent.trim() !== content.trim()) changed.push(heading);
  }

  const date = todayIso();
  let changelogEntry;
  if (!existingRaw) {
    changelogEntry = `- ${date}: Initial research.`;
  } else if (changed.length === 0) {
    const priorDate = prior.changelogLines[prior.changelogLines.length - 1]?.match(/^- (\d{4}-\d{2}-\d{2})/)?.[1];
    changelogEntry = `- ${date}: No material changes since ${priorDate || 'last research'}.`;
  } else {
    changelogEntry = `- ${date}: Updated ${changed.join(', ')}.`;
  }

  // "Last updated" is always today's date, regardless of what the caller passed —
  // callers shouldn't need to know today's date themselves.
  const normalizedFields = fields.filter(([label]) => label !== 'Last updated');
  normalizedFields.push(['Last updated', date]);

  const fieldLines = normalizedFields
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .map(([label, value]) => `- ${label}: ${value}`)
    .join('\n');

  const sectionBlocks = sections.map(([heading, content]) => `## ${heading}\n${content.trim()}`).join('\n\n');

  const changelogBlock = ['## Changelog', ...prior.changelogLines, changelogEntry].join('\n');

  return `# ${title}\n\n${fieldLines}\n\n${sectionBlocks}\n\n${changelogBlock}\n`;
}

export async function writeResearchFile(filePath, renderOpts) {
  let existingRaw;
  try {
    existingRaw = await fs.readFile(filePath, 'utf-8');
  } catch {
    existingRaw = undefined;
  }
  const content = renderResearchFile({ ...renderOpts, existingRaw });
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
  return content;
}
