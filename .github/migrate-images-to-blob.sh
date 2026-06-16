#!/bin/bash

# Idempotent migration script that tracks progress and can resume from failures
set -o pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CONTAINER_NAME="${AZURE_STORAGE_CONTAINER_NAME:-images}"
STORAGE_ACCOUNT="$AZURE_STORAGE_ACCOUNT_NAME"
PROGRESS_FILE="${PROGRESS_FILE:-.migration-progress}"
IMAGE_DIRS=("peru" "mexico" "pereira" "cinqueterre" "peopleOfSicily" "family")

if [ -z "$STORAGE_ACCOUNT" ]; then
  echo -e "${RED}Error: AZURE_STORAGE_ACCOUNT_NAME not set${NC}"
  exit 1
fi

echo -e "${YELLOW}Idempotent Image Migration to Azure Blob Storage${NC}"
echo "Progress file: $PROGRESS_FILE"
echo ""

# Initialize or load progress
if [ -f "$PROGRESS_FILE" ]; then
  echo "Found previous migration progress, resuming..."
  source "$PROGRESS_FILE"
else
  echo "Starting fresh migration..."
  UPLOADED_FILES=()
  FAILED_FILES=()
  START_TIME=$(date +%s)
fi

# Function to log uploaded file
log_upload() {
  local file_path="$1"
  UPLOADED_FILES+=("$file_path")
  # Save progress immediately
  cat > "$PROGRESS_FILE" << EOF
UPLOADED_FILES=(${UPLOADED_FILES[@]@Q})
FAILED_FILES=(${FAILED_FILES[@]@Q})
START_TIME=$START_TIME
EOF
}

# Function to log failed file
log_failure() {
  local file_path="$1"
  local error_msg="$2"
  FAILED_FILES+=("$file_path")
  echo -e "${RED}✗ FAILED: $file_path${NC}"
  echo "  Error: $error_msg" >&2
  # Save progress
  cat > "$PROGRESS_FILE" << EOF
UPLOADED_FILES=(${UPLOADED_FILES[@]@Q})
FAILED_FILES=(${FAILED_FILES[@]@Q})
START_TIME=$START_TIME
EOF
}

# Check if file already uploaded
is_uploaded() {
  local file_path="$1"
  for uploaded in "${UPLOADED_FILES[@]}"; do
    if [ "$uploaded" = "$file_path" ]; then
      return 0
    fi
  done
  return 1
}

echo "Uploading images to Azure Blob Storage..."
echo "IMPORTANT: All paths preserve exact case (e.g., peopleOfSicily, NOT peopleofsicily)"
echo ""

TOTAL_FILES=0
SKIPPED_FILES=0

for dir in "${IMAGE_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo -e "${YELLOW}Processing $dir...${NC}"
    
    # Process landscape images
    if [ -d "$dir/landscape" ]; then
      for file in "$dir/landscape"/*; do
        if [ -f "$file" ]; then
          ((TOTAL_FILES++))
          blob_path="${file#./}"  # Remove leading ./ if present
          
          if is_uploaded "$blob_path"; then
            echo "  ⊘ SKIP (already uploaded): $blob_path"
            ((SKIPPED_FILES++))
            continue
          fi
          
          echo "  ↑ Uploading: $blob_path"
          if az storage blob upload \
            --account-name "$STORAGE_ACCOUNT" \
            --container-name "$CONTAINER_NAME" \
            --file "$file" \
            --name "$blob_path" \
            --overwrite >/dev/null 2>&1; then
            log_upload "$blob_path"
            echo -e "    ${GREEN}✓ OK${NC}"
          else
            log_failure "$blob_path" "az storage blob upload failed"
          fi
        fi
      done
    fi
    
    # Process portrait images
    if [ -d "$dir/portrait" ]; then
      for file in "$dir/portrait"/*; do
        if [ -f "$file" ]; then
          ((TOTAL_FILES++))
          blob_path="${file#./}"
          
          if is_uploaded "$blob_path"; then
            echo "  ⊘ SKIP (already uploaded): $blob_path"
            ((SKIPPED_FILES++))
            continue
          fi
          
          echo "  ↑ Uploading: $blob_path"
          if az storage blob upload \
            --account-name "$STORAGE_ACCOUNT" \
            --container-name "$CONTAINER_NAME" \
            --file "$file" \
            --name "$blob_path" \
            --overwrite >/dev/null 2>&1; then
            log_upload "$blob_path"
            echo -e "    ${GREEN}✓ OK${NC}"
          else
            log_failure "$blob_path" "az storage blob upload failed"
          fi
        fi
      done
    fi
  else
    echo -e "${YELLOW}Skipping $dir (directory not found)${NC}"
  fi
done

echo ""
echo -e "${YELLOW}Migration Summary${NC}"
echo "Total files processed: $TOTAL_FILES"
echo "Successfully uploaded: ${#UPLOADED_FILES[@]}"
echo "Skipped (already uploaded): $SKIPPED_FILES"
echo "Failed: ${#FAILED_FILES[@]}"

if [ ${#FAILED_FILES[@]} -gt 0 ]; then
  echo -e "${RED}Failed files:${NC}"
  for failed in "${FAILED_FILES[@]}"; do
    echo "  - $failed"
  done
  echo ""
  echo "To retry: Run this script again"
  exit 1
else
  echo -e "${GREEN}Migration complete!${NC}"
  rm "$PROGRESS_FILE"  # Clean up on success
  exit 0
fi
