---
name: vehicle-comparison
description: Compare all vehicles within a make/model/year (or make/year) across multiple factors, rank from best to worst buy, highlight special categories, and flag red flags. Output sortable scoring table with hover rationale.
runInSubagent: false
---

# Vehicle Comparison Skill

Generate a comprehensive vehicle comparison ranking for all vehicles under a given make/model/year or make/year grouping. Rank from best buy to worst buy using equally-weighted factors, highlight special categories, and identify red flags.

## Input

User specifies a scope:
- **Make/Model/Year Level:** "Compare all 2020 BMW Z4 M40i" → compares vehicles within that specific trim/engine
- **Make/Year Level:** "Compare all 2020 BMW Z4" → compares all 2020 Z4s (all trims/engines)
- **Make Level:** "Compare all BMW Z4" → compares across all years (2016-2023)

## Step 1: Gather Vehicle Data

From the project's `vehicles/<make>/<model>/<year>/` directory structure, extract ALL vehicles matching the scope:

For each vehicle, collect:
- **VIN** (if available)
- **Price** (asking price)
- **Mileage** (current recorded mileage)
- **Trim/Engine** (sDrive30i, M40i, etc.)
- **Dealer/Seller** (name and location)
- **Local vs. Delivery** (is vehicle locally available or delivery-only?)
- **Warranty Status** (remaining warranty, if any)
- **Dealer Rating** (from research notes)
- **Photo Count** (indicator of condition/transparency)
- **Known Issues** (from analysis.md, Carfax, or year-level research)
- **Age** (model year)
- **Accident History** (if Carfax data available)
- **Service Records** (if documented)

## Step 2: Calculate Normalized Scores (0-100 scale)

For each vehicle, calculate 8 factors, normalize to 0-100, then average equally.

### Factor 1: Price Score (Lower = Better)
```
price_percentile = (vehicle_price - min_price) / (max_price - min_price)
price_score = 100 - (price_percentile * 100)
```
**Rationale:** Cheaper vehicles score higher; most expensive scores 0.

### Factor 2: Mileage Score (Lower = Better, adjusted)
```
miles_per_1000 = vehicle_mileage / 1000
average_miles_per_1000 = (sum of all vehicles' miles/1000) / vehicle_count
mileage_percentile = vehicle_miles / max_mileage_in_group
mileage_score = 100 - (mileage_percentile * 100)
```
**Rationale:** Lower mileage scores higher; penalizes high-mileage vehicles.

### Factor 3: Warranty Score (More = Better)
```
warranty_values = {
  "None/Expired": 0,
  "<1 year": 25,
  "1-2 years": 50,
  "2-3 years": 75,
  "3+ years": 100,
  "Full manufacturer": 100
}
warranty_score = warranty_values[vehicle_warranty]
```
**Rationale:** Vehicles with remaining warranty score higher; expired warranty = 0.

### Factor 4: Dealer Rating Score (Higher Rating = Better)
```
dealer_rating_score = (vehicle_dealer_rating / 5.0) * 100
```
**Rationale:** 5-star dealers score 100; lower ratings score proportionally lower.

### Factor 5: Condition Score (Photo Count & Known Issues = Better)
```
photo_bonus = min(photo_count / 8, 1.0) * 50  // 8 photos = max 50 points
known_issues_penalty = issue_count * 10  // Each known issue = -10 points
condition_score = max(0, 50 + photo_bonus - known_issues_penalty)
```
**Rationale:** More photos + fewer known issues = higher score. Max 100.

### Factor 6: Age Score (Newer = Better)
```
newest_year = max(all vehicle model years)
oldest_year = min(all vehicle model years)
age_percentile = (vehicle_year - oldest_year) / (newest_year - oldest_year)
age_score = (age_percentile * 100)
```
**Rationale:** Newest vehicles score 100; oldest score 0.

### Factor 7: Local Availability Score (Local = Better)
```
local_score = 100 if vehicle_is_local else 50  // Local = 100, Delivery = 50
```
**Rationale:** Local pickup valued over delivery logistics.

### Factor 8: Value Score (Price adjusted for mileage)
```
price_per_1000_miles = vehicle_price / (vehicle_mileage / 1000)
avg_price_per_1000 = sum(all price_per_1000) / vehicle_count
value_percentile = avg_price_per_1000 / price_per_1000_miles
value_score = min(value_percentile * 100, 100)
```
**Rationale:** Better $/1000mi value scores higher.

### Overall Score Calculation
```
overall_score = (price_score + mileage_score + warranty_score + dealer_rating_score + 
                 condition_score + age_score + local_score + value_score) / 8
```

## Step 3: Rank Vehicles

Sort all vehicles by overall_score descending (highest = best buy).

## Step 4: Identify Red Flags

For each vehicle, check:

```
RED FLAGS:
- ⛔ MISSING PHOTOS: photo_count < 4 → Auto-downrank 25 points
- ⛔ HIGH MILEAGE: mileage > 120,000 → Auto-downrank 25 points
- ⛔ NO WARRANTY: warranty_remaining == "None" AND vehicle_age > 7_years → Auto-downrank 20 points
- ⛔ DELIVERY-ONLY: is_delivery_only AND user_specified_local_pickup → Flag prominently
- ⛔ MULTIPLE KNOWN ISSUES: issue_count >= 3 → Flag as "Proceed with caution"
- ⛔ ACCIDENT HISTORY: has_reported_accidents → Flag severity level
- ⛔ EXTREMELY HIGH MILEAGE: mileage > 150,000 → Auto-exclude or flag separately
```

Apply penalties AFTER calculating normalized scores, show as "Adjusted Score" in table.

## Step 5: Highlight Special Categories

Beyond the main ranking, identify and call out:

**🥇 Best Overall Value** — Vehicle with highest overall_score
**💰 Best Budget Option** — Vehicle with lowest price (if score > 50)
**🛡️ Best Warranty Coverage** — Vehicle with longest remaining warranty
**✨ Best Condition** — Vehicle with most photos + fewest issues
**🎯 Best Local Option** — Best-scoring vehicle available locally (if any exist)
**⚠️ Best Price, High Risk** — Cheapest vehicle BUT with red flags (needs caution)

## Step 6: Output Format

Generate a **sortable HTML/Markdown table** with these columns:

| Rank | VIN | Price | Mileage | $/1K mi | Trim | Dealer | Local | Warranty | Rating | Photos | Issues | Overall Score | Adjusted Score |
|------|-----|-------|---------|---------|------|--------|-------|----------|--------|--------|--------|-----------------|---|

**Hover Tooltip (on each row):**
```
Rationale for Score:
- Price: [price_score] — [percentile vs. others]
- Mileage: [mileage_score] — [vs. group average]
- Warranty: [warranty_score] — [specific coverage]
- Dealer: [dealer_rating_score] — [rating + review count]
- Condition: [condition_score] — [X photos, Y known issues]
- Age: [age_score] — [model year vs. newest]
- Local: [local_score] — [local vs. delivery]
- Value: [value_score] — [price efficiency]

RED FLAGS (if any):
- [Flag description with severity]

RECOMMENDATION:
[Custom recommendation based on factors]
```

## Step 7: Add Visual Indicators

- **🏆** = Top 3 ranked vehicles
- **⚠️** = Vehicle with red flags
- **❌** = Excluded due to major red flag
- **✅** = Local availability
- **📦** = Delivery only
- **🔧** = Known issues requiring service

## Step 8: Provide Summary

**Above the table, provide:**

1. **Comparison Scope:** "Comparing X vehicles in [Make/Model/Year]"
2. **Price Range:** $X – $Y (with outliers noted)
3. **Mileage Range:** X,XXX – YYY,XXX miles
4. **Local vs. Delivery:** X local, Y require delivery
5. **Warranty Coverage:** X with warranty, Y expired
6. **Special Categories** (call out the 6 highlighted vehicles)
7. **Overall Assessment:** One-paragraph summary of market dynamics

## Step 9: Notes on Implementation

- **Sorting:** Table should be sortable by clicking column headers
- **Filtering:** Allow filtering by "Local only," "Warranty required," "Under $X price"
- **Export:** Option to export table as CSV for user reference
- **Updates:** Regenerate comparison whenever new vehicles are added to the scope

---

## Usage

**For website integration:**
- Generate comparison table on `/vehicles/<make>` page (all years/trims)
- Generate comparison table on `/vehicles/<make>/<model>` page (all years)
- Generate comparison table on `/vehicles/<make>/<model>/<year>` page (all trims)

**Data source:** Read all `vehicles/<make>/<model>/<year>/*/analysis.md` files within scope and extract structured data.

**Output:** HTML table with sorting, hover tooltips, filters, and special category callouts.

---

**When to use this skill:**
- User asks "Which Z4 should I buy?" (compare all)
- User asks "How do these 2020 M40is compare?" (compare specific trim)
- Website renders a make/model/year page (auto-generate comparison)
- User wants to understand trade-offs between vehicles (table + rationale)

**Never use this skill for:**
- Single vehicle analysis (use carfax-analyzer instead)
- Dealership reputation (use dealership-analyzer instead)
- Make/model/year specifications (use vehicle-research instead)
