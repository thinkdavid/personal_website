#!/bin/bash
set -e

CDN_HOSTNAME="${AZURE_CDN_HOSTNAME}"
if [ -z "$CDN_HOSTNAME" ]; then
  echo "Error: AZURE_CDN_HOSTNAME not set"
  exit 1
fi

echo "Testing CDN delivery..."
echo "Verifying case-sensitive paths are accessible..."
echo ""

# Test a few known image URLs with exact case (using /images/ container prefix)
TEST_URLS=(
  "https://$CDN_HOSTNAME/images/peru/landscape/DSC_0818.jpg"
  "https://$CDN_HOSTNAME/images/mexico/landscape/gdl-0441.jpg"
  "https://$CDN_HOSTNAME/images/peopleOfSicily/landscape/siciliajul2024-265.jpg"
)

FAILURES=0
for url in "${TEST_URLS[@]}"; do
  echo "Testing: $url"
  http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  if [ "$http_code" = "200" ]; then
    echo "✓ OK ($http_code)"
  else
    echo "✗ FAILED ($http_code)"
    ((FAILURES++))
  fi
done

echo ""
echo "Checking HTML files for CDN paths..."
grep_count=$(grep -rc "blob.core.windows.net/images/" index.html gallery.html work/ 2>/dev/null | awk -F: '{sum+=$NF} END {print sum}')
echo "Found $grep_count CDN URLs in HTML files"

if [ "$grep_count" -gt 0 ]; then
  echo "✓ CDN paths present"
else
  echo "✗ No CDN paths found"
  ((FAILURES++))
fi

echo ""
echo "Checking for case mismatches (should be 0)..."
# Check for any lowercase directory names that shouldn't be there
mismatches=$(grep -r "peopleofsicily\|perú\|méxico" index.html gallery.html work/ 2>/dev/null | wc -l | xargs)
if [ "$mismatches" = "0" ]; then
  echo "✓ No case-sensitivity issues found"
else
  echo "✗ WARNING: Found $mismatches potential case mismatches"
  ((FAILURES++))
fi

if [ $FAILURES -gt 0 ]; then
  echo ""
  echo "ERRORS: $FAILURES issue(s) found"
  exit 1
else
  echo ""
  echo "✓ All CDN tests passed!"
fi
