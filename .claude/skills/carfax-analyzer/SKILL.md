---
name: carfax-analyzer
description: Analyze a Carfax (or similar) vehicle history report in depth, given a URL or a PDF file. Use when the user provides a Carfax link/PDF and wants it read, summarized, or assessed for red flags before buying or evaluating a used vehicle.
triggerOn: "carfax analyser|analyze this carfax report|find and analyze the carfax|carfax report analysis|carfax report red flags|carfax report summary|carfax report review"
runInSubagent: false
---

# CarFax Analyzer

Perform the depth of analysis an experienced used-car appraiser or dealer inspector applies to a vehicle history report — not just a re-statement of the report's own summary badges.

## Step 1: Get the report content

- **Local PDF path**: read it directly with the Read tool.
- **URL to a PDF**: download to the scratchpad directory (e.g. `curl -sL -o report.pdf <url>`), then Read it.
- **URL to a web report page** (e.g. a Carfax "view report" link): try WebFetch first. If the page is JS-rendered or blocked, fall back to the claude-in-chrome browser tools to navigate to it and read the rendered page/text.
- **URL to a page that is not the report itself** (e.g. a dealer listing, classifieds ad, or auction page): fetch the page and look for a link to a Carfax (or other vehicle-history-provider, e.g. AutoCheck) report — anchor text such as "Carfax," "View free Carfax report," "Vehicle History Report," or an href on a provider domain (e.g. `carfax.com`). If found, follow it and handle it per the rules above. If no such link is present, say so plainly and ask the user for the report URL or PDF instead of guessing.
- If the report is access-gated (login wall, expired token) and cannot be retrieved, say so plainly and ask the user for the PDF instead of guessing at contents.

## Step 2: Extract the structured facts

Pull out every instance of each of these, not just presence/absence — dates, mileage, and location matter for the interpretation in Step 6:

1. **Vehicle identifiers**: VIN, year/make/model/trim, engine.
2. **Title brand history**: every brand ever applied (salvage, junk, rebuilt/reconstructed, flood, fire, hail, lemon/manufacturer buyback, not-actual-mileage, exceeds-mechanical-limits), which state issued it, and the date. See `references/title_brands.md` for definitions.
3. **Odometer readings**: every recorded reading with its date and source (sale, service, inspection, registration, emissions test), in chronological order.
4. **Accident / damage records**: date, reported severity, airbag deployment, point of impact, "structural" vs "cosmetic" damage language, insurance-reported vs. police-reported.
5. **Ownership history**: number of owners, type of each owner (personal, lease, fleet, rental, government), state(s) of registration per owner, length of each ownership period, estimated annual mileage per owner.
6. **Service / inspection / emissions records**: dates, mileage, and what was serviced; note gaps.
7. **Open recalls**: any manufacturer recall listed as not yet completed.
8. **Usage flags**: rental, fleet, taxi/rideshare, lease, police, government use.
9. **Any Carfax-generated alerts**: e.g. "potential odometer rollback," "problem detected," "buyback guarantee eligible."

## Step 3: Check for existing type-level research

Once make/model/year is known from Step 2, check whether `vehicles/<make>/<model>/<year>/overview.md` already exists (see `../../../references/research-storage.md`).

- If it exists, nothing to do — continue to Step 4.
- If it doesn't exist **and this is a direct, standalone request** to analyze this vehicle (not this skill being invoked as part of `dealership-analyzer`'s Step 7 spot-check batch), ask the user whether they want the `vehicle-research` skill run first for this make/model/year before continuing. If yes, run it, then continue. If no, continue with just the VIN-specific analysis and note in Step 7's "What this report can't tell you" that no type-level research (reliability history, recall patterns, typical pricing) exists yet for this make/model/year.
- If this is part of a spot-check batch, or the invocation already states a decision up front (e.g. a request built from a form), skip asking and use whatever's already decided — same rule as `dealership-analyzer`'s Step 7.

## Step 4: Independently verify recalls via NHTSA

If a VIN was extracted in Step 2, do not rely solely on the report's own recall section — cross-check it against NHTSA directly, since the report's recall feed can lag or miss items:

- Navigate to `https://www.nhtsa.gov/recalls`, enter the 17-character VIN in the recall look-up field, and submit. The tool requires the VIN typed/pasted exactly (watch for O/0 and I/1 mix-ups).
- The page is JS-driven — use the claude-in-chrome browser tools (navigate, find the VIN input, type, submit, then read the rendered results) rather than WebFetch, which will not see the results of a client-side search.
- Record every open recall returned: component, recall date, and NHTSA campaign number.
- Compare against the report's own recall data from Step 2. If NHTSA shows an open recall the report doesn't (or vice versa), note the discrepancy explicitly — don't silently prefer one source.
- If no VIN could be extracted from the report, skip this step and say so in the output rather than guessing at recall status.

## Step 6: Apply the expert red-flag checklist

Work through `references/red_flags_checklist.md` and flag every match found in Step 2's extracted data, not just the ones the report itself highlights — reports do not always self-flag every inconsistency (e.g. a mileage drop between two service visits that Carfax didn't badge). Cross-check the odometer timeline yourself for any reading lower than a prior reading, and cross-check the accident timeline against the ownership timeline (an accident reported after a sale to a new owner but before that owner registered it, etc.).

Note explicitly what the report **cannot** tell you: it only contains events reported to Carfax by state DMVs, insurers, auctions, service shops, and law enforcement — un-reported accidents, cash-repaired damage, and shops that don't share data (many independent shops) will not appear. Say this in the output; do not imply a clean report means an undamaged car.

## Step 6.5: Assess the asking price

This is about *this specific listing's* price, not general market pricing for the type (that's `vehicle-research`'s Step 6, if an `overview.md` exists for this make/model/year — read it and cite its "Typical pricing" section rather than re-deriving it from scratch when it's already there).

- Search current comparable listings — same or adjacent year/make/model/trim, similar mileage, same general region when the seller's location is known — via the marketplaces in `../../../references/car-sites.md` (Cars.com, CarGurus, Autotrader, KBB listings). A handful of real comparables beats an exhaustive search.
- Check KBB and/or Edmunds for a typical private-party/dealer-retail price range for this specific year/make/model/trim/mileage/condition, distinct from original MSRP.
- **Weigh this vehicle's own history against the price**: a below-market price on a car with real red flags (branded title, accident history, short-flip ownership) isn't a deal, it's the market pricing in the risk — say so explicitly rather than treating a low price as purely a positive.
- **State what THIS car should actually cost, not just the range for a clean example** — the Market range (a typical example of this make/model/year) is not an answer to "is this price fair," since it doesn't account for anything this specific VIN's history found. Apply a concrete adjustment: branded title (salvage/rebuilt/flood/fire) commonly discounts 20-40%+ off clean-market value depending on severity/documentation gaps; meaningful accident history, short-flip ownership, or unresolved service gaps each pull it down further. Give an actual number or range for this vehicle, not just a qualitative "should be discounted."
- If the seller's asking price isn't available (report supplied standalone with no listing), skip this step and say so rather than guessing at a price.
- This is prominent, not buried information — Step 8 records it as its own header fields (`Asking price`, `Market range`, `Fair price for this vehicle`), visible immediately at the top of the file, not left as something a reader only finds by reading all the way down to the Market comparison section.

## Step 7: Produce the analysis

Give the user a structured report with these sections:

1. **Bottom line** — one paragraph, leading with **Rating: N/5** per `research-storage.md`'s rating rubric, then buy-worthy / proceed with inspection / walk away, and the single biggest reason why.
2. **Title & brand issues** — flagged or none.
3. **Accident & damage history** — chronological, with severity assessment.
4. **Odometer integrity** — chronological readings; flag any rollback, gap, or implausible annual mileage.
5. **Ownership & usage pattern** — number/type of owners, fleet/rental/lease flags, ownership durations (short flips are a flag).
6. **Service & maintenance** — regularity, gaps, major repairs shortly before a sale (flag: repaired-to-sell pattern).
7. **Open recalls** — list any from the report *and* from the Step 4 NHTSA lookup, flag any discrepancy between the two, and note they should be completed free at a dealer regardless of purchase decision.
8. **What this report can't tell you** — the blind spots from Step 6, whether type-level research exists yet for this make/model/year (Step 3), and the concrete next step (independent pre-purchase mechanical inspection, VIN check against the physical dash/door-jamb, title check with the state DMV) appropriate to what was found.
9. **Market comparison & pricing** — from Step 6.5: the comparable listings found, the KBB/Edmunds typical range, whether the asking price sits above/below/within that range, and a concrete fair-price figure/range for *this specific vehicle* once its own history is priced in — not just the generic range, which doesn't by itself answer whether this asking price is fair.
10. **In-person checklist** — a bullet list, grouped under three subheadings, tailored to what this specific report actually found (not a generic boilerplate checklist reused across every vehicle):
   - **Look for in person**: physical signs tied to this report's own findings (e.g. mismatched paint/panel gaps if any accident was reported, rust/water lines if flood history is even suspected, tire wear patterns, uneven trim if a rebuild is in the history).
   - **On a test drive**: behaviors specifically worth confirming given this report (e.g. pulling/vibration if front-end damage was reported, transmission behavior if service records show none, warning lights, unusual noises from whatever was flagged in Service & maintenance).
   - **Ask the dealership**: direct questions this specific report raises but can't answer (e.g. who performed a rebuild and to what standard, why an ownership period was unusually short, whether an open recall will be completed before sale).

Cite the specific dates/mileages/events from the report for every flag raised — don't assert a red flag without pointing to the data line that supports it.

## Step 8: Persist the research

Write/update `vehicles/<make>/<model>/<year>/<VIN>/analysis.md` per `../../../references/research-storage.md` (paths relative to the project root) with this analysis, including the `Rating: N/5` header field from Step 7 and the `Asking price`/`Market range`/`Fair price for this vehicle` header fields from Step 6.5 (omit both together if Step 6.5 was skipped). Capture the seller as whatever listing page led to the report — the dealer name/URL from Step 1's page-with-a-link case, or "not provided" if the user supplied the report/PDF standalone with no listing context. If `dealerships/<domain>/analysis.md` already exists for that seller, link to it from the vehicle file's header. Also record the `History report` field with the report's own URL — Step 1's "URL to a web report page" or "URL to a page that is not the report itself" cases (the resolved report link, not the original listing/dealer page it was found on). Omit the field if the report was supplied as a local PDF path or standalone text with no URL.

Also download every photo found on the seller's listing page (Step 1's page-with-a-link case, or the report page itself if it shows the vehicle) to `vehicles/<make>/<model>/<year>/<VIN>/photos/`, per `research-storage.md`'s photo mechanism — identify image URLs via WebFetch's page analysis or the claude-in-chrome tools, then `curl -sL -o photos/NN.<ext>` each one. Skip this if the report was supplied standalone with no listing/photos available.

If the report itself came from a user-supplied file (Step 1's local-PDF case) rather than a URL, save a copy of it to `vehicles/<make>/<model>/<year>/<VIN>/report.<ext>` per `research-storage.md`'s "Source reports" convention — don't just read it and discard it.

This persistence step happens on every run, not only when invoked from another skill.
