#!/bin/bash
set -e

CDN_HOSTNAME="${AZURE_CDN_HOSTNAME}"
if [ -z "$CDN_HOSTNAME" ]; then
  echo "Error: AZURE_CDN_HOSTNAME not set"
  exit 1
fi

echo "Updating HTML image paths to Azure CDN..."
echo "CASE-SENSITIVE: Preserving exact path case (e.g., peopleOfSicily/landscape/...)"
echo ""

# Function to update a single HTML file with case-preserved replacements
update_html_file() {
  local file="$1"
  if [ ! -f "$file" ]; then
    return
  fi
  
  echo "Updating $file..."
  
  # Backup original
  cp "$file" "${file}.backup"
  
  # Replace relative image paths with CDN URLs (case-preserving)
  # Pattern: src="folderName/landscape/photo.jpg" -> src="https://cdn/folderName/landscape/photo.jpg"
  # Uses lookahead/lookbehind to avoid double-replacements
  
  sed -E "s|src=\"([a-z][a-zA-Z]*)/landscape/([^\"]+)\"|src=\"https://${CDN_HOSTNAME}/\1/landscape/\2\"|g" "$file" > "${file}.tmp"
  sed -E "s|src=\"([a-z][a-zA-Z]*)/portrait/([^\"]+)\"|src=\"https://${CDN_HOSTNAME}/\1/portrait/\2\"|g" "${file}.tmp" > "$file"
  
  # Also update srcset attributes
  sed -E "s|srcset=\"([a-z][a-zA-Z]*)/landscape/([^\"]+)\"|srcset=\"https://${CDN_HOSTNAME}/\1/landscape/\2\"|g" "$file" > "${file}.tmp"
  sed -E "s|srcset=\"([a-z][a-zA-Z]*)/portrait/([^\"]+)\"|srcset=\"https://${CDN_HOSTNAME}/\1/portrait/\2\"|g" "${file}.tmp" > "$file"
  
  rm "${file}.tmp"
}

# Update main files
update_html_file "index.html"
update_html_file "gallery.html"

# Update work detail pages
for file in work/*.html; do
  update_html_file "$file"
done

echo ""
echo "Path updates complete!"
echo ""
echo "Verification:"
echo "  Check for CDN URLs: grep -r 'azureedge.net' index.html gallery.html work/*.html"
echo "  Check for double replacements: grep 'https://.*/https://' index.html gallery.html work/*.html"
