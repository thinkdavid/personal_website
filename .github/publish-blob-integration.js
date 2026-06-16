// Updated publish.js snippet - integration with Blob Storage uploads
// This shows the key changes to add blob storage support

import {
  uploadImageToBlob,
  createBlobContainerClient,
  getBlobCDNUrl,
} from './blob-storage.js';

export async function publishWorkEntry(rootHandle, payload, containerClient) {
  // Validate case-sensitive path in payload
  if (payload.slug && payload.slug !== payload.slug.toLowerCase()) {
    console.warn(`Note: slug uses mixed case: ${payload.slug}`);
  }

  // If containerClient provided, upload images to Blob Storage and update paths
  if (containerClient) {
    try {
      const landscapePhotos = await Promise.all(
        payload.landscapePhotos.map(async (localPath) => {
          // Validate case-sensitive path
          if (!localPath.match(/^[a-zA-Z][a-zA-Z]*\/landscape\//)) {
            throw new Error(
              `Invalid landscape path format: ${localPath} (must be camelCase/landscape/)`,
            );
          }

          const buffer = await readFileFromHandle(rootHandle, localPath);
          await uploadImageToBlob(localPath, buffer, containerClient);
          return getBlobCDNUrl(localPath);
        }),
      );

      const portraitPhotos = await Promise.all(
        payload.portraitPhotos.map(async (localPath) => {
          // Validate case-sensitive path
          if (!localPath.match(/^[a-zA-Z][a-zA-Z]*\/portrait\//)) {
            throw new Error(
              `Invalid portrait path format: ${localPath} (must be camelCase/portrait/)`,
            );
          }

          const buffer = await readFileFromHandle(rootHandle, localPath);
          await uploadImageToBlob(localPath, buffer, containerClient);
          return getBlobCDNUrl(localPath);
        }),
      );

      const coverPhotoPath = getBlobCDNUrl(payload.coverPhotoPath);

      // Use CDN paths for HTML generation
      const { snippetHtml, workPageHtml } = await generateWorkHTML({
        ...payload,
        coverPhotoPath,
        landscapePhotos,
        portraitPhotos,
      });

      return { snippetHtml, workPageHtml, landscapePhotos, portraitPhotos };
    } catch (error) {
      throw new Error(`Blob upload failed: ${error.message}`);
    }
  }

  // Fallback to local publishing if no Blob Storage
  const { snippetHtml, workPageHtml } = await generateWorkHTML(payload);
  return { snippetHtml, workPageHtml };
}
