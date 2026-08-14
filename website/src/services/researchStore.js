import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';
import config from '../config/environment.js';

const DEALERSHIPS_DIR = path.join(config.projectRoot, 'dealerships');
const VEHICLES_DIR = path.join(config.projectRoot, 'vehicles');
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

// Site-wide external-link handling (references/uix-standards.md) applied at
// the source, not link-by-link in templates: every link rendered from
// research markdown — explicit [text](url) syntax and bare autolinked URLs
// alike — goes through marked's renderer, so overriding it here covers
// fieldsHtml and bodyHtml everywhere in one place. Internal links (rewritten
// to /dealerships/... or /vehicles/... by rewriteResearchLinks below) stay
// same-tab; anything else gets target="_blank" plus the external-link icon.
// An href that's neither internal nor http(s) (unexpected in practice, since
// research content shouldn't produce one) renders as plain text rather than
// a clickable link, rather than trusting an unknown scheme.
marked.use({
  renderer: {
    link(href, title, text) {
      const titleAttr = title ? ` title="${title}"` : '';
      if (href.startsWith('/')) {
        return `<a href="${href}"${titleAttr}>${text}</a>`;
      }
      if (/^https?:\/\//i.test(href)) {
        return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text} <i class="bi bi-box-arrow-up-right"></i></a>`;
      }
      return text;
    },
  },
});

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
  // Rendered separately from bodyHtml for the rating popover (dealership/
  // vehicle tables) — that's plain inline content (a hover popup), not a
  // full block context, so parseInline rather than the block-level parse.
  const bottomLineHtml = bottomLine ? marked.parseInline(rewriteResearchLinks(bottomLine, context)) : '';

  return {
    title,
    fields,
    fieldsHtml,
    body,
    bodyHtml: marked.parse(rewriteResearchLinks(body, context)),
    bottomLine,
    bottomLineHtml,
  };
}

async function readResearchFile(filePath, context = {}) {
  const raw = await fs.readFile(filePath, 'utf-8');
  return parseResearchFile(raw, context);
}

// Plain rating/status/notes fields only — correspondence (dealership-only,
// see below) is handled separately so this default can't leak a shared
// array reference across calls (spreading META_DEFAULT is a shallow copy).
const META_DEFAULT = { rating: 0, status: 'none', notes: '', spotCheck: false };
const META_STATUSES = new Set(['none', 'favorite', 'avoid']);
const CORRESPONDENCE_METHODS = new Set(['Phone', 'Email', 'In-person', 'Text', 'Other']);

// User-entered rating/favorite/avoid/notes, kept in a sidecar file rather
// than analysis.md's/overview.md's own fields — those are rewritten
// wholesale by dealership-analyzer/vehicle-research on re-run (per
// research-storage.md's update rule), which doesn't know about this data and
// would silently drop it. Shared by dealerships and every level of the
// vehicle tree (make, model, year, VIN) — each just points at a different
// directory. `correspondence` is only ever populated for dealerships, but
// reading/defaulting it here (rather than a dealership-only reader) keeps
// one meta.json shape and one read path for everything under this file.
async function readMeta(dir) {
  try {
    const raw = await fs.readFile(path.join(dir, 'meta.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    const rating = Number(parsed.rating);
    return {
      rating: Number.isInteger(rating) && rating >= 0 && rating <= 5 ? rating : 0,
      status: META_STATUSES.has(parsed.status) ? parsed.status : 'none',
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      spotCheck: typeof parsed.spotCheck === 'boolean' ? parsed.spotCheck : false,
      correspondence: Array.isArray(parsed.correspondence)
        ? parsed.correspondence.filter((c) => c && typeof c.id === 'string')
        : [],
    };
  } catch {
    return { ...META_DEFAULT, correspondence: [] };
  }
}

// Guards against crafted path segments (e.g. "../../etc") escaping baseDir,
// same pattern as resolvePhotoPath below. Merges with the existing meta.json
// rather than requiring the full object every call, so the rating widget and
// the notes form (separate page sections, each unaware of the other's
// current value) can each PUT just their own field without clobbering it.
async function writeMeta(baseDir, segments, patch) {
  const dir = path.resolve(baseDir, ...segments);
  const base = path.resolve(baseDir) + path.sep;
  if (!dir.startsWith(base)) {
    throw new Error('Invalid path');
  }

  const merged = { ...(await readMeta(dir)) };

  if (patch.rating !== undefined) {
    const ratingNum = Number(patch.rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 0 || ratingNum > 5) {
      throw new Error('Invalid rating');
    }
    merged.rating = ratingNum;
  }
  if (patch.status !== undefined) {
    if (!META_STATUSES.has(patch.status)) {
      throw new Error('Invalid status');
    }
    merged.status = patch.status;
  }
  if (patch.notes !== undefined) {
    if (typeof patch.notes !== 'string') {
      throw new Error('Invalid notes');
    }
    merged.notes = patch.notes;
  }
  if (patch.spotCheck !== undefined) {
    if (typeof patch.spotCheck !== 'boolean') {
      throw new Error('Invalid spotCheck');
    }
    merged.spotCheck = patch.spotCheck;
  }

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(merged, null, 2));
  return merged;
}

async function readDealershipMeta(domain) {
  return readMeta(path.join(DEALERSHIPS_DIR, domain));
}

// The "Seller" field is "<name> (<url>)" — plain text, not a markdown link
// (carfax-analyzer records it that way since the seller isn't necessarily a
// researched dealership). Split it for display so tables/rows can show just
// the name (optionally as a real link) instead of the raw URL.
function parseSeller(raw) {
  if (!raw) return { name: '', url: '' };
  const match = raw.match(/^(.*?)\s*\((https?:\/\/[^)]+)\)\s*$/);
  return match ? { name: match[1], url: match[2] } : { name: raw, url: '' };
}

// Extract domain-based ad source from a listing URL
function extractAdSource(url) {
  if (!url) return 'Unknown';
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '').split('.')[0];
    // Capitalize first letter
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return 'Direct Listing';
  }
}

// Parse multi-posting structure from analysis.md body
// Returns array of posting objects extracted from "Posting-Specific Details" section
function parsePostings(body) {
  const postingMatch = body.match(/## Posting-Specific Details\s*\n([\s\S]*?)(\n## |\n?$)/);
  if (!postingMatch) return [];

  const postingText = postingMatch[1];
  // Split by "### Posting N:" headers
  const postingBlocks = postingText.split(/### Posting \d+:/);

  return postingBlocks.slice(1).map((block) => {
    const lines = block.trim().split('\n');
    const posting = {};

    for (const line of lines) {
      const match = line.match(/^- ([^:]+):\s*(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        posting[key] = value;
      }
    }

    return posting;
  }).filter((p) => Object.keys(p).length > 0);
}

// The "Rating: N/5" header field (research-storage.md) is this project's own
// analysis of the vehicle/dealership — same 1-5 scale as meta.json's
// user-set star rating (by design, so the site can render both on one set
// of stars: fill = user's rating, outline color = this one), but a distinct
// value. Parsed out as a number so it's directly usable for display,
// sorting, and the star-outline logic; null when missing (an older file
// researched before this field existed) or malformed, rather than
// defaulting to 0, which would misrepresent "not yet rated" as "rated worst
// possible."
function parseAiRating(raw) {
  if (!raw) return null;
  const match = raw.match(/^([1-5])\s*\/\s*5/);
  return match ? Number(match[1]) : null;
}

// When carfax-analyzer found a matching dealerships/<domain>/analysis.md at
// research time, it records a "Dealership record" field linking to it — that
// field's presence is itself the signal this vehicle's seller is a
// dealership this project has actually researched (as opposed to some other
// site the Seller field points at), so it's what we key off to also surface
// that dealership's own rating alongside the vehicle.
async function resolveDealershipInfo(fields) {
  const record = fields['Dealership record'];
  if (!record) return null;
  const match = record.match(/dealerships\/([^/]+)\/analysis\.md/);
  if (!match) return null;
  const domain = match[1];
  const meta = await readMeta(path.join(DEALERSHIPS_DIR, domain));
  return { domain, meta };
}

// "Vehicles researched here" used to be a static markdown field written once
// at research time — which went stale the moment a listed vehicle was later
// deleted (its link would keep showing on the dealership page pointing at a
// folder that no longer exists). Computed dynamically instead: every VIN
// under vehicles/ whose own "Dealership record" field resolves to this
// domain, via the same listVehicles() walk and resolveDealershipInfo() used
// to show a dealership's rating next to a vehicle elsewhere. Always current,
// and also picks up a vehicle added *after* the dealership was researched,
// which the static field never did either.
// `makes` may be passed in when the caller already has a listVehicles()
// result (e.g. listDealerships() looping over every domain) to avoid
// re-walking the whole vehicles/ tree once per dealership.
async function getDealershipVehicles(domain, makes) {
  if (!makes) makes = await listVehicles();
  const links = [];
  for (const m of makes) {
    for (const model of m.models) {
      for (const year of model.years) {
        for (const v of year.vins) {
          if (v.dealership && v.dealership.domain === domain) {
            links.push({
              label: v.title || `${year.year} ${m.make} ${model.model} (${v.vin})`,
              href: `/vehicles/${encodeURIComponent(m.make)}/${encodeURIComponent(model.model)}/${encodeURIComponent(year.year)}/${encodeURIComponent(v.vin)}`,
            });
          }
        }
      }
    }
  }
  return links;
}

export async function listDealerships() {
  const domains = await listSubdirs(DEALERSHIPS_DIR);
  const makes = await listVehicles();
  const results = [];
  for (const domain of domains) {
    const filePath = path.join(DEALERSHIPS_DIR, domain, 'analysis.md');
    try {
      const parsed = await readResearchFile(filePath);
      const vehicleCount = (await getDealershipVehicles(domain, makes)).length;
      const meta = await readDealershipMeta(domain);
      results.push({ domain, vehicleCount, meta, aiRating: parseAiRating(parsed.fields['Rating']), ...parsed });
    } catch {
      // No analysis.md yet in this subfolder — skip rather than error the whole list.
    }
  }
  return results.sort((a, b) => a.title.localeCompare(b.title));
}

export async function getDealership(domain) {
  const filePath = path.join(DEALERSHIPS_DIR, domain, 'analysis.md');
  const [parsed, meta, vehicleLinks] = await Promise.all([
    readResearchFile(filePath),
    readDealershipMeta(domain),
    getDealershipVehicles(domain),
  ]);
  return { ...parsed, meta, vehicleLinks, aiRating: parseAiRating(parsed.fields['Rating']) };
}

// Guards against a crafted domain segment (e.g. "../../etc") escaping
// DEALERSHIPS_DIR, same pattern as resolvePhotoPath below.
function resolveDealershipDir(domain) {
  const dir = path.resolve(DEALERSHIPS_DIR, domain);
  const base = path.resolve(DEALERSHIPS_DIR) + path.sep;
  if (!dir.startsWith(base)) {
    throw new Error('Invalid dealership path');
  }
  return dir;
}

export async function deleteDealership(domain) {
  await fs.rm(resolveDealershipDir(domain), { recursive: true, force: true });
}

// Adds a dealership to the list without researching it yet — a bare-minimum
// analysis.md (just the name and site, no Bottom line/Rating/anything else)
// so it shows up with blank fields until "Research"/"Re-research" (the same
// dealership-analyzer trigger the detail page already has) fills it in.
// Deliberately reuses the same file format rather than a separate "stub"
// concept — every field the real research fills in already renders fine
// when absent (aiRating null, vehicleCount computed dynamically, etc.), so
// there's no special-cased code path needed to show an unresearched row.
export async function createDealershipStub(name, url) {
  if (!name || !name.trim()) throw new Error('A dealership name is required');
  if (!url || !/^https?:\/\//i.test(url)) throw new Error('A valid dealership URL is required');

  const domain = new URL(url).hostname.replace(/^www\./, '');
  const dir = resolveDealershipDir(domain);
  const filePath = path.join(dir, 'analysis.md');

  const exists = await fs
    .access(filePath)
    .then(() => true)
    .catch(() => false);
  if (exists) throw new Error(`${domain} is already in the list`);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, `# ${name.trim()}\n\n- Site: ${url}\n`);
  return domain;
}

export async function setDealershipMeta(domain, body) {
  return writeMeta(DEALERSHIPS_DIR, [domain], body);
}

function makeCorrespondenceId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function addDealershipCorrespondence(domain, { date, method, who, car, summary }) {
  const dir = resolveDealershipDir(domain);
  if (!date || typeof date !== 'string') throw new Error('Invalid date');
  if (!CORRESPONDENCE_METHODS.has(method)) throw new Error('Invalid method');
  if (!who || typeof who !== 'string') throw new Error('Invalid who');
  if (!summary || typeof summary !== 'string') throw new Error('Invalid summary');

  const meta = await readMeta(dir);
  const entry = { id: makeCorrespondenceId(), date, method, who, car: typeof car === 'string' ? car : '', summary };
  meta.correspondence.push(entry);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
  return entry;
}

export async function deleteDealershipCorrespondence(domain, entryId) {
  const dir = resolveDealershipDir(domain);
  const meta = await readMeta(dir);
  meta.correspondence = meta.correspondence.filter((c) => c.id !== entryId);
  await fs.writeFile(path.join(dir, 'meta.json'), JSON.stringify(meta, null, 2));
}

// Returns a nested structure: [{ make, meta, models: [{ model, meta, years: [{ year, meta, overview, overviewPhotoCount, vins: [...] }] }] }]
// Every level (make/model/year/VIN) carries its own user rating/favorite/
// avoid meta, read from that level's own sidecar meta.json.
export async function listVehicles() {
  const makes = await listSubdirs(VEHICLES_DIR);
  const result = [];

  for (const make of makes) {
    const makeDir = path.join(VEHICLES_DIR, make);
    const makeMeta = await readMeta(makeDir);
    const models = await listSubdirs(makeDir);
    const modelEntries = [];

    for (const model of models) {
      const modelDir = path.join(makeDir, model);
      const modelMeta = await readMeta(modelDir);
      const years = await listSubdirs(modelDir);
      const yearEntries = [];

      for (const year of years) {
        const yearDir = path.join(modelDir, year);
        const yearMeta = await readMeta(yearDir);
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
            const vinMeta = await readMeta(path.join(yearDir, name));
            const seller = parseSeller(parsed.fields['Seller']);
            const dealership = await resolveDealershipInfo(parsed.fields);
            const aiRating = parseAiRating(parsed.fields['Rating']);

            // Parse multi-posting structure
            const postings = parsePostings(parsed.body);

            if (postings.length > 0) {
              // Create one row per posting
              for (const posting of postings) {
                const listingUrl = posting['Listing URL'] || '';
                const adSource = extractAdSource(listingUrl);
                const postingSeller = posting['Seller'] || parsed.fields['Seller'] || '';
                const postingPrice = posting['Asking price'] || parsed.fields['Asking price'] || '';
                const postingCity = posting['City'] || parsed.fields['City'] || '';
                const postingState = posting['State'] || parsed.fields['State'] || '';

                vins.push({
                  vin: name,
                  photoCount,
                  meta: vinMeta,
                  seller,
                  dealership,
                  aiRating,
                  adSource,
                  listingUrl,
                  ...parsed,
                  fields: {
                    ...parsed.fields,
                    'Seller': postingSeller,
                    'Asking price': postingPrice,
                    'City': postingCity,
                    'State': postingState,
                  },
                });
              }
            } else {
              // Fallback for old format (no postings section)
              const listingUrl = parsed.fields['Listing URL'] || '';
              const adSource = extractAdSource(listingUrl);

              vins.push({
                vin: name,
                photoCount,
                meta: vinMeta,
                seller,
                dealership,
                aiRating,
                adSource,
                listingUrl,
                ...parsed,
              });
            }
          } catch {
            // skip a VIN folder with no readable analysis.md
          }
        }

        yearEntries.push({ year, meta: yearMeta, overview, overviewPhotoCount, vins });
      }

      modelEntries.push({ model, meta: modelMeta, years: yearEntries.sort((a, b) => b.year.localeCompare(a.year)) });
    }

    result.push({ make, meta: makeMeta, models: modelEntries.sort((a, b) => a.model.localeCompare(b.model)) });
  }

  return result.sort((a, b) => a.make.localeCompare(b.make));
}

export async function setVehicleMeta(segments, body) {
  return writeMeta(VEHICLES_DIR, segments, body);
}

// Guards against a crafted path segment escaping VEHICLES_DIR, same pattern
// as deleteDealership above. Cascades naturally: removing a make/model/year
// directory takes everything under it (models/years/VINs/photos) with it.
async function removeVehiclePath(...segments) {
  const dir = path.resolve(VEHICLES_DIR, ...segments);
  const base = path.resolve(VEHICLES_DIR) + path.sep;
  if (!dir.startsWith(base)) {
    throw new Error('Invalid vehicle path');
  }
  await fs.rm(dir, { recursive: true, force: true });
}

export async function deleteMake(make) {
  await removeVehiclePath(make);
}

export async function deleteModel(make, model) {
  await removeVehiclePath(make, model);
}

export async function deleteYear(make, model, year) {
  await removeVehiclePath(make, model, year);
}

export async function deleteVehicle(make, model, year, vin) {
  await removeVehiclePath(make, model, year, vin);
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
  const [parsed, meta] = await Promise.all([
    readResearchFile(filePath, { make, model, year }),
    readMeta(path.join(VEHICLES_DIR, make, model, year, vin)),
  ]);
  return { ...parsed, meta, aiRating: parseAiRating(parsed.fields['Rating']) };
}

export async function listTypePhotos(make, model, year, subdir = '') {
  const photoPath = subdir
    ? path.join(VEHICLES_DIR, make, model, year, 'photos', subdir)
    : path.join(VEHICLES_DIR, make, model, year, 'photos');
  return listPhotos(photoPath);
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
