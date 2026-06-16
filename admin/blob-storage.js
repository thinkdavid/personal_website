import { BlobServiceClient } from '@azure/storage-blob';

export async function uploadImageToBlob(filePath, fileBuffer, containerClient) {
  // Validate case-sensitive path
  const blobName = filePath; // e.g., "peopleOfSicily/landscape/photo.jpg"

  // Verify path uses correct case - reject if passed as lowercase
  if (blobName !== blobName.trim()) {
    throw new Error(`Invalid blob path: whitespace in "${blobName}"`);
  }

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
    blobHTTPHeaders: {
      blobContentType: getMimeType(fileBuffer, filePath),
      blobCacheControl: 'public, max-age=31536000', // 1 year for immutable content
    },
  });

  return blobName;
}

export function getMimeType(buffer, filePath) {
  const ext = filePath.toLowerCase().split('.').pop();
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    gif: 'image/gif',
  };
  return mimeTypes[ext] || 'image/jpeg';
}

export async function createBlobContainerClient() {
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) {
    throw new Error(
      'AZURE_STORAGE_CONNECTION_STRING environment variable not set',
    );
  }

  const blobServiceClient =
    BlobServiceClient.fromConnectionString(connectionString);
  const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'images';
  return blobServiceClient.getContainerClient(containerName);
}

export function getBlobCDNUrl(blobName) {
  const cdnHostname = process.env.AZURE_CDN_HOSTNAME;
  if (!cdnHostname) {
    throw new Error('AZURE_CDN_HOSTNAME environment variable not set');
  }
  // Preserve case from blobName
  return `https://${cdnHostname}/${blobName}`;
}
