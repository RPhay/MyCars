# Research storage convention

Shared persistence rules for any skill that researches a dealership or a vehicle. `dealership-analyzer` and `carfax-analyzer` both follow this; any future research skill should too. Keeps one storage format instead of each skill inventing its own.

## Dealership files: `dealerships/<domain>/analysis.md`

`<domain>` is the bare registrable domain of the dealership's site, stripped of protocol and `www.` — e.g. `https://www.freemanmotor.com/...` → `dealerships/freemanmotor.com/analysis.md`. If the dealership has no discoverable website, use a slug of its name + city instead (e.g. `dealerships/joes-auto-sales-portland-or/analysis.md`) and note in the file that no domain was available.

File layout:

```markdown
# <Dealership legal/trade name>

- Address: <full address>
- Site: <url>
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

`<make>` and `<model>` come from the report's own vehicle-identifier field (e.g. Carfax's "2016 BMW 2 Series" → make `BMW`, model `2 Series`). Trim/engine (e.g. "M235i xDrive") is recorded as a field inside the file, not as extra path depth. The VIN is what disambiguates one physical car from another sharing the same make/model/year, so it gets its own folder (not a further split by trim) holding both its research and its photos side by side.

### Vehicle files: `vehicles/<make>/<model>/<year>/<VIN>/analysis.md`

File layout:

```markdown
# <year> <make> <model> — <VIN>

- Trim/engine: <trim, engine>
- Seller: <name> (<url>) — or "not provided" if the report was supplied standalone with no listing context
- Dealership record: [<domain>](../../../../../dealerships/<domain>/analysis.md) — omit this line if the seller has no dealership file
- Type overview: [overview.md](../overview.md) — omit this line if no type-level overview exists for this make/model/year
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

## Changelog
- 2026-08-08: Initial research.
- 2026-09-01: Mileage updated 38,860 → 39,200; still listed at D&C Motor Company.
```

### Type-level vehicle files: `vehicles/<make>/<model>/<year>/overview.md`

For research on a make/model/year as a *type* — reliability history, common complaints, typical pricing, recall patterns — not tied to one physical car. Sits alongside `photos/` and any `<VIN>/` folders in the same year directory. Use this when there's no specific VIN yet (e.g. researching whether a "2016 BMW 2 Series" is generally worth pursuing before finding a listing), as distinct from a `<VIN>/analysis.md` file, which is always about one specific unit.

File layout:

```markdown
# <year> <make> <model> — overview

- Last updated: <YYYY-MM-DD>
- Specific vehicles researched: [<VIN>](<VIN>/analysis.md), ...

## Bottom line
...

## Known issues / reliability
...

## Typical pricing
...

## Recalls (model/year-wide)
...

## Sources
...

## Changelog
- 2026-08-08: Initial research.
```

Cross-link both ways: a `<VIN>/analysis.md` file for this make/model/year adds a line to its header — `Type overview: [overview.md](../overview.md)` — if one exists, and `overview.md` lists every `<VIN>/analysis.md` researched under it.

### Photos

- **Type-level** (`vehicles/<make>/<model>/<year>/photos/`): 5-20 photos, ideally from the manufacturer's official page for that model/year (naturally gathered while already there for the manufacturer-claims part of `vehicle-research`'s research). Fewer than 5 is fine if that's genuinely all that's available — don't pad the count.
- **VIN-level** (`vehicles/<make>/<model>/<year>/<VIN>/photos/`): every photo found on the seller's listing for that specific vehicle — no fixed cap, though use judgment if a listing exposes an unreasonable number (e.g. hundreds) rather than downloading all of them.
- **Mechanism**: identify image URLs on the page — via WebFetch's page analysis (ask it to report the image URLs present) or, for JS-rendered galleries, the claude-in-chrome `read_page`/`find` tools — then download each with `curl -sL -o photos/NN.<ext> <image-url>`, the same download-to-disk pattern already used for PDF reports. Preserve the source URL's file extension; number sequentially starting at `01`.

## Update rule (applies to all file types: dealership, VIN, and type-level overview)

1. Read the existing file first, if one exists at that path.
2. Update the body sections in place with the fresh findings — the file always reflects the *current* research, not a stale snapshot.
3. Append one dated line to `## Changelog` summarizing what changed since the last entry. If nothing material changed, still add a line: `<date>: No material changes since <prior date>.` Never fabricate a change that didn't happen, and never skip logging a run.
4. Update the `Last updated` date in the header regardless of whether anything changed.
5. Never create a second dated file for the same entity (no `2026-09-15.md` snapshots) — one file per dealership, one file per VIN, one overview file per make/model/year, always updated in place.
6. Photos aren't versioned/changelogged individually — re-running a skill against the same entity may add newly-found photos but doesn't need to prune or diff the existing ones unless they're clearly stale (e.g. the listing's photos entirely replaced after a relist).

## Directory creation

`dealerships/<key>/`, `vehicles/<make>/<model>/<year>/`, and their `photos/`/`<VIN>/` subfolders are created as needed — they don't need to pre-exist.
