#!/bin/bash

# Check if the input and target files are provided
if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <snippet_file.html> <target_file.html>"
  exit 1
fi

snippet_file="$1"
target_file="$2"

# Ensure both files exist
if [[ ! -f "$snippet_file" ]]; then
  echo "Snippet file $snippet_file does not exist!"
  exit 1
fi

if [[ ! -f "$target_file" ]]; then
  echo "Target file not provided, defaulting to index.html"
  target_file="index.html"
  exit 1
fi

# Create a backup of the target file
backup_file="${target_file}.backup"
cp "$target_file" "$backup_file"
echo "Backup saved as $backup_file."

# Read the snippet content
snippet_content=$(cat "$snippet_file")

# Add the snippet after the specified line directly in the target file
awk -v snippet="$snippet_content" '
  /<div role="list" class="work-list_list w-dyn-items">/ {
    print  # Print the matching line
    print snippet  # Insert the snippet immediately after
    next
  }
  { print }  # Print all other lines
' "$backup_file" > "$target_file"

echo "Snippet added. Changes made directly to $target_file."
