import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// Plain HTTP fetch + cheerio parse — no JS execution, so this cannot get
// past a client-side bot-detection/device-check page (e.g. Carfax's report
// viewer). That's a hard, intentional limit, not a bug: using a headless
// browser here to get past that check would be a bot-detection bypass,
// which isn't something this project does regardless of where the code
// runs. Callers should treat a page that doesn't look like real content
// (e.g. a "verifying" placeholder) as unfetchable and fall back to asking
// the user for it directly.
export async function fetchHtml(url, signal) {
  const res = await fetch(url, {
    signal,
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
  });
  if (!res.ok) {
    throw new Error(`Fetch failed (${res.status}) for ${url}`);
  }
  const html = await res.text();
  return { html, $: cheerio.load(html), finalUrl: res.url || url };
}

// Anchor text/href heuristics for a vehicle-history-report link on a listing
// page — same heuristic carfax-analyzer's Step 1 documents, now as real
// selectors instead of prose.
export function findHistoryReportLink($, baseUrl) {
  const candidates = [];
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text() || '';
    const isReportDomain = /carfax\.com|autocheck\.com/i.test(href);
    const isReportText = /carfax|vehicle history|view.*history/i.test(text);
    if (isReportDomain || isReportText) {
      try {
        candidates.push(new URL(href, baseUrl).toString());
      } catch {
        // ignore unparseable hrefs
      }
    }
  });
  return candidates[0] || null;
}

// Collects <img> src/srcset URLs, resolved against baseUrl, de-duplicated,
// filtering out obvious non-photo assets (tiny icons, tracking pixels,
// data: URIs) by a light heuristic on the filename.
export function findImageUrls($, baseUrl, { limit } = {}) {
  const skip = /icon|logo|sprite|pixel|blank|spacer/i;
  const seen = new Set();
  const urls = [];

  $('img').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (!src || src.startsWith('data:')) return;
    if (skip.test(src)) return;
    try {
      const resolved = new URL(src, baseUrl).toString();
      if (!seen.has(resolved)) {
        seen.add(resolved);
        urls.push(resolved);
      }
    } catch {
      // ignore unparseable src
    }
  });

  return typeof limit === 'number' ? urls.slice(0, limit) : urls;
}

export async function downloadImage(url, destPath, signal) {
  const res = await fetch(url, { signal, headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Image download failed (${res.status}) for ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(destPath), { recursive: true });
  await fs.writeFile(destPath, buffer);
}

// Picks a file extension from a URL's path, defaulting to .jpg when the URL
// doesn't make it obvious (e.g. a query-string-only image endpoint).
export function extensionFor(url) {
  const match = new URL(url).pathname.match(/\.(jpg|jpeg|png|webp|gif)$/i);
  return match ? match[0].toLowerCase() : '.jpg';
}
