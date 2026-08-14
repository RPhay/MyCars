# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

Two independent implementations of the same research logic share one file-based "database" (`dealerships/`, `vehicles/`), per `references/research-storage.md`:

- **The terminal/CLI path**: Claude Code skills in `.claude/skills/` — `carfax-analyzer` (analyzes a Carfax or similar vehicle history report given a URL or PDF), `dealership-analyzer` (analyzes a dealership's business model, inventory, and reputation), `vehicle-research` (researches a make/model/year as a type — manufacturer claims, expert reviews, reliability, safety ratings, typical pricing, recalls), and `vehicle-comparison` (compares all vehicles within a make/year or make/model/year scope, ranks by 8 equally-weighted factors, highlights special categories, flags red flags, shows score breakdowns on hover). These are the design spec as well as a working implementation.
- **The website path** (`website/`): a local Node/Express/EJS/Bootstrap app (mirrors the sibling `MyWork` project's stack, no build step) that does its own research — hard-coded fetch/parse logic by default (see `website/src/services/workflows/`), falling back to narrow, bounded local-`claude`-CLI-assisted calls (`website/src/services/workflows/claudeAssist.js`) only for genuinely messy extraction/judgment a parser can't do reliably. It does not shell out to the interactive skills for its own vehicle research (see `vehicleWorkflow.js`); `dealership-analyzer`/`vehicle-research` are still triggered via the CLI from the website as an interim measure until their hard-coded equivalents are built. No "skills" concept is exposed in the UI — research is triggered via buttons/modal on the relevant page. Run `./website/launch-mac.sh` (or `launch-mac.ps1` under pwsh) to start it at `http://localhost:3100`. `npm run dev` inside `website/` for a bare dev server without the launcher. See `website/package.json` for scripts (`lint`, `format`).
- `references/` — reference material for Claude to load automatically, kept out of this file to keep it short.
- `TODOS.md` — user-maintained backlog for the website; check it before starting new website work.

@references/car-sites.md
@references/general-dealership-review-sites.md
@references/car-review-sites.md
@references/uix-standards.md

## Comprehensive Search Mandate

**CRITICAL: ALL inventory searches MUST be multi-source and exhaustive.**

When researching vehicles for a make/model/year in a geographic area, you MUST search:

1. **Cars.com** — Primary marketplace, check all pages/results
2. **CarGurus** — AI-pricing overlay, may show different inventory
3. **Autotrader** — Large listing volume, different dealer set
4. **KBB** — Dealer listings + pricing, separate inventory
5. **TrueCar** — Price insights, different dealer mix
6. **CarMax** — National inventory with fixed pricing
7. **Facebook Marketplace** — Local private sellers
8. **Craigslist** — Local classifieds (Portland/Seattle metro)
9. **Edmunds** — Used car listings
10. **Local dealer websites** — Direct inventory (BMW, Mitsubishi, etc.)

**For each source:**
- Check EVERY PAGE of results (not just first page)
- Capture VIN, price, mileage, dealer/location, trim
- Note any duplicates (same VIN on multiple sites with different prices)
- Identify dealer patterns (who has multiple listings)

**Stop searching ONLY when:**
- All sources return "no results" for the search criteria
- OR you've verified you've reached the last page on every platform
- AND you've found at least X vehicles (set per project; for Z4 = minimum 5 per year minimum)

**Report EXACTLY:**
- Total vehicles found per source
- Total unique VINs found
- Price range with outliers noted
- Dealer concentration (who has most inventory)

**Never stop early.** User must explicitly tell you "that's enough" or results must be exhausted.

---

## Work Completion Rules

**CRITICAL: Never claim work is complete or done when tasks remain unfinished.**

When the user asks you to "do all vehicles" or "research everything," you must actually complete the comprehensive research for every vehicle before stating completion. This includes:
- Carfax analysis for every VIN
- Photos (8 per vehicle: 4 exterior, 4 interior)
- Dealership research for every seller
- Multi-source inventory searches (see above)
- All related cross-checks and validations

If the user asks multiple times to "do it all," "do everything," "keep going," or similar, this is a clear signal that previous work was incomplete. Do not make excuses about background processes or claim tasks are "running" — finish the actual research, verify results exist in the filesystem, and only then report completion.

If you cannot complete research for a vehicle (blocked API, unavailable listing, etc.), explicitly state which specific vehicles remain incomplete and why, rather than implying full completion.

**Never say "done" when work remains. Ever.**
**Never ask permission or pause. Execute comprehensively and report results.**

---

## Communication Rules

**Never tell the user they're "right" or "wrong."** This is wasted time. Just execute the task and report results. No affirmations, no "yes you're correct," no conversational padding. Focus on work, not conversation.

---

Update this file as real code, commands, and architecture are introduced.
