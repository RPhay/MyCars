# Vehicle Search Skill

Automated script-based search for vehicles across multiple listing platforms.

## Purpose
Search for specific vehicles (make/model/year) across Cars.com, Autotrader, Edmunds, CarGurus, and dealership inventory sites. Returns individual listing URLs with VIN extraction.

## Supported Platforms
- Cars.com
- Autotrader  
- CarGurus
- Edmunds
- Craigslist (regional)
- Dealership inventory (state-by-state)

## Safety Rules
- **NEVER DELETE existing vehicles** without explicit user direction
- **NEVER OVERWRITE** analysis.md files without confirmation
- **ALWAYS PRESERVE** photos/ directories and metadata
- Track all deletions with git before any removal
- Validate VINs before creating/updating vehicle records

## Usage
Invoke this skill when you need to:
1. Search for a specific make/model/year across multiple sources
2. Extract individual listing URLs (not aggregator search pages)
3. Build a reusable vehicle database from real listings
4. Cross-reference VINs across platforms

## Output Format
Returns structured listing data:
- VIN (validated 17-character)
- Listing URL (direct to vehicle, not search result)
- Price
- Mileage
- City/State
- Trim/Engine
- Color
- Seller name
- Platform source

## Script Files
- `search-cars-com.sh` - Cars.com search and listing extraction
- `search-autotrader.sh` - Autotrader search and extraction
- `search-dealerships.sh` - Dealership inventory site searches
- `validate-vin.sh` - VIN format validation
- `deduplicate-listings.sh` - Remove duplicate VINs across platforms
