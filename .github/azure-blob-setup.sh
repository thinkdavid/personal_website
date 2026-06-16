#!/bin/bash
set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Azure Blob Storage & CDN Setup${NC}"
echo "This script sets up one-time infrastructure."
echo "Save the output values to .env and GitHub Secrets."
echo ""

RESOURCE_GROUP="${RESOURCE_GROUP:-thinkdavid-portfolio}"
LOCATION="${LOCATION:-eastus}"
STORAGE_ACCOUNT="${STORAGE_ACCOUNT:-thinkdavidportfolio$(date +%s | tail -c 6)}"

echo -e "${YELLOW}Creating resource group...${NC}"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --query properties.provisioningState -o tsv

echo -e "${YELLOW}Creating storage account: $STORAGE_ACCOUNT${NC}"
az storage account create \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --access-tier Hot \
  --query provisioningState -o tsv

echo -e "${YELLOW}Creating container: images${NC}"
az storage container create \
  --name "images" \
  --account-name "$STORAGE_ACCOUNT" \
  --public-access blob

echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Save these values:"
echo -e "${GREEN}AZURE_STORAGE_ACCOUNT_NAME=${NC}$STORAGE_ACCOUNT"
az storage account show-connection-string \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --query connectionString \
  -o tsv | xargs -I {} echo -e "${GREEN}AZURE_STORAGE_CONNECTION_STRING=${NC}{}"
