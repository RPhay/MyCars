# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

Two independent implementations of the same research logic share one file-based "database" (`dealerships/`, `vehicles/`), per `references/research-storage.md`:

- **The terminal/CLI path**: Claude Code skills in `.claude/skills/` — `carfax-analyzer` (analyzes a Carfax or similar vehicle history report given a URL or PDF), `dealership-analyzer` (analyzes a dealership's business model, inventory, and reputation), and `vehicle-research` (researches a make/model/year as a type — manufacturer claims, expert reviews, reliability, safety ratings, typical pricing, recalls). These are the design spec as well as a working implementation.
- **The website path** (`website/`): a local Node/Express/EJS/Bootstrap app (mirrors the sibling `MyWork` project's stack, no build step) that does its own research — hard-coded fetch/parse logic by default (see `website/src/services/workflows/`), falling back to narrow, bounded local-`claude`-CLI-assisted calls (`website/src/services/workflows/claudeAssist.js`) only for genuinely messy extraction/judgment a parser can't do reliably. It does not shell out to the interactive skills for its own vehicle research (see `vehicleWorkflow.js`); `dealership-analyzer`/`vehicle-research` are still triggered via the CLI from the website as an interim measure until their hard-coded equivalents are built. No "skills" concept is exposed in the UI — research is triggered via buttons/modal on the relevant page. Run `./website/launch-mac.sh` (or `launch-mac.ps1` under pwsh) to start it at `http://localhost:3100`. `npm run dev` inside `website/` for a bare dev server without the launcher. See `website/package.json` for scripts (`lint`, `format`).
- `references/` — reference material for Claude to load automatically, kept out of this file to keep it short.
- `TODOS.md` — user-maintained backlog for the website; check it before starting new website work.

@references/car-sites.md
@references/general-dealership-review-sites.md
@references/car-review-sites.md

Update this file as real code, commands, and architecture are introduced.
