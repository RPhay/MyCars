# To Be Continued

Working notes for picking up where a session left off. Update this after each TODOS.md item, per standing instruction.

## Session state as of 2026-08-09

### Commit `0315bbe`: website rearchitecture foundation slice + gitignore fix

Full plan was at `~/.claude/plans/compressed-sprouting-pizza.md` (session-local, not in this repo — gone once that session ends). Summary of what shipped:

- **Hard-coded backend** (`website/src/services/workflows/`): `workflowRunner.js` (generic phase/question engine over SSE), `fetchPage.js` (fetch + cheerio scraping helpers), `claudeAssist.js` (narrow, bounded local-`claude`-CLI-assisted calls for genuinely messy extraction — `askClaudeJson`, `extractVehicleInfo`, `decodeVin`, `looksLikeVin`), `markdownWriter.js` (research-storage.md-format writer with update-in-place + Changelog).
- **First real workflow**: `vehicleWorkflow.js` — hard-coded reimplementation of `carfax-analyzer`'s logic.
- **API**: `website/src/routes/api.js` — `POST /api/runs/vehicle`, `POST /api/runs/skill` (still-CLI-based dealership-analyzer/vehicle-research), `GET /api/runs/:id/events` (SSE, normalizes both producer types), `POST /api/runs/:id/answer`, `POST /api/runs/:id/cancel`.
- **Modal UI**: `research-modal.ejs`/`research-modal.js`/CSS in `main.css` — car-themed animated status indicator, phase log, real question UI, cancel-only exit.
- **Removed**: `/run` page and its 3 dedicated skill-trigger forms.
- **Verified end-to-end for real** against the BMW M235i VIN: NHTSA decode, bot-check wall correctly detected (not bypassed), real report text extraction, a genuine mid-run question pause/resume, 33 real photos downloaded, correct update-in-place persistence with changelog.
- **Also fixed**: `vehicles/` and `website/node_modules/` had been accidentally committed before this session; untracked them (`git rm --cached`, files untouched on disk) and added `.gitignore`. Repo is private; user chose to leave the already-pushed old commit's history as-is rather than rewrite/force-push.

### Accurate TODOS.md status (per-item, given directly to the user — not all complete)

**Done:**
- General #2 (.gitignore) — done.

**Partially done:**
- General #1 (site runs hard-coded, no Claude) — true only for vehicle/VIN research. `dealership-analyzer` and `vehicle-research` are still CLI-shelled via `skillRunner.js` — explicit deferred follow-up, not an oversight.
- General #5 (research modal: car graphics, progress, real questions, cancel-only exit) — fully built and genuinely interactive, but only for the vehicle workflow. Skill-based runs (dealership/vehicle-type) still show raw CLI text in the same modal with no real question support, since the CLI's headless mode has no `AskUserQuestion` tool (verified earlier this session).
- General #8 (external links open in new tab) — only done for the photo-gallery links so far, not site-wide.
- General #9 (code against public APIs where available) — only done for NHTSA's VIN decode API. Not audited across the rest of `references/car-sites.md`/`car-review-sites.md`/`general-dealership-review-sites.md`.

**Not started:**
- General #4 (UIX standards file), #6 (icon/color conventions — red !/green/yellow), #10 (price-drop tracking / re-check listings), #11 (dream car page).
- Dealership page: everything (add/analyze UI beyond the modal, sortable/filterable/searchable table, delete, star/favorite/avoid ratings, notes/correspondence log, haggle-willingness tracking). Current `/dealerships` is a plain list, not the described table.
- Vehicles page: the treeview-with-child-counts UI (current `/vehicles` is a plain accordion, not exactly what was asked for), search, cascading delete, ratings, notes, hyperlink-icon treatment instead of a raw URL, Carfax-report-link icon, "find new listings" search-and-offer-to-add flow.
- Market Analysis: entirely unstarted.
- Reference page: entirely unstarted — no UI for editing the three reference `.md` files; they're still Claude-Code-only reference files.

## Next up

No specific item chosen yet for the next session — ask the user which TODOS.md item to pick up, don't assume. Reasonable candidates given what exists: the UIX standards file (#6, referenced by name in TODOS.md item 6 itself as something to write down and then follow), since it'll shape how the table/treeview/rating work gets built afterward.
