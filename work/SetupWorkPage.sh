#!/bin/bash

# Default input HTML file
input_file="work-page-with-variables.html"

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
    --title)
      title="$2"
      shift 2
      ;;
    --subtitle)
      subtitle="$2"
      shift 2
      ;;
    --coverPhotoUrl)
      coverPhotoUrl="$2"
      shift 2
      ;;
    --description)
      description="$2"
      shift 2
      ;;
    --imageSuffixLandscape)
      imageSuffixLandscape="$2"
      shift 2
      ;;
    --imageSuffixPortrait)
      imageSuffixPortrait="$2"
      shift 2
      ;;
    --nextWorkTitle)
      nextWorkTitle="$2"
      shift 2
      ;;
    --nextWorkUrlSlug)
      nextWorkUrlSlug="$2"
      shift 2
      ;;
    --nextWorkCoverImageUrl)
      nextWorkCoverImageUrl="$2"
      shift 2
      ;;
    --landscapeImageUrls)
      landscapeImageUrls="$2"
      shift 2
      ;;
    --portraitImageUrls)
      portraitImageUrls="$2"
      shift 2
      ;;
    --outputFile)
      output_file="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# Check required variables
required_vars=("title" "subtitle" "coverPhotoUrl" "description" "imageSuffixLandscape" "imageSuffixPortrait" "nextWorkTitle" "nextWorkUrlSlug" "nextWorkCoverImageUrl" "landscapeImageUrls" "portraitImageUrls")
for var in "${required_vars[@]}"; do
  if [[ -z "${!var}" ]]; then
    echo "Error: Missing required parameter --$var"
    exit 1
  fi
done

# Convert the comma-separated lists into arrays
IFS=',' read -r -a arrayOfLandscapeImageUrls <<< "$landscapeImageUrls"
IFS=',' read -r -a arrayOfPortraitImageUrls <<< "$portraitImageUrls"

# Prepare the snippet for landscape images
landscape_photos=""
for imageUrl in "${arrayOfLandscapeImageUrls[@]}"; do
  landscape_photos+="<div role=\"listitem\" class=\"still_item w-dyn-item w-dyn-repeater-item\"><div class=\"work-image-wrap\"><img loading=\"lazy\" height=\"Auto\" alt=\"\" src=\"$imageUrl.$imageSuffixLandscape\" sizes=\"(max-width: 479px) 92vw, 95vw\" srcset=\"$imageUrl-p-500.$imageSuffixLandscape 500w, $imageUrl-p-800.$imageSuffixLandscape 800w, $imageUrl-p-1080.$imageSuffixLandscape 1080w, $imageUrl-p-1600.$imageSuffixLandscape 1600w, $imageUrl-p-2000.$imageSuffixLandscape 2000w, $imageUrl-p-2600.$imageSuffixLandscape 2600w, $imageUrl-p-3200.$imageSuffixLandscape 3200w, $imageUrl.$imageSuffixLandscape 9252w\" class=\"work-image\" style=\"transform: translate3d(0px, 0px, 0px) scale3d(1, 1, 1) rotateX(0deg) rotateY(0deg) rotateZ(0deg) skew(0deg, 0deg); transform-style: preserve-3d; filter: blur(0px);\"></div></div>"
done

# Prepare the snippet for portrait images
portrait_images=""
for imageUrlPortrait in "${arrayOfPortraitImageUrls[@]}"; do
  portrait_images+="<div role=\"listitem\" class=\"collection-item w-dyn-item w-dyn-repeater-item w-col w-col-6\"><a href=\"#\" class=\"w-inline-block w-lightbox\" aria-label=\"open lightbox\" aria-haspopup=\"dialog\"><img src=\"$imageUrlPortrait.$imageSuffixPortrait\" loading=\"lazy\" alt=\"\" sizes=\"(max-width: 479px) 40vw, (max-width: 767px) 44vw, (max-width: 991px) 46vw, 453px\" srcset=\"$imageUrlPortrait-p-500.$imageSuffixPortrait 500w, $imageUrlPortrait-p-800.$imageSuffixPortrait 800w, $imageUrlPortrait.$imageSuffixPortrait 1005w\"><script type=\"application/json\" class=\"w-json\">{\"items\":[{\"url\":\"$imageUrlPortrait.$imageSuffixPortrait\",\"type\":\"image\"}],\"group\":\"PeopleOfItaly\"}</script></a></div>"
done

# Copy the input file to the output file
cp "$input_file" "$output_file"

# Escape variables for sed
escape_sed() {
  echo "$1" | sed -e 's/[&/\]/\\&/g'
}

title=$(escape_sed "$title")
subtitle=$(escape_sed "$subtitle")
coverPhotoUrl=$(escape_sed "$coverPhotoUrl")
description=$(escape_sed "$description")
imageSuffixLandscape=$(escape_sed "$imageSuffixLandscape")
imageSuffixPortrait=$(escape_sed "$imageSuffixPortrait")
nextWorkTitle=$(escape_sed "$nextWorkTitle")
nextWorkUrlSlug=$(escape_sed "$nextWorkUrlSlug")
nextWorkCoverImageUrl=$(escape_sed "$nextWorkCoverImageUrl")
landscape_photos=$(escape_sed "$landscape_photos")
portrait_images=$(escape_sed "$portrait_images")

# Safely replace placeholders with variables in the output file
sed -i '' "s|{title}|$title|g" "$output_file"
sed -i '' "s|{subtitle}|$subtitle|g" "$output_file"
sed -i '' "s|{coverPhotoUrl}|$coverPhotoUrl|g" "$output_file"
sed -i '' "s|{description}|$description|g" "$output_file"
sed -i '' "s|{imageSuffixLandscape}|$imageSuffixLandscape|g" "$output_file"
sed -i '' "s|{imageSuffixPortrait}|$imageSuffixPortrait|g" "$output_file"
sed -i '' "s|{nextWorkTitle}|$nextWorkTitle|g" "$output_file"
sed -i '' "s|{nextWorkUrlSlug}|$nextWorkUrlSlug|g" "$output_file"
sed -i '' "s|{nextWorkCoverImageUrl}|$nextWorkCoverImageUrl|g" "$output_file"
awk -v landscape_photos="$landscape_photos" \
    -v portrait_images="$portrait_images" \
    '{
      gsub(/{insertLandscapePhotosHere}/, landscape_photos);
      gsub(/{insertPortraitImagesHere}/, portrait_images);
      # Restore newlines by replacing the placeholder with real newlines
      gsub(/\\n/, "\n");
      print;
    }' "$output_file" > "$output_file.temp" && mv "$output_file.temp" "$output_file"

echo "Updated file saved as $output_file."
