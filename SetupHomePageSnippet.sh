#!/bin/bash

# Asking for color of text to customize it but might do that later

# Default input HTML file
input_file="workSnippetWithVariables.html"

# Ensure the input file exists
if [[ ! -f "$input_file" ]]; then
  echo "File $input_file does not exist!"
  exit 1
fi

# Default output file
output_file="updatedSnippet.html"

# Parse named arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --outputFile)
      output_file="$2"
      shift 2
      ;;
    --urlSlug)
      urlSlug="$2"
      shift 2
      ;;
    --coverPhotoAlt)
      coverPhotoAlt="$2"
      shift 2
      ;;
    --imageUrl)
      imageUrl="$2"
      shift 2
      ;;
    --imageSuffix)
      imageSuffix="$2"
      shift 2
      ;;
    --title)
      title="$2"
      shift 2
      ;;
    --titleTextColor)
      title="$2"
      shift 2
      ;;
    --subtitleTextColor)
      title="$2"
      shift 2
      ;;
    --subtitle)
      subtitle="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# Check required variables
required_vars=("urlSlug" "coverPhotoAlt" "imageUrl" "imageSuffix" "title" "subtitle")
for var in "${required_vars[@]}"; do
  if [[ -z "${!var}" ]]; then
    echo "Error: Missing required parameter --$var"
    exit 1
  fi
done

# Copy the input file to the output file
cp "$input_file" "$output_file"

# # Escape variables for `sed`
# escape_sed() {
#   echo "$1" | sed -e 's/[&/\]/\\&/g'
# }

# urlSlug=$(escape_sed "$urlSlug")
# coverPhotoAlt=$(escape_sed "$coverPhotoAlt")
# imageUrl=$(escape_sed "$imageUrl")
# imageSuffix=$(escape_sed "$imageSuffix")
# title=$(escape_sed "$title")
# subtitle=$(escape_sed "$subtitle")

# Replace placeholders with variables in the output file
sed -i '' "s|{title}|$title|g" $output_file
sed -i '' "s|{urlSlug}|$urlSlug|g" $output_file
sed -i '' "s|{coverPhotoAlt}|$coverPhotoAlt|g" $output_file
sed -i '' "s|{imageUrl}|$imageUrl|g" $output_file
sed -i '' "s|{imageSuffix}|$imageSuffix|g" $output_file
sed -i '' "s|{subtitle}|$subtitle|g" $output_file

echo "Updated file saved as $output_file."
