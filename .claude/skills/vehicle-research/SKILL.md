---
name: vehicle-research
description: Research a vehicle as a type — make/model/year — covering what the manufacturer claims, expert/editorial review consensus, reliability/owner complaints, safety ratings, typical pricing, and model/year-wide recalls. Accepts make/model/year directly, or a VIN/listing URL as an example vehicle to resolve one from. Use when the user wants to know if a make/model/year is generally worth pursuing, as distinct from carfax-analyzer (one specific vehicle's full history) or dealership-analyzer (one specific seller).
runInSubagent: false
---

# Vehicle Research

Research a make/model/year the way a buyer would before they've even found a specific listing: what the manufacturer says about it, what independent reviewers and owners say, how it's rated for safety, and what it typically costs.

## Step 1: Resolve the vehicle

Take make/model/year (and trim, if given) from the user. If the model name is ambiguous (shared across very different vehicles, or the manufacturer reused a name across generations with very different characteristics), ask which one rather than guessing.

**Alternative input — a VIN or a listing/report URL as an example vehicle to resolve make/model/year from** (this skill still only ever researches the type, not that specific vehicle — the VIN/URL is just a shortcut for identifying which type):

- **Existing project record first**: check whether `vehicles/<make>/<model>/<year>/<VIN>/analysis.md` already exists anywhere in the project for that VIN. If so, its stated make/model/trim is authoritative (it reflects the actual listing, not a guess) — use it and skip the steps below.
- **Bare 17-character VIN, no existing record**: decode it via NHTSA's free VIN decoder API — `https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/<VIN>?format=json`, no auth needed. Map fields carefully, since NHTSA's own field names don't line up with this project's convention: use `ModelYear` for year and `Make` for make as-is, but prefer the `Series` field for `model` when it's non-empty (it's closer to this project's "base model line" convention, e.g. "2-Series") — NHTSA's own `Model` field is often closer to a trim (e.g. "M235i") and should fold into the `trim` field instead, alongside NHTSA's `Trim` field. Getting this mapping wrong causes the same vehicle type to end up split across two different folders (e.g. `BMW/M235i/2016` vs `BMW/2 Series/2016`) depending on which skill resolved it — don't let that happen.
- **URL, no existing record**: fetch it and extract year/make/model/trim/VIN the same way `carfax-analyzer`'s Step 2 does (dealer listing page, Carfax report page, etc.).
- Once resolved to make/model/year, proceed with the rest of this skill exactly as if the user had typed those in directly.

## Step 2: The manufacturer's own page

- WebSearch to find the manufacturer's official site, then the specific model/year page. Fall back to the claude-in-chrome browser tools for JS-rendered pages (real browser only — same rule as the other two skills, never a scripted 403/bot-detection workaround).
- If that model year isn't live on the manufacturer's current site (common for discontinued models — a 2016 model year page rarely survives on a manufacturer's current site), try `web.archive.org` for an archived snapshot of the original page. If neither is available, say so explicitly rather than substituting a different year's page or current MSRP.
- Extract manufacturer-claimed specs, features, trim lineup, and marketing positioning — flag this as manufacturer-sourced/promotional, not independent, the same way `dealership-analyzer` flags a dealer's self-reported claims.
- While here, download 5-20 photos from the manufacturer's page to `vehicles/<make>/<model>/<year>/photos/`, per `research-storage.md`'s photo mechanism (identify image URLs via WebFetch's page analysis or the claude-in-chrome tools, then `curl -sL -o photos/NN.<ext>` each one). Fewer than 5 is fine if that's genuinely all that's available.

## Step 3: Written/editorial review consensus

Read `../../../references/car-review-sites.md` for the site directory (no duplicated list here). Check the written/editorial sites and summarize the consensus view — praise, criticism, and any comparison-test placement (e.g. "3rd of 5 in a comparison test"). List any relevant channels from the same file's video-review table as "worth watching yourself" pointers only — do not fetch or attempt to summarize video content, since these tools can't watch or transcribe it.

## Step 4: Reliability & owner-reported issues

- CarComplaints.com and J.D. Power from `car-review-sites.md` for owner-reported problem patterns and survey-based reliability scores specific to this make/model/year.
- Also check whether this project already has any `vehicles/<make>/<model>/<year>/<VIN>/analysis.md` files — if so, their findings are real local data points, not just external sourcing, and worth citing directly.

## Step 5: Safety ratings

IIHS and NHTSA from `car-review-sites.md`'s safety-ratings table. Pull the specific rating for this make/model/year — not a generic brand-level reputation. Note if IIHS and NHTSA disagree.

## Step 6: Typical pricing

Cross-reference `../../../references/car-sites.md`'s marketplaces (KBB, Edmunds, TrueCar, Cars.com/CarGurus listings) for a realistic current price range for this make/model/year — distinct from the original MSRP pulled in Step 2, which reflects when-new pricing, not today's market.

## Step 7: Open recalls (model/year-wide)

NHTSA recall lookup for this make/model/year in general, using the same JS-driven browser-tool approach as `carfax-analyzer`'s Step 3 (nhtsa.gov/recalls is client-side search, WebFetch won't see results). This is model/year-wide, not VIN-specific — whether a *particular* car had its recalls completed is `carfax-analyzer`'s job, not this skill's.

## Step 8: Produce the analysis

1. **Bottom line** — one paragraph: is this make/model/year generally worth pursuing, and the single biggest reason why.
2. **What the manufacturer says** — from Step 2, flagged as promotional.
3. **Expert/editorial review consensus** — from Step 3, with video channels listed as pointers.
4. **Reliability & owner-reported issues** — from Step 4.
5. **Safety ratings** — from Step 5.
6. **Typical pricing** — from Step 6.
7. **Recalls** — from Step 7.
8. **What this can't tell you** — this doesn't assess any specific physical vehicle's condition or history (that's `carfax-analyzer`), and doesn't assess any specific seller (that's `dealership-analyzer`) — it's a starting point for deciding whether to go looking for a specific one.

Cite the specific source for every claim, the same citation discipline as the other two skills.

## Step 9: Persist

Write/update `vehicles/<make>/<model>/<year>/overview.md` per `../../../references/research-storage.md`, including the "Specific vehicles researched" cross-links to any existing `<VIN>/analysis.md` files for this make/model/year found in Step 4. `photos/` (Step 2) sits alongside it in the same year folder.
