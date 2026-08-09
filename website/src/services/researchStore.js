import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';
import config from '../config/environment.js';

const DEALERSHIPS_DIR = path.join(config.projectRoot, 'dealerships');
const VEHICLES_DIR = path.join(config.projectRoot, 'vehicles');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

async function dirExists(dir) {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function listSubdirs(dir) {
  if (!(await dirExists(dir))) return [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function listPhotos(dir) {
  if (!(await dirExists(dir))) return [];
  const entries = await fs.readdir(dir);
  return entries.filter((f) => IMAGE_EXTENSIONS.has(path.extname(f).toLowerCase())).sort();
}

// research-storage.md's cross-links are filesystem-relative markdown links
// (e.g. "../../vehicles/BMW/2 Series/2016/VIN/analysis.md", or same-folder-
// relative "../overview.md") meant for browsing the raw files on disk — they
// don't resolve as web routes as-is. Rewrite them to this app's URL scheme
// before rendering. `context` supplies make/model/year for relative links
// found inside a vehicle file, where the target has no path segments to
// derive that from on its own.
function rewriteResearchLinks(text, context = {}) {
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (full, label, target) => {
    const dealershipMatch = target.match(/dealerships\/([^/]+)\/analysis\.md$/);
    if (dealershipMatch) {
      return `[${label}](/dealerships/${encodeURIComponent(dealershipMatch[1])})`;
    }

    const vehicleMatch = target.match(/vehicles\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/analysis\.md$/);
    if (vehicleMatch) {
      const [, make, model, year, vin] = vehicleMatch;
      return `[${label}](/vehicles/${encodeURIComponent(make)}/${encodeURIComponent(model)}/${encodeURIComponent(year)}/${encodeURIComponent(vin)})`;
    }

    if (context.make && context.model && context.year) {
      const { make, model, year } = context;
      const base = `/vehicles/${encodeURIComponent(make)}/${encodeURIComponent(model)}/${encodeURIComponent(year)}`;

      // From a VIN's analysis.md: "../overview.md"
      if (target === '../overview.md' || target === 'overview.md') {
        return `[${label}](${base})`;
      }
      // From overview.md: "<VIN>/analysis.md"
      const vinMatch = target.match(/^([^/]+)\/analysis\.md$/);
      if (vinMatch) {
        return `[${label}](${base}/${encodeURIComponent(vinMatch[1])})`;
      }
    }

    return full;
  });
}

// Parses the fixed header shape produced by research-storage.md:
// "# Title" then a contiguous "- Key: value" bullet list, then the body.
function parseResearchFile(raw, context = {}) {
  const lines = raw.split('\n');
  let i = 0;

  const titleLine = lines[i] || '';
  const title = titleLine.replace(/^#\s*/, '').trim();
  i++;

  while (i < lines.length && lines[i].trim() === '') i++;

  const fields = {};
  const fieldsHtml = {};
  while (i < lines.length && /^- .+/.test(lines[i])) {
    const match = lines[i].match(/^- ([^:]+):\s*(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      fields[key] = value;
      fieldsHtml[key] = marked.parseInline(rewriteResearchLinks(value, context));
    }
    i++;
  }

  const body = lines.slice(i).join('\n').trim();

  const bottomLineMatch = body.match(/## Bottom line\s*\n+([\s\S]*?)(\n## |\n?$)/);
  const bottomLine = bottomLineMatch ? bottomLineMatch[1].trim() : '';

  return {
    title,
    fields,
    fieldsHtml,
    body,
    bodyHtml: marked.parse(rewriteResearchLinks(body, context)),
    bottomLine,
  };
}

async function readResearchFile(filePath, context = {}) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return parseResearchFile(raw, context);
}

export async function listDealerships() {
  const domains = await listSubdirs(DEALERSHIPS_DIR);
  const results = [];
  for (const domain of domains) {
    const filePath = path.join(DEALERSHIPS_DIR, domain, 'analysis.md');
    try {
      const parsed = await readResearchFile(filePath);
      results.push({ domain, ...parsed });
    } catch {
      // No analysis.md yet in this subfolder — skip rather than error the whole list.
    }
  }
  return results.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getDealership(domain) {
  const filePath = path.join(DEALERSHIPS_DIR, domain, 'analysis.md');
  return readResearchFile(filePath);
}

// Returns a nested structure: [{ make, models: [{ model, years: [{ year, overview, overviewPhotoCount, vins: [...] }] }] }]
export async function listVehicles() {
  const makes = await listSubdirs(VEHICLES_DIR);
  const result = [];

  for (const make of makes) {
    const makeDir = path.join(VEHICLES_DIR, make);
    const models = await listSubdirs(makeDir);
    const modelEntries = [];

    for (const model of models) {
      const modelDir = path.join(makeDir, model);
      const years = await listSubdirs(modelDir);
      const yearEntries = [];

      for (const year of years) {
        const yearDir = path.join(modelDir, year);
        const context = { make, model, year };

        let overview = null;
        try {
          overview = await readResearchFile(path.join(yearDir, 'overview.md'), context);
        } catch {
          // no overview.md yet — fine
        }
        const overviewPhotoCount = (await listPhotos(path.join(yearDir, 'photos'))).length;

        // Every subdirectory other than "photos" is a VIN folder.
        const subdirs = await listSubdirs(yearDir);
        const vins = [];
        for (const name of subdirs) {
          if (name === 'photos') continue;
          try {
            const parsed = await readResearchFile(path.join(yearDir, name, 'analysis.md'), context);
            const photoCount = (await listPhotos(path.join(yearDir, name, 'photos'))).length;
            vins.push({ vin: name, photoCount, ...parsed });
          } catch {
            // skip a VIN folder with no readable analysis.md
          }
        }

        yearEntries.push({ year, overview, overviewPhotoCount, vins });
      }

      modelEntries.push({ model, years: yearEntries.sort((a, b) => b.year.localeCompare(a.year)) });
    }

    result.push({ make, models: modelEntries.sort((a, b) => a.model.localeCompare(b.model)) });
  }

  return result.sort((a, b) => a.make.localeCompare(b.make));
}

// Searches the whole vehicles/ tree for a folder matching this VIN
// (case-insensitive) and returns its resolved make/model/year/trim from the
// existing analysis.md, or null if this VIN hasn't been researched yet.
export async function findVehicleByVin(vin) {
  const target = vin.toUpperCase();
  const makes = await listSubdirs(VEHICLES_DIR);
  for (const make of makes) {
    const models = await listSubdirs(path.join(VEHICLES_DIR, make));
    for (const model of models) {
      const years = await listSubdirs(path.join(VEHICLES_DIR, make, model));
      for (const year of years) {
        const vins = await listSubdirs(path.join(VEHICLES_DIR, make, model, year));
        const match = vins.find((v) => v.toUpperCase() === target);
        if (match) {
          try {
            const parsed = await readResearchFile(
              path.join(VEHICLES_DIR, make, model, year, match, 'analysis.md'),
              { make, model, year },
            );
            return { make, model, year, trim: parsed.fields['Trim/engine'] || '' };
          } catch {
            // folder exists but no readable analysis.md — treat as not found
          }
        }
      }
    }
  }
  return null;
}

export async function getVehicleOverview(make, model, year) {
  const filePath = path.join(VEHICLES_DIR, make, model, year, 'overview.md');
  return readResearchFile(filePath, { make, model, year });
}

export async function getVehicle(make, model, year, vin) {
  const filePath = path.join(VEHICLES_DIR, make, model, year, vin, 'analysis.md');
  return readResearchFile(filePath, { make, model, year });
}

export async function listTypePhotos(make, model, year) {
  return listPhotos(path.join(VEHICLES_DIR, make, model, year, 'photos'));
}

export async function listVinPhotos(make, model, year, vin) {
  return listPhotos(path.join(VEHICLES_DIR, make, model, year, vin, 'photos'));
}

// Resolves a photo request to an on-disk path, guaranteed to stay within
// VEHICLES_DIR — callers pass URL-derived segments, so this guards against a
// crafted "../../../etc/passwd"-style file segment escaping the photos dir.
export function resolvePhotoPath(...segments) {
  const resolved = path.resolve(VEHICLES_DIR, ...segments);
  const base = path.resolve(VEHICLES_DIR) + path.sep;
  if (!resolved.startsWith(base)) {
    return null;
  }
  return resolved;
}

export async function getCounts() {
  const [dealerships, vehicles] = await Promise.all([listDealerships(), listVehicles()]);
  let vinCount = 0;
  let overviewCount = 0;
  for (const make of vehicles) {
    for (const model of make.models) {
      for (const year of model.years) {
        vinCount += year.vins.length;
        if (year.overview) overviewCount++;
      }
    }
  }
  return { dealershipCount: dealerships.length, vinCount, overviewCount };
}
