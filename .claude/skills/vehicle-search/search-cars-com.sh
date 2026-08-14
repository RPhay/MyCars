#!/bin/bash
# Search Cars.com for a specific vehicle (make/model/year) in Oregon/Washington
# Usage: ./search-cars-com.sh "2020" "BMW" "Z4"
# Output: CSV with VIN, URL, price, mileage, city, trim, color, seller

YEAR="$1"
MAKE="$2"
MODEL="$3"

if [ -z "$YEAR" ] || [ -z "$MAKE" ] || [ -z "$MODEL" ]; then
  echo "Usage: $0 YEAR MAKE MODEL"
  echo "Example: $0 2020 BMW Z4"
  exit 1
fi

# Safety: this is a template script — actual search requires browser automation
# Do not run curl on Cars.com search pages directly without User-Agent and rate limiting
# This script is meant to be extended with proper HTTP headers and pagination

echo "Search template for: $YEAR $MAKE $MODEL"
echo "Note: Requires claude-in-chrome browser tools for JS-rendered pagination"
echo "Individual listing URLs should be extracted and passed to carfax-analyzer"
