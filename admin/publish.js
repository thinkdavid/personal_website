const INDEX_ANCHOR = '<div role="list" class="work-list_list w-dyn-items">'
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif'])

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

export async function publishWorkEntry(rootHandle, payload, loadDependencies = loadPublishDependencies) {
  const { readTextFile, writeTextFile, buildSnippetHtml, buildWorkPageHtml } = await loadDependencies()
  const snippetTemplate = await readTextFile(rootHandle, 'workSnippetWithVariables.html')
  const workTemplate = await readTextFile(rootHandle, 'work/work-page-with-variables.html')
  const snippetHtml = buildSnippetHtml(snippetTemplate, payload)
  const workPageHtml = buildWorkPageHtml(workTemplate, payload)
  const indexHtml = await readTextFile(rootHandle, 'index.html')
  if (hasSlugEntry(indexHtml, payload.slug)) {
    throw new Error(`Homepage already contains an entry for slug "${payload.slug}".`)
  }
  const updatedIndex = insertSnippetAtAnchor(indexHtml, snippetHtml)

  await writeTextFile(rootHandle, 'index.html.backup', indexHtml)
  await writeTextFile(rootHandle, `work/${payload.slug}.html`, workPageHtml)
  await writeTextFile(rootHandle, 'index.html', updatedIndex)

  return { snippetHtml, workPageHtml }
}
