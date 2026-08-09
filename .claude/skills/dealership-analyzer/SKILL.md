---
name: dealership-analyzer
description: Analyze a car dealership in depth — business model, inventory mix, reputation across review platforms, BBB standing, and reported legal/news history — given a dealership URL or a name and location. Use when the user wants to research or vet a dealership before buying from them.
runInSubagent: false
---

# Dealership Analyzer

Perform the depth of research a careful buyer does on the seller, not just the vehicle: who they are, what they sell, and what a pattern of independent sources says about how they treat customers.

## Step 1: Identify the dealership

- **Given a URL**: use it directly.
- **Given a name + location** (no URL): WebSearch to find the official site. If multiple dealerships share the name (common with franchise groups), surface the candidates found and ask the user which one rather than guessing.
- State the resolved identity (legal/trade name, address, site URL) before proceeding, so the rest of the research is unambiguously about the right business.
- Add the resolved domain to the project's permission allowlist: if `WebFetch(domain:<bare-domain>)` and `WebFetch(domain:www.<bare-domain>)` aren't already present in `.claude/settings.local.json`'s `permissions.allow` array, add them (read the file first, merge — don't overwrite other entries). This happens on every dealership analyzed, so repeat runs against the same dealership, and any later carfax-analyzer spot-check against its listings, don't keep prompting for that domain.

## Step 2: Analyze the dealership's own site

- WebFetch the homepage, inventory, and about/history pages. If JS-rendered or blocked, fall back to the claude-in-chrome browser tools (real browser only — never a scripted workaround for a 403/bot-detection block).
- Extract: franchise (which manufacturer(s)) vs. independent, brand(s) carried or specialized in, new/used/both, certified pre-owned program, approximate inventory size, price tiers, number of locations, financing/warranty offerings, and any self-reported claims (awards, "X years in business," etc.) — note these as self-reported/unverified, not fact, until cross-checked elsewhere.
- For "what kinds of vehicles they carry": characterize the inventory from listing filters/counts/price distribution rather than enumerating every unit — large lots can run 100+ vehicles.
- Check for a Buyers Guide / warranty disclosure pattern and note anything from `references/dealership_red_flags.md` observed directly on the site (e.g. mandatory-looking add-ons, fees not disclosed until checkout).

## Step 3: Cross-reference reputation

Read `../../../references/car-sites.md` and `../../../references/general-dealership-review-sites.md` (relative to this skill's folder) for the full site directory — don't hardcode a duplicate list here, since those files are the maintained source of truth.

- Look the dealership up on the automotive-specific dealer-rating sites from `car-sites.md` (Cars.com, CarGurus, Autotrader, KBB/DealerRater) and the general platforms from `general-dealership-review-sites.md` (Google Reviews, Yelp, Facebook, BBB, Trustpilot).
- For each platform where the dealership has a presence, record: star rating, review count, and 2-3 representative themes (praise and complaints) from the review text.
- Explicitly note platforms where no presence was found — don't omit them silently, since absence itself is informative (e.g. a dealership with zero Google reviews after years in business is unusual).
- Apply `references/dealership_red_flags.md` — look for the same specific tactic recurring across multiple independent reviewers, not just a single complaint.

## Step 4: BBB standing

- Record both the letter grade **and** the complaints tab specifically (count, timeframe, resolved vs. unresolved) — per `general-dealership-review-sites.md`, these can diverge significantly (a dealership can hold an A+ while carrying many recent complaints).

## Step 5: Legal/news research

- WebSearch for news coverage of lawsuits, state Attorney General consumer-protection actions, or other regulatory actions naming the dealership.
- **Scope limit — state this explicitly in the output**: this is web search and BBB complaint data only. There is no access to court-record databases (PACER, state court portals), so this cannot find unreported, sealed, or non-newsworthy legal matters. A clean result here is not proof of a clean legal history.
- Every item cited with its source and date. Keep allegations distinct from resolved outcomes — use the source's own language (e.g. "the suit alleges," "the dealership settled for," "the case was dismissed") rather than flattening everything into one tone.
- If nothing is found, say so plainly rather than implying it as a positive finding.

## Step 6: Produce the analysis

Give the user a structured report:

1. **Bottom line** — one paragraph: overall read (trustworthy / proceed with normal caution / red flags present) and the single biggest reason why.
2. **Business model & inventory** — franchise/independent, brands, new/used/CPO mix, price tiers, locations, size.
3. **Reputation across review platforms** — per-platform rating/count/themes from Step 3, including platforms with no presence.
4. **BBB standing** — grade and complaints tab findings from Step 4.
5. **Legal/news findings** — from Step 5, with the scope-limit disclaimer.
6. **What this analysis can't tell you** — no court-record access, review-manipulation is possible on any platform, self-reported business claims not independently verified, and this doesn't assess the condition of any specific vehicle (that's `carfax-analyzer`'s job, not this skill's).

Cite the specific source and date for every claim raised, the same way `carfax-analyzer` cites report data lines — don't assert a red flag without pointing to where it came from.

## Step 7: Offer an optional Carfax spot-check

Ask the user whether they want a handful of currently-listed inventory vehicles spot-checked via the `carfax-analyzer` skill, as a proxy for inventory quality. **Ask every time** — never run this automatically, even if the user said yes in a prior run this session. Only proceed on an explicit yes. If they agree, pick a small representative sample (not the whole lot) and run `carfax-analyzer` on each; those runs persist themselves per `references/research-storage.md` and will link back to this dealership's file automatically.

If the invocation already states a spot-check decision up front (e.g. a request built from a form, saying "Carfax spot-check: yes, sample 3 inventory vehicles" or "Carfax spot-check: skip it") — as opposed to a live back-and-forth where nothing has been decided yet — use that decision directly and don't ask.

## Step 8: Persist the research

Write/update `dealerships/<domain>/analysis.md` per `../../../references/research-storage.md` (paths relative to the project root) with this analysis, including links to any vehicle files created in Step 7. This happens on every run, whether or not Step 7's spot-check was accepted.
