# Vehicle Research Standards & Rules

## CRITICAL: Data Preservation Rules

### Rule 1: NEVER Delete Without Explicit Direction
- **DO NOT delete existing vehicles** unless user explicitly says "delete [VIN]"
- Always check git history before any deletion
- If in doubt, ask the user
- Treat existing data as authoritative until told otherwise

### Rule 2: Multi-Listing Model for Same Vehicle
When the **same physical vehicle (VIN)** appears on multiple listing platforms:

**Table/List Display (make/model/year page):**
- Show MULTIPLE ROWS, one per listing
- Each row shows: VIN, Rating, Price, City, State, Seller, Photos, Updated, Bottom line, Actions
- Each row links to the same vehicle detail page
- Example: WBAHF9C05LWW33822 appears as 2 rows if listed on Cars.com AND Autotrader

**Analysis File (single per VIN):**
- ONE `/vehicles/.../WBAHF9C05LWW33822/analysis.md` file for the vehicle
- Contains MULTIPLE POSTING SECTIONS (one per listing location)
- Shared analysis sections apply to all postings:
  - Title & brand issues (applies to VIN, not listing)
  - Accident & damage history (applies to VIN)
  - Odometer integrity (applies to VIN)
  - Ownership & usage pattern (applies to VIN)
  - Service & maintenance (applies to VIN)
  - Open recalls (applies to VIN)
  - In-person checklist (applies to VIN)
  
**Posting-Specific Sections** (one per listing):
```
## Posting 1: Cars.com - Portland
- Asking price: $44,752
- Listing URL: https://www.cars.com/vehicledetail/1c5c1ea4-e754-437c-b7ee-a736c22c21c3/
- Seller: Cars.com listing
- Listed: [date]
- Mileage shown: 20,626 mi

## Posting 2: Autotrader - Seattle  
- Asking price: $43,500
- Listing URL: https://www.autotrader.com/cars-for-sale/vehicle/...
- Seller: [Dealer Name]
- Listed: [date]
- Mileage shown: 20,626 mi
```

**Benefit:** See ONE comprehensive research report on a vehicle, but track ALL ways it's advertised with price differences across platforms.

### Rule 3: Photo Organization
- **4 exterior photos** → `/photos/exterior/1.jpg` through `4.jpg` (or `exterior/*.jpg`)
- **4 interior photos** → `/photos/interior/1.jpg` through `4.jpg` (or `interior/*.jpg`)
- **Listing photos** → `/photos/listing_*.jpg` or similar
- Download during research from each listing source

### Rule 4: Navigation - Year Click Behavior
- When user clicks a year on a vehicle detail page
- Navigate to `/vehicles/:make/:model/:year` (the model/year page)
- Display that year's analysis and all vehicles for that make/model/year

### Rule 5: Analysis.md Structure (per VIN)
```markdown
# YEAR BMW MODEL — VIN

[Posting 1 metadata if multiple postings exist, or single posting metadata if unique]

[Shared analysis sections that apply to the VIN itself, not individual listings]

## Bottom line
[Assessment applies to the vehicle/VIN, not a specific listing]

## Title & brand issues
[Per VIN]

## Accident & damage history
[Per VIN]

## Odometer integrity
[Per VIN]

## Ownership & usage pattern
[Per VIN]

## Service & maintenance
[Per VIN]

## Open recalls
[Per VIN]

## What this report can't tell you
[Per VIN]

## Posting-Specific Details
### Posting 1: [Platform] - [City]
- Asking price: $XXXXX
- Listing URL: [URL]
- Seller: [Name]
- Mileage: XXX mi
- Trim/Engine: [from listing]

### Posting 2: [Platform] - [City]
[Same structure]

## Market comparison & pricing
[Cross-reference all postings to show price variance]

## In-person checklist
[Per VIN - applies to all postings]

## Changelog
- YYYY-MM-DD: Initial research, Posting 1 (Cars.com)
- YYYY-MM-DD: Added Posting 2 (Autotrader) - same vehicle, $1.2k price difference
```

## Research Workflow

1. **Search Phase:** Find individual listing URLs (not aggregator search pages)
2. **Validation Phase:** Extract VIN, verify against existing records
3. **Duplicate Check:** If VIN already exists, this is a new posting for same vehicle
4. **Research Phase:**
   - Run carfax-analyzer on listing URL
   - Extract 4 exterior + 4 interior photos
   - Capture posting-specific data (price, seller, URL, date)
5. **Integration Phase:**
   - If NEW vehicle: create `/vehicles/.../VIN/analysis.md`
   - If EXISTING vehicle: append new posting section to existing analysis.md
   - Update table to show new row for this posting
   - Preserve all photos, metadata, prior research

## Safety Checklist Before Any Deletion

- [ ] User explicitly requested deletion of [specific VIN]
- [ ] Verified VIN in current directory listing
- [ ] Checked git history for that VIN
- [ ] Confirmed no dependencies/links to that vehicle elsewhere
- [ ] Created git commit WITH deletion message before removal

## Script-Based Search Standards

All vehicle searches must:
- Target individual listing URLs (not search result pages)
- Extract VIN with validation
- Capture: URL, price, mileage, seller, city, state, trim, color
- Deduplicate against existing vehicles before creating rows
- Output structured format for easy integration into research workflow
