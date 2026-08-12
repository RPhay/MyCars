# UIX standards

Conventions for Claude to follow when building or extending `website/`. Applies going forward to new work; existing pages that don't yet conform are tracked in `TODOS.md`/`CLAUDE_TBC.md`, not retrofitted automatically just because this file now exists.

## Stack

- Bootstrap 5.3 and Bootstrap Icons 1.11, both via CDN (`website/src/views/layouts/main.ejs`) — no build step, no other UI framework or icon set.
- Custom CSS goes in `website/src/public/css/main.css`.
- Page-specific interactivity is vanilla JS in `website/src/public/js/`, matching the existing `research-modal.js` pattern — no client framework.

## Tables

`TODOS.md` asks for sortable/filterable/searchable tables (dealership list) and a "specific vehicles" table under a make/model/year. Neither exists yet as a real `<table>` — both are currently `list-group` link stacks. When built:

- Use Bootstrap's `table table-hover table-bordered align-middle` — `table-bordered` specifically because a borderless/top-rule-only table doesn't read as distinct rows at a glance, especially with few rows on the page.
- Every data table supports: click-to-sort column headers (ascending/descending, indicated with a `bi-arrow-up`/`bi-arrow-down` icon on the active column), a search input above the table that filters client-side across visible columns with no page reload, and filtering on any column with a bounded value set (rating, favorite/avoid, etc.).
- Sort/filter/search state lives in page-local vanilla JS, not a new dependency.
- No pagination threshold is set yet — revisit once real row counts are known.
- Clicking a row navigates to the detail page; inline action icons (delete, favorite toggle) call `stopPropagation()` so they don't also trigger the row navigation.

## Treeview (Vehicles: make → model → year → VIN)

- A real `<table>` (`vehicle-list.ejs`), not an accordion or nested `list-group` — every row (make, model, year) shares one row height and font size regardless of depth; the hierarchy reads through indentation (`.depth-1`/`.depth-2` padding-left in `main.css`) and a chevron on the collapsible make row, not through different heading levels per depth. No child-count badges ("2 models," "1 vehicle") on tree rows — the actual children are one click away (expand for make, navigate for model/year), so a count next to the label is redundant, not informative.
- Every row click-throughs to that node's own page: a make row goes to `/vehicles/:make` (`vehicle-make.ejs`, lists its models), a model row to `/vehicles/:make/:model` (`vehicle-model.ejs`, lists its years), a year row to `/vehicles/:make/:model/:year` (`vehicle-year.ejs`, already existed). Row text is plain, not styled as a hyperlink (no blue/underline on just the label) — the whole row is the click target, not a link embedded in it.
- Only the make row is also independently collapsible, via its chevron specifically — clicking the chevron toggles its models/years in place instead of navigating; clicking anywhere else on the make row navigates like every other row. Model/year rows show or hide together with their parent make (no separate per-model collapse). Driven by `vehicle-tree.js`, plain JS show/hide on `<tr>` — not Bootstrap's collapse component, which doesn't animate table rows well.
- `vehicle-make.ejs` and `vehicle-model.ejs` each show the node's own rating/favorite/avoid/delete controls (same pattern as `vehicle-year.ejs`) plus a sortable/searchable table of their direct children (models, or years) — driven by `simple-tree-table.js`, a config-via-`data-*`-attributes generalization of the sort/search/row-click-navigate logic first written for `dealership-table.js`, reused here instead of copy-pasting it a third and fourth time.
- Below that, both pages *also* show a flattened "Vehicles" table listing every VIN under that scope (all years × models for a make page, all years for a model page) — so a specific vehicle is reachable without drilling all the way down to its year page first. Each VIN row includes the Model/Year context columns needed to disambiguate (make page: Model + Year; model page: Year only) and a **Seller** column, so it's visible at a glance which dealership a given vehicle came from while browsing, not just after opening the vehicle itself.
- Expand/collapse state does not need to persist across page loads.
- Delete buttons on tree rows are hover/focus-revealed (`.row-delete`, opacity toggled in `main.css`), not permanently visible — a full-time red delete button on every row of a multi-level tree reads as clutter. Rating/favorite/avoid stay always-visible since they reflect real state, not just an available action.

## Icons and color (status system)

Bootstrap Icons only (`bi-*`) — the set already loaded, don't add a second icon library.

**Severity/status coloring** — for flags called out in research reports (red flags, positives, things needing follow-up):

| Meaning | Icon | Color class |
|---|---|---|
| Negative / red flag | `bi-exclamation-triangle-fill` | `text-danger` (icon and flag text both) |
| Positive | `bi-check-circle-fill` | `text-success` |
| Caution / needs follow-up | `bi-exclamation-circle` | `text-warning-emphasis` (base `text-warning` fails contrast for body text on white) |

This mapping applies wherever severity is hand-marked in template HTML. There is no automatic classifier over freeform research markdown yet (i.e. `bodyHtml` in `researchStore.js` is not scanned for "red flag" language and auto-colored) — that's a separate, unstarted implementation task, not something this doc alone provides.

**Ratings:**

| State | Icon | Color |
|---|---|---|
| Favorite | `bi-heart-fill` | `text-danger` |
| Avoid | `bi-slash-circle` | `text-danger` |
| Neither (favorite/avoid unset) | `bi-heart` / `bi-slash-circle` (outline) | `text-muted` |

Favorite and avoid are mutually exclusive — setting one clears the other. Deliberately not a star icon: a separate 1–5 star rating exists in the same row/page, and reusing the star glyph for favorite would visually collide with it.

Star scale (1–5, independent of favorite/avoid) uses `bi-star-fill` (filled, `text-warning`) / `bi-star` (empty, `text-muted`) per position. Clicking the currently-set star again clears the rating to 0.

**Spot-check flag** (`meta.json`'s `spotCheck` field, VIN level only): `bi-binoculars-fill` (`text-info`) when set / `bi-binoculars` (`text-muted`) when not, leftmost icon in the star-rating widget — but only on call sites for a specific vehicle (VIN detail page, and VIN rows in the year/model/make/flattened-tree tables), never on a make/model/year aggregate row or a dealership row, since the flag's meaning ("researched independently as part of a dealership inventory spot-check, not a car I'm looking to buy") only makes sense for one physical vehicle. Set automatically by `dealership-analyzer`'s Step 7 spot-check; user-toggleable off (or back on) by clicking it, same click-to-toggle pattern as favorite/avoid.

**Other icon roles:**

- External link indicator: `bi-box-arrow-up-right`, appended after any link leaving the site.
- History report link (Carfax/AutoCheck/similar — `vehicle.fields['History report']`, shown as an icon next to the vehicle detail page's title, not in the fields list): `bi-file-earmark-text`.
- Notes/correspondence present: `bi-sticky`.
- Dealership link on a vehicle detail page: `bi-shop` — same glyph as the nav link, for consistency.
- Domain icons already in use, keep them: `bi-car-front-fill`/`bi-car-front` (vehicles), `bi-shop` (dealerships), `bi-plus-lg` (add/research action), `bi-arrow-repeat` (re-run research), `bi-image` (photo count).

## External links

Every link leaving the site gets `target="_blank" rel="noopener noreferrer"`, plus the `bi-box-arrow-up-right` icon above. Site-wide as of the `marked` renderer override in `researchStore.js` — internal links (`/dealerships/...`, `/vehicles/...`, produced by `rewriteResearchLinks`) are left alone; anything else (explicit `[text](url)` markdown links and bare autolinked URLs alike, since both route through the same renderer hook) gets the treatment automatically, for every field and every research body across the site. Hand-written template links (photo gallery, the icons next to a vehicle's title, etc.) still need `target="_blank" rel="noopener noreferrer"` added explicitly, since those never pass through `marked`.

## Modals

The research/analysis progress modal (`research-modal.ejs`/`research-modal.js`, styles in `main.css`) — car-themed activity indicator, phase log, cancel-only exit — is the template for any future long-running-action modal. Reuse it rather than inventing a new pattern.

Destructive actions (delete) use a separate, generic confirmation modal (`confirm-modal.ejs`/`confirm-delete.js`), both included once in `main.ejs` and driven entirely by data attributes on the triggering element — no per-page JS needed:

- `data-delete-url` — the `DELETE` endpoint to call.
- `data-delete-name` — shown in the confirmation text.
- `data-delete-context` — `"row"` removes `data-delete-row-selector`'s closest match from the DOM on success; `"page"` redirects to `data-delete-redirect` on success.

A trigger (or any link/button) placed inside a clickable row — a table `<tr>` or a `list-group-item` used as a row — must NOT rely on an inline `onclick="event.stopPropagation()"` to keep the row's own navigate-on-click from also firing — this app's CSP (`app.js`) has no `'unsafe-inline'` in `script-src`, so inline event-handler attributes are silently blocked by the browser and never run. Instead, the row's own click listener guards itself: `if (e.target.closest('a, button')) return;` before navigating (see `dealership-table.js`, `vehicle-year.js`). Any future clickable row follows the same guard, not inline handlers.

## Layout and spacing

- Page content sits in `main.container.py-4` (`main.ejs`) — don't override container/padding at the page level.
- Sub-section headers use `h2.h5.mt-4` (see `vehicle-year.ejs`, `vehicle-detail.ejs`).
- A list/detail page's top action button(s) sit in a `d-flex justify-content-between align-items-center` row beside the `<h1>`, sized `btn-sm`.

## Forms

Free-text fields (first shipped: vehicle notes) follow `notes.js`'s pattern: a wrapping element with `data-notes-url` pointing at that entity's `PUT .../meta` endpoint, a `<textarea>`, and an explicit `data-notes-save` button — no autosave. A background save while the user is still typing is more surprising than helpful in a personal, single-user app; make the same call for any future free-text field (e.g. dealership correspondence log) unless there's a specific reason to autosave.

`PUT .../meta` (both dealerships and every vehicle-tree level) merges its body into the existing `meta.json` rather than requiring the full object — so a rating click and a notes save, from separate page sections that don't know about each other's current value, can each PATCH just their own field without clobbering the other.

**Multi-field append-only logs** (first shipped: dealership correspondence log): a plain `<form>` with a `data-<thing>-url` attribute pointing at its own `POST` endpoint (not `.../meta` — a log is a distinct sub-resource with its own add/delete routes, not a mergeable field), one input per field, and a small dedicated JS file (`correspondence.js`) handling `submit` → POST → full page reload on success. Reload rather than client-side-rendering the new entry, since duplicating the entry markup in both EJS and JS isn't worth it for a form used rarely, not in a hot loop. Structured/enum fields (e.g. contact method) use a `<select>` with a fixed option list, matching this app's general preference for bounded values over freeform text wherever the set of valid values is actually known.

Each logged entry gets a server-generated `id` and its own delete affordance, reusing the existing generic confirm-delete modal (`context="row"`, `data-delete-row-selector` scoped to that entry's row class) — no new deletion pattern needed.

Not yet established: forms for creating a new top-level entity (add-dealership, add-vehicle-by-make-model-year). Extend this section once one of those ships rather than improvising per page.
