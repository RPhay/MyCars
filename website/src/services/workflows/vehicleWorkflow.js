import fs from 'fs/promises';
import path from 'path';
import config from '../../config/environment.js';
import { fetchHtml, findHistoryReportLink, findImageUrls, downloadImage, extensionFor } from './fetchPage.js';
import { askClaudeJson, decodeVin, looksLikeVin } from './claudeAssist.js';
import { writeResearchFile } from './markdownWriter.js';
import { getVehicleOverview } from '../researchStore.js';

const VEHICLES_DIR = path.join(config.projectRoot, 'vehicles');
const DEALERSHIPS_DIR = path.join(config.projectRoot, 'dealerships');

// Cloudflare/bot-check placeholder pages are short and carry a handful of
// telltale phrases — same wall carfax-analyzer's Step 1 hits in the CLI
// path. Detecting it here just means falling back to asking the user,
// not attempting to defeat it (see fetchPage.js's header comment).
function looksBlocked(html) {
  if (html.length < 2000) return true;
  return /verifying the device|just a moment|checking your browser|access denied/i.test(html);
}

function bareDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

async function fileExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const FACTS_SCHEMA = {
  type: 'object',
  properties: {
    vin: { type: 'string' },
    year: { type: 'string' },
    make: { type: 'string' },
    model: { type: 'string' },
    trim: { type: 'string' },
    titleBrands: {
      type: 'array',
      items: {
        type: 'object',
        properties: { brand: { type: 'string' }, state: { type: 'string' }, date: { type: 'string' } },
      },
    },
    odometerReadings: {
      type: 'array',
      items: {
        type: 'object',
        properties: { date: { type: 'string' }, mileage: { type: 'number' }, source: { type: 'string' } },
      },
    },
    accidents: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          severity: { type: 'string' },
          airbagDeployed: { type: 'boolean' },
          structural: { type: 'boolean' },
        },
      },
    },
    owners: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ownerNumber: { type: 'number' },
          type: { type: 'string' },
          state: { type: 'string' },
          startDate: { type: 'string' },
          endDate: { type: 'string' },
          estimatedAnnualMileage: { type: 'number' },
        },
      },
    },
    serviceRecords: {
      type: 'array',
      items: {
        type: 'object',
        properties: { date: { type: 'string' }, mileage: { type: 'number' }, description: { type: 'string' } },
      },
    },
    openRecalls: { type: 'array', items: { type: 'string' } },
    usageFlags: { type: 'array', items: { type: 'string' } },
    alerts: { type: 'array', items: { type: 'string' } },
  },
  required: ['odometerReadings', 'accidents', 'owners'],
};

// The report's own text/HTML is genuinely too varied across sources to
// regex-parse reliably (that's exactly the "messy extraction" case the
// project's architecture calls for narrow claude-assist on) — everything
// downstream of this (red-flag evaluation, file persistence) is plain
// hard-coded logic over the resulting structured facts.
async function extractFacts(reportText, ctx) {
  ctx.phase('Extracting structured facts from the report');
  const prompt = `Extract every fact from this vehicle history report into the given schema — every title brand, every odometer reading with date/source, every accident, every owner, every service record, open recalls, usage flags, and any report-generated alerts. Don't summarize or omit entries.\n\nReport:\n${reportText.slice(0, 15000)}`;
  return askClaudeJson(prompt, FACTS_SCHEMA, ctx.signal);
}

// Mechanical, hard-coded checks translated from
// .claude/skills/carfax-analyzer/references/red_flags_checklist.md — the
// parts that are genuine comparisons, not free-text judgment calls.
function evaluateRedFlags(facts) {
  const flags = [];

  for (const b of facts.titleBrands || []) {
    const high = /salvage|junk|flood|fire/i.test(b.brand);
    flags.push({
      severity: high ? 'high' : 'medium',
      category: 'Title',
      message: `${b.brand} brand${b.state ? ` (${b.state})` : ''}${b.date ? `, ${b.date}` : ''}.`,
    });
  }

  const readings = [...(facts.odometerReadings || [])]
    .filter((r) => typeof r.mileage === 'number')
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  for (let i = 1; i < readings.length; i++) {
    if (readings[i].mileage < readings[i - 1].mileage) {
      flags.push({
        severity: 'high',
        category: 'Odometer',
        message: `Reading dropped from ${readings[i - 1].mileage} (${readings[i - 1].date}) to ${readings[i].mileage} (${readings[i].date}) — potential rollback.`,
      });
    }
  }

  for (const a of facts.accidents || []) {
    if (a.airbagDeployed) {
      flags.push({ severity: 'high', category: 'Accident', message: `Airbag deployment, ${a.date || 'date unknown'}.` });
    } else if (a.structural) {
      flags.push({ severity: 'high', category: 'Accident', message: `Structural damage, ${a.date || 'date unknown'}.` });
    } else {
      flags.push({ severity: 'medium', category: 'Accident', message: `Accident/damage reported, ${a.date || 'date unknown'}.` });
    }
  }

  for (const o of facts.owners || []) {
    if (o.startDate && o.endDate) {
      const months = monthsBetween(o.startDate, o.endDate);
      if (months !== null && months < 12 && !/fleet/i.test(o.type || '')) {
        flags.push({ severity: 'medium', category: 'Ownership', message: `Owner ${o.ownerNumber ?? ''} held it under a year (${o.startDate} to ${o.endDate}).` });
      }
    }
    if (/fleet|rental|taxi|rideshare/i.test(o.type || '')) {
      flags.push({ severity: 'low', category: 'Ownership', message: `Owner ${o.ownerNumber ?? ''} usage type: ${o.type}.` });
    }
  }

  const services = [...(facts.serviceRecords || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  for (let i = 1; i < services.length; i++) {
    const months = monthsBetween(services[i - 1].date, services[i].date);
    if (months !== null && months > 24) {
      flags.push({ severity: 'low', category: 'Service', message: `${months}-month gap in service records (${services[i - 1].date} to ${services[i].date}).` });
    }
  }

  for (const r of facts.openRecalls || []) {
    flags.push({ severity: 'medium', category: 'Recall', message: r });
  }

  for (const a of facts.alerts || []) {
    flags.push({ severity: 'medium', category: 'Report alert', message: a });
  }

  return flags;
}

function monthsBetween(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  if (isNaN(da) || isNaN(db)) return null;
  return Math.round((db - da) / (1000 * 60 * 60 * 24 * 30));
}

function buildSections(facts, flags, youtubeVideos = []) {
  const bySeverity = (sev) => flags.filter((f) => f.severity === sev);
  const high = bySeverity('high');
  const medium = bySeverity('medium');

  const bottomLine =
    high.length > 0
      ? `${high.length} high-severity flag${high.length > 1 ? 's' : ''} found: ${high.map((f) => f.message).join(' ')} Proceed only with an independent inspection.`
      : medium.length > 0
        ? `No high-severity flags, but ${medium.length} item${medium.length > 1 ? 's' : ''} worth a closer look: ${medium.map((f) => f.message).join(' ')}`
        : 'No red flags found in the extracted report data. Still get an independent pre-purchase inspection — this report only covers what was reported to it.';

  const listOrNone = (items, formatter) => (items.length ? items.map(formatter).join('\n') : 'None reported.');

  const sections = [
    ['Bottom line', bottomLine],
    ['Title & brand issues', listOrNone(facts.titleBrands || [], (b) => `- ${b.brand}${b.state ? ` (${b.state})` : ''}${b.date ? `, ${b.date}` : ''}`)],
    [
      'Accident & damage history',
      listOrNone(facts.accidents || [], (a) => `- ${a.date || 'Date unknown'}: ${a.severity || 'Reported'}${a.airbagDeployed ? ' — airbag deployed' : ''}${a.structural ? ' — structural' : ''}`),
    ],
    [
      'Odometer integrity',
      listOrNone(facts.odometerReadings || [], (r) => `- ${r.date || 'Date unknown'}: ${r.mileage ?? '?'} mi (${r.source || 'source unknown'})`),
    ],
    [
      'Ownership & usage pattern',
      listOrNone(facts.owners || [], (o) => `- Owner ${o.ownerNumber ?? ''}: ${o.type || 'unknown type'}, ${o.state || ''} (${o.startDate || '?'} – ${o.endDate || 'present'})`),
    ],
    [
      'Service & maintenance',
      listOrNone(facts.serviceRecords || [], (s) => `- ${s.date || 'Date unknown'}: ${s.description || 'Service'} (${s.mileage ?? '?'} mi)`),
    ],
    ['Open recalls', listOrNone(facts.openRecalls || [], (r) => `- ${r}`)],
    [
      "What this report can't tell you",
      'Only covers events reported to the source by DMVs, insurers, auctions, and shops that share data — unreported accidents or cash repairs will not appear. Current mechanical condition is not assessed. Get an independent pre-purchase inspection regardless of how clean this report looks.',
    ],
  ];

  // Add YouTube reviews section if available
  if (youtubeVideos.length > 0) {
    const videoEmbeds = youtubeVideos.map(v => `<iframe width="280" height="158" src="https://www.youtube.com/embed/${v.videoId}" title="${v.title}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`).join('\n');
    sections.push(['Top YouTube reviews', videoEmbeds]);
  }

  return sections;
}

export async function vehicleWorkflow(ctx, { input }) {
  ctx.phase('Resolving vehicle identity', input);

  let reportText = null;
  let reportSourceUrl = null;
  let listingUrl = null;
  let seller = null;
  let pagePhotos = [];

  if (looksLikeVin(input)) {
    const decoded = await decodeVin(input, ctx.signal);
    ctx.phase('Decoded VIN via NHTSA', `${decoded.year} ${decoded.make} ${decoded.model}`);
    const answer = await ctx.question({
      kind: 'text',
      text: `NHTSA identifies this VIN as a ${decoded.year} ${decoded.make} ${decoded.model}. I have no way to pull an actual history report from a bare VIN — paste the report text, or give a report/listing URL, to continue. Leave blank to persist just the basic identity with no history data.`,
      placeholder: 'Paste report text or a URL...',
    });
    if (answer && /^https?:\/\//i.test(answer.trim())) {
      listingUrl = answer.trim();
    } else if (answer && answer.trim()) {
      reportText = answer.trim();
    }
    if (!reportText && !listingUrl) {
      return await persistMinimal(ctx, decoded, input);
    }
  } else {
    listingUrl = input;
  }

  if (listingUrl && !reportText) {
    ctx.phase('Fetching page', listingUrl);
    const { html, $, finalUrl } = await fetchHtml(listingUrl, ctx.signal);
    const domain = bareDomain(finalUrl);
    const isReportDomain = domain && /carfax\.com|autocheck\.com/i.test(domain);

    if (isReportDomain) {
      reportSourceUrl = finalUrl;
      if (looksBlocked(html)) {
        const answer = await ctx.question({
          kind: 'text',
          text: 'This report page is behind a device/bot check a plain fetch can\'t pass. Paste the report text to continue, or leave blank to stop here.',
          placeholder: 'Paste report text...',
        });
        if (answer && answer.trim()) reportText = answer.trim();
      } else {
        reportText = $('body').text();
      }
    } else {
      // A listing page, not the report itself — look for a link to one.
      ctx.phase('Looking for a vehicle history report link');
      const link = findHistoryReportLink($, finalUrl);
      seller = { url: finalUrl, domain };

      if (link) {
        reportSourceUrl = link;
        ctx.phase('Fetching the report', link);
        try {
          const reportPage = await fetchHtml(link, ctx.signal);
          if (looksBlocked(reportPage.html)) throw new Error('blocked');
          reportText = reportPage.$('body').text();
        } catch {
          const answer = await ctx.question({
            kind: 'text',
            text: `Found a report link (${link}) but it's behind a device/bot check a plain fetch can't pass. Paste the report text to continue, or leave blank to persist listing info only.`,
            placeholder: 'Paste report text...',
          });
          if (answer && answer.trim()) reportText = answer.trim();
        }
      } else {
        const answer = await ctx.question({
          kind: 'text',
          text: "No vehicle history report link found on this page. Paste the report text or a report URL, or leave blank to persist listing info only.",
          placeholder: 'Paste report text or a URL...',
        });
        if (answer && /^https?:\/\//i.test(answer.trim())) {
          const reportPage = await fetchHtml(answer.trim(), ctx.signal);
          reportSourceUrl = answer.trim();
          reportText = looksBlocked(reportPage.html) ? null : reportPage.$('body').text();
        } else if (answer && answer.trim()) {
          reportText = answer.trim();
        }
      }
    }

    // Photos come from the listing page itself, not the (often unreachable)
    // report page.
    if (!isReportDomain) {
      ctx.phase('Downloading listing photos');
      pagePhotos = findImageUrls($, finalUrl, { limit: 40 });
    }

    // Also search for manufacturer/review site photos for type-level gallery
    ctx.phase('Searching for exterior and interior photos');
    try {
      const photoSearch = await askClaudeJson(
        `Search for URLs for professional exterior and interior photos of a ${facts.year || 'unknown year'} ${facts.make || 'unknown make'} ${facts.model || 'unknown model'} from manufacturer sites, review sites, or major automotive databases. Return 4-8 exterior URLs and 4-8 interior URLs. Use high-quality, clear images.`,
        {
          type: 'object',
          properties: {
            exterior: { type: 'array', items: { type: 'string' } },
            interior: { type: 'array', items: { type: 'string' } }
          }
        },
        ctx.signal
      );
      // We'll use these after extracting vehicle facts
    } catch {
      // If photo search fails, continue with what we have
    }
  }

  if (!reportText) {
    return await persistListingOnly(ctx, { listingUrl, seller, reportSourceUrl, pagePhotos });
  }

  const facts = await extractFacts(reportText, ctx);
  const flags = evaluateRedFlags(facts);

  // Search for top YouTube reviews
  let youtubeVideos = [];
  try {
    ctx.phase('Searching for top YouTube reviews');
    const videoData = await askClaudeJson(
      `Find the top 2-3 most popular and highest-rated YouTube reviews for a ${facts.year || '2020'} ${facts.make || 'BMW'} ${facts.model || 'Z4'}. Return their YouTube video IDs and titles. Look for professional reviewers like Doug DeMuro, Throttle House, MotorTrend, etc. or highly-watched general reviews.`,
      {
        type: 'object',
        properties: {
          videos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                videoId: { type: 'string' },
                title: { type: 'string' },
                channel: { type: 'string' }
              }
            }
          }
        }
      },
      ctx.signal
    );
    youtubeVideos = videoData.videos || [];
  } catch {
    // If YouTube search fails, continue without videos
  }

  const make = facts.make || 'Unknown';
  const model = facts.model || 'Unknown';
  const year = facts.year || 'Unknown';
  const vin = facts.vin || (looksLikeVin(input) ? input.toUpperCase() : 'UNKNOWN-VIN');

  ctx.phase('Checking for existing type-level research', `${year} ${make} ${model}`);
  let hasOverview = true;
  try {
    await getVehicleOverview(make, model, year);
  } catch {
    hasOverview = false;
  }

  if (!hasOverview) {
    const answer = await ctx.question({
      kind: 'choice',
      text: `${year} ${make} ${model} hasn't been researched as a type yet. Research it first?`,
      options: ['Yes', 'No'],
    });
    if (answer === 'Yes') {
      ctx.phase('Type-level research isn\'t wired up in this workflow yet — continuing with just this vehicle.');
    }
  }

  const vinDir = path.join(VEHICLES_DIR, make, model, year, vin);
  const photosDir = path.join(vinDir, 'photos');

  if (pagePhotos && pagePhotos.length) {
    ctx.phase(`Downloading ${pagePhotos.length} photo(s)`);
    let n = 1;
    for (const url of pagePhotos) {
      try {
        await downloadImage(url, path.join(photosDir, String(n).padStart(2, '0') + extensionFor(url)), ctx.signal);
        n++;
      } catch {
        // skip a photo that fails to download rather than fail the whole run
      }
    }
  }

  const dealershipDomain = seller?.domain;
  const hasDealershipRecord = dealershipDomain ? await fileExists(path.join(DEALERSHIPS_DIR, dealershipDomain, 'analysis.md')) : false;

  ctx.phase('Writing analysis');
  const fields = [
    ['Trim/engine', facts.trim || ''],
    ['Seller', seller ? `${seller.domain || 'Unknown'} (${seller.url})` : 'not provided'],
    hasDealershipRecord ? ['Dealership record', `[${dealershipDomain}](../../../../../dealerships/${dealershipDomain}/analysis.md)`] : null,
    hasOverview ? ['Type overview', '[overview.md](../overview.md)'] : null,
    reportSourceUrl ? ['History report', reportSourceUrl] : null,
  ].filter(Boolean);

  const content = await writeResearchFile(path.join(vinDir, 'analysis.md'), {
    title: `${year} ${make} ${model} — ${vin}`,
    fields,
    sections: buildSections(facts, flags, youtubeVideos),
  });

  ctx.phase('Done');
  return { path: `vehicles/${make}/${model}/${year}/${vin}/analysis.md`, flags, content };
}

async function persistMinimal(ctx, decoded, vin) {
  ctx.phase('Persisting basic identity only — no history report available');
  const vinDir = path.join(VEHICLES_DIR, decoded.make, decoded.model, decoded.year, vin.toUpperCase());
  const content = await writeResearchFile(path.join(vinDir, 'analysis.md'), {
    title: `${decoded.year} ${decoded.make} ${decoded.model} — ${vin.toUpperCase()}`,
    fields: [['Trim/engine', decoded.trim || ''], ['Seller', 'not provided']],
    sections: [
      ['Bottom line', 'No history report was available for this VIN — only NHTSA-decoded basic identity is on file.'],
      ['Title & brand issues', 'Not assessed — no report retrieved.'],
      ['Accident & damage history', 'Not assessed — no report retrieved.'],
      ['Odometer integrity', 'Not assessed — no report retrieved.'],
      ['Ownership & usage pattern', 'Not assessed — no report retrieved.'],
      ['Service & maintenance', 'Not assessed — no report retrieved.'],
      ['Open recalls', 'Not assessed — no report retrieved.'],
      ["What this report can't tell you", 'Everything — no vehicle history report was retrieved for this VIN. This record only reflects NHTSA-decoded specs.'],
    ],
  });
  return { path: `vehicles/${decoded.make}/${decoded.model}/${decoded.year}/${vin.toUpperCase()}/analysis.md`, flags: [], content };
}

async function persistListingOnly(ctx, { listingUrl, seller, reportSourceUrl, pagePhotos }) {
  ctx.phase('No report retrieved — persisting listing info only');
  const info = await askClaudeJson(
    `Extract this vehicle's year, make, model, trim, and VIN from the page at ${listingUrl}. Omit any field you can't determine.`,
    {
      type: 'object',
      properties: { year: { type: 'string' }, make: { type: 'string' }, model: { type: 'string' }, trim: { type: 'string' }, vin: { type: 'string' } },
      required: ['year', 'make', 'model'],
    },
    ctx.signal,
  );
  const vin = info.vin || 'UNKNOWN-VIN';
  const vinDir = path.join(VEHICLES_DIR, info.make, info.model, info.year, vin);

  if (pagePhotos && pagePhotos.length) {
    let n = 1;
    for (const url of pagePhotos) {
      try {
        await downloadImage(url, path.join(vinDir, 'photos', String(n).padStart(2, '0') + extensionFor(url)), ctx.signal);
        n++;
      } catch {
        // skip
      }
    }
  }

  const content = await writeResearchFile(path.join(vinDir, 'analysis.md'), {
    title: `${info.year} ${info.make} ${info.model} — ${vin}`,
    fields: [
      ['Trim/engine', info.trim || ''],
      ['Seller', seller ? `${seller.domain || 'Unknown'} (${seller.url})` : 'not provided'],
    ],
    sections: [
      ['Bottom line', `No vehicle history report was retrieved${reportSourceUrl ? ` (found a link at ${reportSourceUrl} but couldn't fetch it)` : ''} — this record only reflects the listing page.`],
      ['Title & brand issues', 'Not assessed — no report retrieved.'],
      ['Accident & damage history', 'Not assessed — no report retrieved.'],
      ['Odometer integrity', 'Not assessed — no report retrieved.'],
      ['Ownership & usage pattern', 'Not assessed — no report retrieved.'],
      ['Service & maintenance', 'Not assessed — no report retrieved.'],
      ['Open recalls', 'Not assessed — no report retrieved.'],
      ["What this report can't tell you", 'Everything beyond what the listing itself states — no vehicle history report was retrieved.'],
    ],
  });
  return { path: `vehicles/${info.make}/${info.model}/${info.year}/${vin}/analysis.md`, flags: [], content };
}
