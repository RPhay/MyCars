# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

The project's actual work happens through Claude Code skills, not application code — except for `website/`, a local browsing/trigger front end. Structure:

- `.claude/skills/` — Claude Code skills for this project: `carfax-analyzer` (analyzes a Carfax or similar vehicle history report given a URL or PDF), `dealership-analyzer` (analyzes a dealership's business model, inventory, and reputation), and `vehicle-research` (researches a make/model/year as a type — manufacturer claims, expert reviews, reliability, safety ratings, typical pricing, recalls).
- `dealerships/` — dealership research, one subfolder per dealership domain; written/updated by `dealership-analyzer`. See `references/research-storage.md`.
- `vehicles/` — vehicle research, nested by make/model/year; written/updated by `carfax-analyzer` and `vehicle-research`. See `references/research-storage.md`.
- `references/` — reference material for Claude to load automatically, kept out of this file to keep it short.
- `website/` — local Node/Express/EJS/Bootstrap web app (mirrors the sibling `MyWork` project's stack, no build step) for browsing the research in `dealerships/`/`vehicles/` and triggering skill runs from the browser instead of the terminal. Run `./website/launch-mac.sh` (or `launch-mac.ps1` under pwsh) to start it at `http://localhost:3100` — checks/installs Node via Homebrew, `npm install`s if needed, and opens Chrome. `npm run dev` inside `website/` for a bare dev server without the launcher. See `website/package.json` for scripts (`lint`, `format`).

@references/car-sites.md
@references/general-dealership-review-sites.md
@references/car-review-sites.md

Update this file as real code, commands, and architecture are introduced.
