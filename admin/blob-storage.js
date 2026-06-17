import { readTextFile } from './fs.js'

let cachedBlobConfig = null

function parseConnectionString(connectionString) {
  const parts = String(connectionString || '')
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)

  const map = {}
  for (const part of parts) {
    const separator = part.indexOf('=')
    if (separator <= 0) continue
    map[part.slice(0, separator)] = part.slice(separator + 1)
  }

  return {
    accountName: map.AccountName || '',
    accountKey: map.AccountKey || '',
    blobEndpoint: map.BlobEndpoint || '',
  }
}

function parseEnvValue(rawValue) {
  const trimmed = rawValue.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseDotEnv(contents) {
  const out = {}
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex < 0) continue
    const key = trimmed.slice(0, separatorIndex).trim()
    if (!key) continue
    const value = parseEnvValue(trimmed.slice(separatorIndex + 1))
    out[key] = value
  }
  return out
}

function readConfigFromNodeEnv() {
  if (typeof process === 'undefined' || !process.env) {
    return null
  }
  return {
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    containerName: process.env.AZURE_STORAGE_CONTAINER_NAME || 'images',
    cdnHostname: process.env.AZURE_CDN_HOSTNAME,
    accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
    accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
    sasToken: process.env.AZURE_STORAGE_SAS_TOKEN,
  }
}

function validateBlobConfig(config) {
  const connectionString = String(config?.connectionString ?? '').trim()
  const accountName = String(config?.accountName ?? '').trim()
  const sasToken = String(config?.sasToken ?? '').trim().replace(/^\?/, '')
  const containerName = String(config?.containerName ?? 'images').trim() || 'images'
  const cdnHostname = String(config?.cdnHostname ?? '').trim()

  const parsed = parseConnectionString(connectionString)
  const resolvedAccountName = accountName || parsed.accountName
  const blobEndpoint =
    String(config?.blobEndpoint ?? '').trim() ||
    parsed.blobEndpoint ||
    (resolvedAccountName ? `https://${resolvedAccountName}.blob.core.windows.net` : '')

  const hasSasAuth = Boolean(resolvedAccountName && sasToken)
  if (!hasSasAuth) {
    throw new Error(
      'Blob auth missing for browser upload. Set AZURE_STORAGE_ACCOUNT_NAME and AZURE_STORAGE_SAS_TOKEN in .env.'
    )
  }
  if (!cdnHostname) {
    throw new Error('AZURE_CDN_HOSTNAME is required for Blob uploads')
  }

  return {
    accountName: resolvedAccountName,
    sasToken,
    blobEndpoint,
    containerName,
    cdnHostname,
  }
}

async function readBlobConfig(rootHandle) {
  if (cachedBlobConfig) {
    return cachedBlobConfig
  }

  if (rootHandle) {
    try {
      const envText = await readTextFile(rootHandle, '.env')
      const env = parseDotEnv(envText)
      cachedBlobConfig = validateBlobConfig({
        connectionString: env.AZURE_STORAGE_CONNECTION_STRING,
        containerName: env.AZURE_STORAGE_CONTAINER_NAME,
        cdnHostname: env.AZURE_CDN_HOSTNAME,
        accountName: env.AZURE_STORAGE_ACCOUNT_NAME,
        accountKey: env.AZURE_STORAGE_ACCOUNT_KEY,
        sasToken: env.AZURE_STORAGE_SAS_TOKEN,
      })
      return cachedBlobConfig
    } catch {
      // Fall through to Node env fallback for non-browser/test contexts.
    }
  }

  const envConfig = readConfigFromNodeEnv()
  if (envConfig?.cdnHostname) {
    cachedBlobConfig = validateBlobConfig(envConfig)
    return cachedBlobConfig
  }

  throw new Error(
    'Blob config not found. Add AZURE_CDN_HOSTNAME and either account key or SAS settings to the repo root .env file.'
  )
}

export async function uploadImageToBlob(filePath, fileBuffer, containerClient) {
  // Validate case-sensitive path
  const blobName = filePath // e.g., "peopleOfSicily/landscape/photo.jpg"
  
  // Verify path uses correct case - reject if passed as lowercase
  if (blobName !== blobName.trim()) {
    throw new Error(`Invalid blob path: whitespace in "${blobName}"`)
  }

  const encodedBlobName = blobName
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  const sas = String(containerClient.sasToken || '').replace(/^\?/, '')
  const uploadUrl = `${containerClient.containerUrl}/${encodedBlobName}?${sas}`

  let response
  try {
    response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'x-ms-version': '2023-11-03',
        'x-ms-blob-cache-control': 'public, max-age=31536000',
        'Content-Type': getMimeType(fileBuffer, filePath),
      },
      body: fileBuffer,
    })
  } catch (error) {
    if (error?.name === 'TypeError') {
      throw new Error(
        'Network/CORS blocked Blob upload. Verify Azure Blob CORS allows PUT, OPTIONS from your origin.'
      )
    }
    throw error
  }
  if (!response.ok) {
    const message = await response.text().catch(() => '')
    throw new Error(`Blob upload failed (${response.status}): ${message || response.statusText}`)
  }
  
  return blobName
}

export function getMimeType(buffer, filePath) {
  const ext = filePath.toLowerCase().split('.').pop()
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    gif: 'image/gif'
  }
  return mimeTypes[ext] || 'image/jpeg'
}

export async function createBlobContainerClient(rootHandle = null) {
  const { sasToken, blobEndpoint, containerName } = await readBlobConfig(rootHandle)
  const serviceUrl = String(blobEndpoint || '').replace(/\/$/, '')
  return {
    containerUrl: `${serviceUrl}/${encodeURIComponent(containerName)}`,
    sasToken: sasToken.replace(/^\?/, ''),
  }
}

export function getBlobCDNUrl(blobName) {
  const cdnHostname =
    cachedBlobConfig?.cdnHostname ||
    (typeof process !== 'undefined' ? process.env?.AZURE_CDN_HOSTNAME : '')
  const containerName =
    cachedBlobConfig?.containerName ||
    (typeof process !== 'undefined' ? process.env?.AZURE_STORAGE_CONTAINER_NAME : '') ||
    'images'
  if (!cdnHostname) {
    throw new Error('AZURE_CDN_HOSTNAME is not configured for Blob uploads')
  }
  const normalizedBlobName = String(blobName || '').replace(/^\/+/, '')
  return `https://${cdnHostname}/${encodeURIComponent(containerName)}/${normalizedBlobName}`
}
