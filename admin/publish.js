import { readFileFromHandle } from './fs.js'

const INDEX_ANCHOR = '<div role="list" class="work-list_list w-dyn-items">'
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'])
const WORK_PAGE_IGNORED_FILES = new Set(['work-page-with-variables.html', 'finalOutput.html'])
const LANDSCAPE_LIST_ANCHOR = '<div role="list" class="still_list w-dyn-items">'
const PORTRAIT_LIST_ANCHOR = '<div role="list" class="collection-list w-dyn-items w-row">'
const ARCHIVE_COLUMNS_ANCHOR = '<div class="w-row" data-archive-columns="true">'
const ARCHIVE_CATEGORY_VALUES = new Set(['portrait', 'landscape', 'nature', 'street', 'architecture', 'bw'])

function buildMarkerStructureError(workName) {
  return new Error(
    `Invalid marker folder structure. Expected ${workName}/landscape and ${workName}/portrait with at least one image each.`
  )
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function hasSlugEntry(indexHtml, slug) {
  const escapedSlug = escapeRegExp(slug)
  const slugPattern = new RegExp(
    `href=["'](?:https?:\\/\\/[^"'#?]+)?(?:\\.\\.?\\/|\\/)*work/${escapedSlug}(?:\\.html)?(?:["'/?#]|$)`,
    'i'
  )
  return slugPattern.test(indexHtml)
}

export function classifyMarkerPath(relativePath) {
  const normalized = relativePath.replace(/\\/g, '/').toLowerCase()
  const segments = normalized.split('/').filter(Boolean)
  if (segments.includes('landscape')) return 'landscape'
  if (segments.includes('portrait')) return 'portrait'
  return null
}

export function insertSnippetAtAnchor(indexHtml, snippetHtml) {
  const anchorIndex = indexHtml.indexOf(INDEX_ANCHOR)
  if (anchorIndex < 0) {
    throw new Error('Could not find index work-list anchor')
  }

  const insertPos = anchorIndex + INDEX_ANCHOR.length
  return `${indexHtml.slice(0, insertPos)}\n${snippetHtml}${indexHtml.slice(insertPos)}`
}

async function loadPublishDependencies() {
  const [{ readTextFile, writeTextFile }, { buildSnippetHtml, buildWorkPageHtml }] = await Promise.all([
    import('./fs.js'),
    import('./generator.js')
  ])

  return { readTextFile, writeTextFile, buildSnippetHtml, buildWorkPageHtml }
}

async function loadPublishBlobDependencies() {
  const [{ readFileFromHandle: readBinaryFile }, { uploadImageToBlob, getBlobCDNUrl }] = await Promise.all([
    import('./fs.js'),
    import('./blob-storage.js')
  ])
  return { readBinaryFile, uploadImageToBlob, getBlobCDNUrl }
}

async function listFilesFrom(dirHandle, prefix = '') {
  const out = []
  for await (const [name, handle] of dirHandle.entries()) {
    const extensionMatch = name.match(/\.([a-z0-9]+)$/i)
    const extension = extensionMatch?.[1]?.toLowerCase()
    if (handle.kind === 'file' && extension && IMAGE_EXTENSIONS.has(extension)) {
      out.push(`${prefix}${name}`)
    }
  }
  return out.sort((a, b) => a.localeCompare(b))
}

async function listImageFilesFrom(dirHandle, prefix = '') {
  return listFilesFrom(dirHandle, prefix)
}

function findDivClosingTagIndex(html, openDivStartIndex) {
  const tagPattern = /<div\b[^>]*>|<\/div>/g
  tagPattern.lastIndex = openDivStartIndex
  const firstTag = tagPattern.exec(html)
  if (!firstTag || !firstTag[0].startsWith('<div')) {
    return -1
  }

  let depth = 1
  let match
  while ((match = tagPattern.exec(html))) {
    if (match[0].startsWith('<div')) {
      depth += 1
      continue
    }

    depth -= 1
    if (depth === 0) {
      return match.index
    }
  }

  return -1
}

function appendItemsToListHtml(html, listAnchor, itemsHtml, label) {
  if (!itemsHtml.length) {
    return html
  }
  const anchorIndex = html.indexOf(listAnchor)
  if (anchorIndex < 0) {
    throw new Error(`Could not find ${label} gallery marker`)
  }

  const closeIndex = findDivClosingTagIndex(html, anchorIndex)
  if (closeIndex < 0) {
    throw new Error(`Could not find closing tag for ${label} gallery`)
  }

  const insertion = `\n${itemsHtml.join('\n')}\n`
  return `${html.slice(0, closeIndex)}${insertion}${html.slice(closeIndex)}`
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function normalizeArchiveCategory(category) {
  const normalized = String(category ?? '').trim().toLowerCase()
  if (!ARCHIVE_CATEGORY_VALUES.has(normalized)) {
    throw new Error(
      `Invalid archive category "${category}". Use one of: ${Array.from(ARCHIVE_CATEGORY_VALUES).join(', ')}.`
    )
  }
  return normalized
}

function normalizeArchiveColumnOverride(columnOverride, columnCount) {
  if (columnOverride === null || columnOverride === undefined || columnOverride === '') {
    return null
  }

  const numeric = Number(columnOverride)
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > columnCount) {
    throw new Error(`Column override must be an integer between 1 and ${columnCount}.`)
  }

  return numeric
}

function buildArchiveLightboxJson(photoUrl) {
  return JSON.stringify({
    items: [{ url: photoUrl, type: 'image' }],
    group: 'archive'
  }).replace(/<\//g, '<\\/')
}

function buildArchiveCardHtml(photoUrl, category) {
  const escapedUrl = escapeHtmlAttribute(photoUrl)
  const escapedCategory = escapeHtmlAttribute(category)
  const lightboxJson = buildArchiveLightboxJson(photoUrl)
  return `<a href="#" class="mix ${escapedCategory} w-inline-block w-lightbox"><img src="${escapedUrl}" loading="lazy" alt="" class="gallery-thumbnail ${escapedCategory}"><script type="application/json" class="w-json">${lightboxJson}</script></a>`
}

function collectArchiveColumns(html) {
  const rowIndex = html.indexOf(ARCHIVE_COLUMNS_ANCHOR)
  if (rowIndex < 0) {
    throw new Error('Could not find archive columns anchor')
  }

  const rowCloseIndex = findDivClosingTagIndex(html, rowIndex)
  if (rowCloseIndex < 0) {
    throw new Error('Could not find closing tag for archive columns')
  }

  const tagPattern = /<div\b[^>]*>|<\/div>/g
  tagPattern.lastIndex = rowIndex
  const rowOpen = tagPattern.exec(html)
  if (!rowOpen || !rowOpen[0].startsWith('<div')) {
    throw new Error('Could not parse archive columns row')
  }

  const columns = []
  let depth = 1
  let match
  while ((match = tagPattern.exec(html))) {
    if (match.index >= rowCloseIndex) {
      break
    }

    const token = match[0]
    if (token.startsWith('<div')) {
      depth += 1
      if (depth === 2 && /class="[^"]*\bw-col-3\b[^"]*"/.test(token)) {
        const openIndex = match.index
        const openEnd = openIndex + token.length
        const closeIndex = findDivClosingTagIndex(html, openIndex)
        if (closeIndex < 0) {
          throw new Error('Could not find closing tag for archive column')
        }
        const innerHtml = html.slice(openEnd, closeIndex)
        const itemCount = (innerHtml.match(/class="[^"]*\bmix\b[^"]*"/g) || []).length
        columns.push({ openEnd, itemCount })
      }
      continue
    }

    depth -= 1
    if (depth === 0) {
      break
    }
  }

  if (!columns.length) {
    throw new Error('Could not find archive columns')
  }

  return columns
}

function chooseArchiveColumn(columns, columnOverride) {
  if (columnOverride) {
    return columnOverride - 1
  }

  let bestIndex = 0
  let bestCount = columns[0].itemCount
  for (let index = 1; index < columns.length; index += 1) {
    if (columns[index].itemCount < bestCount) {
      bestIndex = index
      bestCount = columns[index].itemCount
    }
  }
  return bestIndex
}

function insertArchiveCardIntoColumns(archiveHtml, cardHtml, columnOverride = null) {
  const columns = collectArchiveColumns(archiveHtml)
  const normalizedOverride = normalizeArchiveColumnOverride(columnOverride, columns.length)
  const targetIndex = chooseArchiveColumn(columns, normalizedOverride)
  const targetColumn = columns[targetIndex]
  const insertion = `\n${cardHtml}\n`
  const nextHtml =
    `${archiveHtml.slice(0, targetColumn.openEnd)}` +
    `${insertion}` +
    `${archiveHtml.slice(targetColumn.openEnd)}`

  return { archiveHtml: nextHtml, insertedColumn: targetIndex + 1 }
}

function normalizeAppendPayload(payload = {}) {
  const slug = String(payload.slug ?? '').trim()
  const workName = String(payload.workName ?? '').trim() || slug
  const landscapePhotos = Array.isArray(payload.landscapePhotos) ? payload.landscapePhotos : []
  const portraitPhotos = Array.isArray(payload.portraitPhotos) ? payload.portraitPhotos : []

  if (!slug) {
    throw new Error('Slug is required to update an existing work page.')
  }

  if (!workName) {
    throw new Error('Work folder name is required to upload photos.')
  }

  if (!landscapePhotos.length && !portraitPhotos.length) {
    throw new Error('At least one landscape or portrait photo is required.')
  }

  return { slug, workName, landscapePhotos, portraitPhotos }
}

async function loadAppendDependencies() {
  const [{ readTextFile, writeTextFile, readFileFromHandle: readBinaryFile }, { buildLandscapeItem, buildPortraitItem }, blobStorage] = await Promise.all([
    import('./fs.js'),
    import('./generator.js'),
    import('./blob-storage.js')
  ])

  return {
    readTextFile,
    writeTextFile,
    readBinaryFile,
    buildLandscapeItem,
    buildPortraitItem,
    uploadImageToBlob: blobStorage.uploadImageToBlob,
    getBlobCDNUrl: blobStorage.getBlobCDNUrl
  }
}

async function loadHtmlUpdateDependencies() {
  const [{ readTextFile, writeTextFile }, { buildLandscapeItem, buildPortraitItem }] = await Promise.all([
    import('./fs.js'),
    import('./generator.js'),
  ])
  return { readTextFile, writeTextFile, buildLandscapeItem, buildPortraitItem }
}

async function loadArchiveDependencies() {
  const [{ readTextFile, writeTextFile }] = await Promise.all([import('./fs.js')])
  return { readTextFile, writeTextFile }
}

async function uploadPhotosAndResolveUrls(rootHandle, photoPaths, containerClient, readBinaryFile, uploadImageToBlob, getBlobCDNUrl) {
  if (!photoPaths.length) {
    return []
  }
  if (!containerClient) {
    throw new Error('Blob Storage container client is required for add-photos uploads.')
  }

  return Promise.all(
    photoPaths.map(async (localPath) => {
      const buffer = await readBinaryFile(rootHandle, localPath)
      await uploadImageToBlob(localPath, buffer, containerClient)
      return getBlobCDNUrl(localPath)
    })
  )
}

function uniqueMissingUrls(existingHtml, urls) {
  const seen = new Set()
  const output = []
  for (const url of urls) {
    if (!url || seen.has(url)) {
      continue
    }
    seen.add(url)
    if (!existingHtml.includes(url)) {
      output.push(url)
    }
  }
  return output
}

export async function listExistingWorkPages(rootHandle) {
  const workDir = await rootHandle.getDirectoryHandle('work')
  const pages = []

  for await (const [name, handle] of workDir.entries()) {
    if (handle.kind !== 'file' || !name.toLowerCase().endsWith('.html')) {
      continue
    }
    if (WORK_PAGE_IGNORED_FILES.has(name)) {
      continue
    }

    const slug = name.slice(0, -5)
    if (!slug) {
      continue
    }
    pages.push({ slug, filePath: `work/${name}` })
  }

  return pages.sort((a, b) => a.slug.localeCompare(b.slug))
}

export async function collectOrientationPhotoPaths(rootHandle, workName, orientation) {
  if (orientation !== 'landscape' && orientation !== 'portrait') {
    throw new Error(`Invalid orientation "${orientation}". Expected landscape or portrait.`)
  }

  const workDir = await rootHandle.getDirectoryHandle(workName)
  const orientationDir = await workDir.getDirectoryHandle(orientation)
  const photos = await listImageFilesFrom(orientationDir, `${workName}/${orientation}/`)

  if (!photos.length) {
    throw new Error(`No valid ${orientation} images found in ${workName}/${orientation}.`)
  }

  return photos
}

export async function appendPhotosToExistingWorkPage(rootHandle, payload, optionsOrContainerClient = {}) {
  const normalized = normalizeAppendPayload(payload)

  let loadDependencies = loadAppendDependencies
  let containerClient = null

  if (typeof optionsOrContainerClient === 'function') {
    loadDependencies = optionsOrContainerClient
  } else if (optionsOrContainerClient && typeof optionsOrContainerClient === 'object') {
    if ('loadDependencies' in optionsOrContainerClient && typeof optionsOrContainerClient.loadDependencies === 'function') {
      loadDependencies = optionsOrContainerClient.loadDependencies
    }

    if ('containerClient' in optionsOrContainerClient) {
      containerClient = optionsOrContainerClient.containerClient
    } else if (typeof optionsOrContainerClient.getBlockBlobClient === 'function') {
      containerClient = optionsOrContainerClient
    }
  }

  const {
    readTextFile,
    writeTextFile,
    readBinaryFile,
    buildLandscapeItem,
    buildPortraitItem,
    uploadImageToBlob,
    getBlobCDNUrl
  } = await loadDependencies()

  const workPath = `work/${normalized.slug}.html`
  const workHtml = await readTextFile(rootHandle, workPath)

  const landscapeUrls = uniqueMissingUrls(
    workHtml,
    await uploadPhotosAndResolveUrls(
      rootHandle,
      normalized.landscapePhotos,
      containerClient,
      readBinaryFile,
      uploadImageToBlob,
      getBlobCDNUrl
    )
  )
  const portraitUrls = uniqueMissingUrls(
    workHtml,
    await uploadPhotosAndResolveUrls(
      rootHandle,
      normalized.portraitPhotos,
      containerClient,
      readBinaryFile,
      uploadImageToBlob,
      getBlobCDNUrl
    )
  )

  if (!landscapeUrls.length && !portraitUrls.length) {
    throw new Error('All selected photos already exist in this work page.')
  }

  let nextHtml = workHtml
  nextHtml = appendItemsToListHtml(nextHtml, LANDSCAPE_LIST_ANCHOR, landscapeUrls.map(buildLandscapeItem), 'landscape')
  nextHtml = appendItemsToListHtml(nextHtml, PORTRAIT_LIST_ANCHOR, portraitUrls.map(buildPortraitItem), 'portrait')

  await writeTextFile(rootHandle, `${workPath}.backup`, workHtml)
  await writeTextFile(rootHandle, workPath, nextHtml)

  return {
    workPageHtml: nextHtml,
    appendedLandscapeCount: landscapeUrls.length,
    appendedPortraitCount: portraitUrls.length
  }
}

export async function collectPhotoPaths(rootHandle, workName) {
  try {
    const workDir = await rootHandle.getDirectoryHandle(workName)
    const landscapeDir = await workDir.getDirectoryHandle('landscape')
    const portraitDir = await workDir.getDirectoryHandle('portrait')
    const landscapePhotos = await listFilesFrom(landscapeDir, `${workName}/landscape/`)
    const portraitPhotos = await listFilesFrom(portraitDir, `${workName}/portrait/`)

    if (!landscapePhotos.length || !portraitPhotos.length) {
      throw buildMarkerStructureError(workName)
    }

    return { landscapePhotos, portraitPhotos }
  } catch (error) {
    if (error?.message?.startsWith('Invalid marker folder structure.')) {
      throw error
    }
    throw buildMarkerStructureError(workName)
  }
}

export async function publishWorkEntry(rootHandle, payload, loadDependenciesOrContainerClient = loadPublishDependencies) {
  // Support old testing interface (loadDependencies fn), containerClient, and options object.
  let loadDependencies = loadPublishDependencies
  let loadBlobDependencies = loadPublishBlobDependencies
  let containerClient = null
  const usingFunctionDepsOnly = typeof loadDependenciesOrContainerClient === 'function'
  const looksLikeContainerClient =
    loadDependenciesOrContainerClient &&
    typeof loadDependenciesOrContainerClient === 'object' &&
    (
      typeof loadDependenciesOrContainerClient.getBlockBlobClient === 'function' ||
      typeof loadDependenciesOrContainerClient.containerUrl === 'string'
    )
  
  if (typeof loadDependenciesOrContainerClient === 'function') {
    loadDependencies = loadDependenciesOrContainerClient
  } else if (looksLikeContainerClient) {
    containerClient = loadDependenciesOrContainerClient
  } else if (loadDependenciesOrContainerClient && typeof loadDependenciesOrContainerClient === 'object') {
    if (
      'loadDependencies' in loadDependenciesOrContainerClient &&
      typeof loadDependenciesOrContainerClient.loadDependencies === 'function'
    ) {
      loadDependencies = loadDependenciesOrContainerClient.loadDependencies
    }
    if (
      'loadBlobDependencies' in loadDependenciesOrContainerClient &&
      typeof loadDependenciesOrContainerClient.loadBlobDependencies === 'function'
    ) {
      loadBlobDependencies = loadDependenciesOrContainerClient.loadBlobDependencies
    }
    if ('containerClient' in loadDependenciesOrContainerClient) {
      containerClient = loadDependenciesOrContainerClient.containerClient
    }
  }

  if (!usingFunctionDepsOnly && !containerClient) {
    throw new Error('Blob Storage container client is required for publishing work entries.')
  }

  const { readTextFile, writeTextFile, buildSnippetHtml, buildWorkPageHtml } = await loadDependencies()
  const snippetTemplate = await readTextFile(rootHandle, 'workSnippetWithVariables.html')
  const workTemplate = await readTextFile(rootHandle, 'work/work-page-with-variables.html')
  
  let updatedPayload = { ...payload }

  // If containerClient provided, upload images to Blob Storage and update paths
  if (containerClient) {
    try {
      const { readBinaryFile, uploadImageToBlob, getBlobCDNUrl } = await loadBlobDependencies()
      const landscapePhotos = await Promise.all(
        payload.landscapePhotos.map(async (localPath) => {
          // Validate case-sensitive path
          if (!localPath.match(/^[a-zA-Z][a-zA-Z]*\/landscape\//)) {
            throw new Error(`Invalid landscape path format: ${localPath} (must be camelCase/landscape/)`)
          }
          
          const buffer = await readBinaryFile(rootHandle, localPath)
          await uploadImageToBlob(localPath, buffer, containerClient)
          return getBlobCDNUrl(localPath)
        })
      )
      
      const portraitPhotos = await Promise.all(
        payload.portraitPhotos.map(async (localPath) => {
          // Validate case-sensitive path
          if (!localPath.match(/^[a-zA-Z][a-zA-Z]*\/portrait\//)) {
            throw new Error(`Invalid portrait path format: ${localPath} (must be camelCase/portrait/)`)
          }
          
          const buffer = await readBinaryFile(rootHandle, localPath)
          await uploadImageToBlob(localPath, buffer, containerClient)
          return getBlobCDNUrl(localPath)
        })
      )
      
      const coverPhotoPath = getBlobCDNUrl(payload.coverPhotoPath)
      
      updatedPayload = {
        ...payload,
        coverPhotoPath,
        landscapePhotos,
        portraitPhotos
      }
    } catch (error) {
      throw new Error(`Blob upload failed: ${error.message}`)
    }
  }

  const snippetHtml = buildSnippetHtml(snippetTemplate, updatedPayload)
  const workPageHtml = buildWorkPageHtml(workTemplate, updatedPayload)
  const indexHtml = await readTextFile(rootHandle, 'index.html')
  const galleryHtml = await readTextFile(rootHandle, 'gallery.html')
  if (hasSlugEntry(indexHtml, payload.slug) || hasSlugEntry(galleryHtml, payload.slug)) {
    throw new Error(`Homepage already contains an entry for slug "${payload.slug}".`)
  }
  const updatedIndex = insertSnippetAtAnchor(indexHtml, snippetHtml)
  const updatedGallery = insertSnippetAtAnchor(galleryHtml, snippetHtml)

  await writeTextFile(rootHandle, 'index.html.backup', indexHtml)
  await writeTextFile(rootHandle, 'gallery.html.backup', galleryHtml)
  await writeTextFile(rootHandle, `work/${payload.slug}.html`, workPageHtml)
  await writeTextFile(rootHandle, 'index.html', updatedIndex)
  await writeTextFile(rootHandle, 'gallery.html', updatedGallery)

  return { snippetHtml, workPageHtml }
}

export async function appendCdnUrlsToWorkPage(rootHandle, payload, loadDependencies = loadHtmlUpdateDependencies) {
  const slug = String(payload?.slug ?? '').trim()
  const landscapeCdnUrls = Array.isArray(payload?.landscapeCdnUrls) ? payload.landscapeCdnUrls : []
  const portraitCdnUrls = Array.isArray(payload?.portraitCdnUrls) ? payload.portraitCdnUrls : []

  if (!slug) {
    throw new Error('Slug is required to update an existing work page.')
  }
  if (!landscapeCdnUrls.length && !portraitCdnUrls.length) {
    throw new Error('At least one photo URL is required.')
  }

  const { readTextFile, writeTextFile, buildLandscapeItem, buildPortraitItem } = await loadDependencies()
  const workPath = `work/${slug}.html`
  const workHtml = await readTextFile(rootHandle, workPath)

  const newLandscapeUrls = uniqueMissingUrls(workHtml, landscapeCdnUrls)
  const newPortraitUrls = uniqueMissingUrls(workHtml, portraitCdnUrls)

  if (!newLandscapeUrls.length && !newPortraitUrls.length) {
    throw new Error('All selected photos already exist in this work page.')
  }

  let nextHtml = workHtml
  nextHtml = appendItemsToListHtml(nextHtml, LANDSCAPE_LIST_ANCHOR, newLandscapeUrls.map(buildLandscapeItem), 'landscape')
  nextHtml = appendItemsToListHtml(nextHtml, PORTRAIT_LIST_ANCHOR, newPortraitUrls.map(buildPortraitItem), 'portrait')

  await writeTextFile(rootHandle, `${workPath}.backup`, workHtml)
  await writeTextFile(rootHandle, workPath, nextHtml)

  return {
    workPageHtml: nextHtml,
    appendedLandscapeCount: newLandscapeUrls.length,
    appendedPortraitCount: newPortraitUrls.length,
  }
}

export async function appendPhotoToArchive(rootHandle, payload, loadDependencies = loadArchiveDependencies) {
  const photoUrl = String(payload?.photoUrl ?? '').trim()
  const category = normalizeArchiveCategory(payload?.category)
  const columnOverride = payload?.columnOverride ?? null

  if (!photoUrl) {
    throw new Error('Photo URL is required.')
  }

  const { readTextFile, writeTextFile } = await loadDependencies()
  const archiveHtml = await readTextFile(rootHandle, 'archive.html')

  if (archiveHtml.includes(photoUrl)) {
    throw new Error('This photo already exists in archive.html.')
  }

  const cardHtml = buildArchiveCardHtml(photoUrl, category)
  const result = insertArchiveCardIntoColumns(archiveHtml, cardHtml, columnOverride)

  await writeTextFile(rootHandle, 'archive.html.backup', archiveHtml)
  await writeTextFile(rootHandle, 'archive.html', result.archiveHtml)

  return {
    archiveHtml: result.archiveHtml,
    insertedColumn: result.insertedColumn,
    category
  }
}
