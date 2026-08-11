# Research storage convention

Shared persistence rules for any skill that researches a dealership or a vehicle. `dealership-analyzer` and `carfax-analyzer` both follow this; any future research skill should too. Keeps one storage format instead of each skill inventing its own.

## Rating field (every dealership and VIN file)

Every dealership `analysis.md` and every VIN `analysis.md` includes a `Rating: N/5` header field — the skill's own overall assessment, on the same 1-5 scale as the user's personal star rating (`meta.json`, user-set, reflects personal preference, not analysis) so the site can render both on one set of stars: fill = the user's own rating, outline color = this one. Keep the two conceptually distinct even though they share a scale — this field is an analytical judgment, not a stand-in for what the user personally thinks of the car.

Assign it deliberately, anchored to the same severity judgment as the file's own "Bottom line," not a vibe:

- **5**: Clean, no red flags — buy-worthy / trustworthy outright.
- **4**: Minor flags noted, nothing disqualifying — proceed with routine diligence.
- **3**: Real but non-disqualifying concerns, or too little independent data to be confident either way — proceed with real caution/inspection.
- **2**: Multiple or moderate red flags — proceed only with serious verification.
- **1**: Severe, well-documented red flags (for a vehicle: branded title, salvage/rebuilt/flood/fire, total loss, odometer fraud indicators; for a dealership: a documented pattern of fraud allegations, major unresolved legal action) — walk away unless the price already reflects it and you're going in with eyes open.

State the number and a one-clause reason in "Bottom line" itself (e.g. "**Rating: 1/5** — salvage-branded title with two separate total-loss events five weeks apart") rather than leaving it as a bare header field with no visible justification — that text is what the site's rating-hover popup shows.

## Dealership files: `dealerships/<domain>/analysis.md`

`<domain>` is the bare registrable domain of the dealership's site, stripped of protocol and `www.` — e.g. `https://www.freemanmotor.com/...` → `dealerships/freemanmotor.com/analysis.md`. If the dealership has no discoverable website, use a slug of its name + city instead (e.g. `dealerships/joes-auto-sales-portland-or/analysis.md`) and note in the file that no domain was available.

File layout:

```markdown
# <Dealership legal/trade name>

- Address: <full address>
- Site: <url>
- Rating: <N>/5 — see "Rating field" above
- Last updated: <YYYY-MM-DD>
- Vehicles researched here: [<VIN>](../../vehicles/<make>/<model>/<year>/<VIN>/analysis.md), ...

## Bottom line
...

## Business model & inventory
...

## Reputation across review platforms
...

## BBB standing
...

## Legal/news findings
...

## What this analysis can't tell you
...

## Changelog
- 2026-08-08: Initial research.
- 2026-09-15: BBB complaint count 3→7; Google rating 4.6→4.3.
```

## Vehicle storage layout

```
vehicles/<make>/<model>/<year>/
  overview.md                    (type-level research)
  photos/
    01.jpg ... (5-20, manufacturer-sourced)
  <VIN>/
    analysis.md                  (this specific vehicle's research)
    photos/
      01.jpg ... (all photos found on the seller's listing)
```

`<make>` and `<model>` come from the vehicle's specific nameplate as sold, not a generic model-line/series grouping — e.g. a Carfax report titled "2016 BMW 2 Series" with trim "M235i xDrive" gets make `BMW`, model `M235i` (not `2 Series`, which spans multiple distinct nameplates — 220i, 228i, 230i, M235i, M240i, etc. — and doesn't narrow the folder down to one type of car). When a report's own title uses a generic line name like this, don't copy it verbatim — confirm the actual nameplate (the VIN's NHTSA `Model` field, or the trim/engine data itself) before choosing the model folder. Trim/engine (e.g. "xDrive," package names) is recorded as a field inside the file, not as extra path depth. The VIN is what disambiguates one physical car from another sharing the same make/model/year, so it gets its own folder (not a further split by trim) holding both its research and its photos side by side.

### Vehicle files: `vehicles/<make>/<model>/<year>/<VIN>/analysis.md`

File layout:

```markdown
# <year> <make> <model> — <VIN>

- Trim/engine: <trim, engine>
- Seller: <name> (<url>) — or "not provided" if the report was supplied standalone with no listing context
- Dealership record: [<domain>](../../../../../dealerships/<domain>/analysis.md) — omit this line if the seller has no dealership file
- Type overview: [overview.md](../overview.md) — omit this line if no type-level overview exists for this make/model/year
- History report: <url> — the source URL of the Carfax/AutoCheck/similar report actually analyzed for this file; omit this line entirely if no report URL is available (e.g. report text/PDF was supplied standalone with no link, or only listing info was persisted with no report retrieved)
- Asking price: <$N> — this listing's own price; omit if the seller's price isn't available (report supplied standalone with no listing)
- Market range: <e.g. "$41,500-$47,900 KBB private-party, clean title · $55,114 avg current asking (Edmunds)"> — the Step 6.5 comparables/KBB/Edmunds figures for a *typical* example of this make/model/year, condensed to one line; omit alongside Asking price if there's no listing to compare
- Fair price for this vehicle: <$N-$N, or a single figure> with a short clause of why — this vehicle's own condition/history applied against the Market range above (e.g. a branded-title/damage-history discount), not just a repeat of the generic range; this is the header's actual answer to "what should THIS car cost," which the Market range alone doesn't answer. Omit alongside the two fields above if there's no listing to price.
- Rating: <N>/5 — see "Rating field" above
- Last updated: <YYYY-MM-DD>

## Bottom line
...

## Title & brand issues
...

## Accident & damage history
...

## Odometer integrity
...

## Ownership & usage pattern
...

## Service & maintenance
...

## Open recalls
...

## What this report can't tell you
...

## Market comparison & pricing
...

## In-person checklist
...

## Changelog
- 2026-08-08: Initial research.
- 2026-09-01: Mileage updated 38,860 → 39,200; still listed at D&C Motor Company.
```

### Type-level vehicle files: `vehicles/<make>/<model>/<year>/overview.md`

For research on a make/model/year as a *type* — reliability history, common complaints, typical pricing, recall patterns — not tied to one physical car. Sits alongside `photos/` and any `<VIN>/` folders in the same year directory. Use this when there's no specific VIN yet (e.g. researching whether a "2016 BMW M235i" is generally worth pursuing before finding a listing), as distinct from a `<VIN>/analysis.md` file, which is always about one specific unit.

File layout:

```markdown
# <year> <make> <model> — overview

- Last updated: <YYYY-MM-DD>
- Specific vehicles researched: [<VIN>](<VIN>/analysis.md), ...

## Bottom line
...

## What the manufacturer says
... (specs, features, trim lineup, marketing positioning — flagged as manufacturer-sourced/promotional, not independent)

## Expert/editorial review consensus
... (praise, criticism, comparison-test placement; video channels listed as "worth watching yourself" pointers only, never summarized as if transcribed)

## Reliability & owner-reported issues
...

## Safety ratings
... (IIHS and NHTSA for this specific make/model/year, not a generic brand-level reputation; note if the two disagree)

## Typical pricing
...

## Recalls (model/year-wide)
...

## What this can't tell you
... (doesn't assess any specific physical vehicle's condition/history — that's a VIN-level `<VIN>/analysis.md` via carfax-analyzer — and doesn't assess any specific seller; a starting point for deciding whether to go looking for a specific one)

## Sources
...

## Changelog
- 2026-08-08: Initial research.
```

Section order and headings match `vehicle-research`'s Step 8 output structure exactly — keep the two in sync if either changes.

Cross-link both ways: a `<VIN>/analysis.md` file for this make/model/year adds a line to its header — `Type overview: [overview.md](../overview.md)` — if one exists, and `overview.md` lists every `<VIN>/analysis.md` researched under it.

### Photos

- **Type-level** (`vehicles/<make>/<model>/<year>/photos/`): 5-20 photos, ideally from the manufacturer's official page for that model/year (naturally gathered while already there for the manufacturer-claims part of `vehicle-research`'s research). Fewer than 5 is fine if that's genuinely all that's available — don't pad the count.
- **VIN-level** (`vehicles/<make>/<model>/<year>/<VIN>/photos/`): every photo found on the seller's listing for that specific vehicle — no fixed cap, though use judgment if a listing exposes an unreasonable number (e.g. hundreds) rather than downloading all of them.
- **Mechanism**: identify image URLs on the page — via WebFetch's page analysis (ask it to report the image URLs present) or, for JS-rendered galleries, the claude-in-chrome `read_page`/`find` tools — then download each with `curl -sL -o photos/NN.<ext> <image-url>`, the same download-to-disk pattern already used for PDF reports. Preserve the source URL's file extension; number sequentially starting at `01`.

### Source reports

Whenever the user hands over an original report file directly (e.g. a Carfax/AutoCheck PDF saved to their machine, not fetched by a skill from a URL), keep a copy of it, not just its extracted contents — save it as `vehicles/<make>/<model>/<year>/<VIN>/report.<ext>` (preserve the original extension; `report.pdf` for a PDF), alongside `analysis.md` and `photos/`. On re-analysis with a new file for the same VIN, overwrite it in place — same update-in-place rule as everything else here, no versioned copies. If the report was fetched from a URL instead (Carfax/AutoCheck report page, not a user-supplied file), the `History report` field is the record of it; no local copy needed since a URL already has a persistent+shareable citation.

## Update rule (applies to all file types: dealership, VIN, and type-level overview)

1. Read the existing file first, if one exists at that path.
2. Update the body sections in place with the fresh findings — the file always reflects the *current* research, not a stale snapshot.
3. Append one dated line to `## Changelog` summarizing what changed since the last entry. If nothing material changed, still add a line: `<date>: No material changes since <prior date>.` Never fabricate a change that didn't happen, and never skip logging a run.
4. Update the `Last updated` date in the header regardless of whether anything changed.
5. Never create a second dated file for the same entity (no `2026-09-15.md` snapshots) — one file per dealership, one file per VIN, one overview file per make/model/year, always updated in place.
6. Photos aren't versioned/changelogged individually — re-running a skill against the same entity may add newly-found photos but doesn't need to prune or diff the existing ones unless they're clearly stale (e.g. the listing's photos entirely replaced after a relist).

## Directory creation

`dealerships/<key>/`, `vehicles/<make>/<model>/<year>/`, and their `photos/`/`<VIN>/` subfolders are created as needed — they don't need to pre-exist.
