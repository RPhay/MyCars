# To Be Continued

Working notes for picking up where a session left off. Update this after each TODOS.md item, per standing instruction.

## Session state as of 2026-08-09

### Just completed: website rearchitecture foundation slice (TODOS.md #1 and #5)

Full plan is/was at `~/.claude/plans/compressed-sprouting-pizza.md` (session-local, not in this repo). Summary of what shipped:

- **Hard-coded backend** (`website/src/services/workflows/`): `workflowRunner.js` (generic phase/question engine over SSE), `fetchPage.js` (fetch + cheerio scraping helpers), `claudeAssist.js` (narrow, bounded local-`claude`-CLI-assisted calls for genuinely messy extraction — `askClaudeJson`, `extractVehicleInfo`, `decodeVin`, `looksLikeVin`), `markdownWriter.js` (research-storage.md-format writer with update-in-place + Changelog).
- **First real workflow**: `vehicleWorkflow.js` — hard-coded reimplementation of `carfax-analyzer`'s logic (resolve VIN/URL → find/fetch report → extract structured facts via narrow claude-assist → hard-coded red-flag rules → check type-level research exists, real interactive question if not → download photos → persist).
- **API**: `website/src/routes/api.js` — `POST /api/runs/vehicle`, `POST /api/runs/skill` (still-CLI-based dealership-analyzer/vehicle-research), `GET /api/runs/:id/events` (SSE, normalizes both producer types), `POST /api/runs/:id/answer`, `POST /api/runs/:id/cancel`.
- **Modal UI**: `research-modal.ejs`/`research-modal.js`/CSS in `main.css` — car-themed animated status indicator, phase log, real question UI (choice buttons or text input), cancel-only exit. Wired into dashboard, dealership list/detail, vehicle list/year/detail pages via `data-research="..."` attributes (no inline onclick — CSP blocks `script-src-attr`).
- **Removed**: `/run` page and its 3 dedicated skill-trigger forms (per TODOS #1: no "skills" concept exposed in the UI).
- **Verified end-to-end for real** (not just assumed): triggered `vehicleWorkflow` via the API against the real BMW M235i VIN — NHTSA decode worked, bot-check wall on the Carfax report page was correctly detected and asked-around (not bypassed), real report text (from earlier in this session) was submitted as an answer, structured-fact extraction worked, the "research this type first?" real interactive question fired correctly and was answered, 33 real photos downloaded from the listing, and the existing `analysis.md` was updated in place with a correct dated Changelog entry. This is the concrete proof the architecture works, not a guess.

### Not yet done from that plan
- Dealership-analyzer and vehicle-research hard-coded workflow equivalents — still CLI-shelled via `skillRunner.js`/`POST /api/runs/skill` for now (intentional, scoped as follow-up per the approved plan).
- `website/src/views/pages/dashboard.ejs`'s "No research yet" alert and buttons were updated to remove `/run` references — done.

### URGENT — found mid-verification, blocks the "push to github" instruction until resolved

`git fetch` + `git status` confirmed: this repo already has an "Initial commit" (`0b25cc1`) pushed to a real GitHub remote (`https://github.com/RPhay/MyCars.git`), and that commit **already includes** `vehicles/BMW/2 Series/2016/WBA1M5C57GV326644/analysis.md` (personal car research) and apparently `website/node_modules/` too. The `.gitignore` added this session only prevents *new* tracked files — it does not retroactively untrack or purge already-committed/already-pushed content.

**Resolved 2026-08-09**: repo is private. User chose to leave the already-pushed commit's history as-is (no rewrite/force-push) and just stop tracking going forward. `git rm --cached -r vehicles website/node_modules` already run (safe — untracks only, files still on disk). `.gitignore` now covers `dealerships/`, `vehicles/`, `website/node_modules/`, `website/.env*`. Committing and pushing this fix + the foundation-slice work next.

## TODOS.md remaining backlog (unchanged from file, for quick reference)

Not started this session: dealership table (sort/filter/search/delete/star-rating/notes/correspondence/haggle-notes), vehicle treeview with ratings/notes/delete-cascade, market analysis feature, reference page CRUD UI, price-drop tracking / re-search for new listings, dream car page, UIX standards doc, icon/color conventions (red/yellow/green flags), external links open in new tab, "code against public APIs where available" audit.
