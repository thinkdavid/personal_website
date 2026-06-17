import { pickProjectRoot } from './fs.js'
import { appendCdnUrlsToWorkPage, listExistingWorkPages } from './publish.js'

const IMAGE_ACCEPT = { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'] }

const el = {
  pickRoot: document.getElementById('pickRoot'),
  addPhotos: document.getElementById('addPhotos'),
  status: document.getElementById('status'),
  rootLabel: document.getElementById('rootLabel'),
  workSelect: document.getElementById('workSelect'),
  blobFolder: document.getElementById('blobFolder'),
  pickLandscape: document.getElementById('pickLandscape'),
  clearLandscape: document.getElementById('clearLandscape'),
  landscapeSummary: document.getElementById('landscapeSummary'),
  pickPortrait: document.getElementById('pickPortrait'),
  clearPortrait: document.getElementById('clearPortrait'),
  portraitSummary: document.getElementById('portraitSummary'),
  resultPreview: document.getElementById('resultPreview'),
  fieldErrors: document.querySelectorAll('[data-error-for]'),
}

const state = {
  rootHandle: null,
  isRunning: false,
  workPages: [],
  containerClient: null,
  landscapeFiles: [],
  portraitFiles: [],
}

function setStatus(message, tone = 'info') {
  el.status.textContent = message
  el.status.dataset.tone = tone
}

function setFieldError(name, message = '') {
  const target = document.querySelector(`[data-error-for="${name}"]`)
  if (target) target.textContent = message
}

function clearErrors() {
  el.fieldErrors.forEach((node) => {
    node.textContent = ''
  })
}

function showBrowserSupportGuard() {
  if (!window.showDirectoryPicker) {
    el.pickRoot.disabled = true
    el.addPhotos.disabled = true
    setStatus('This browser does not support the File System Access API. Use Chrome or Edge.', 'error')
    return false
  }
  return true
}

function summarizeFiles(fileHandles) {
  if (!fileHandles.length) return 'No photos selected'
  const names = fileHandles.map((h) => h.name).join(', ')
  return `${fileHandles.length} photo${fileHandles.length === 1 ? '' : 's'}: ${names}`
}

function updatePickerSummary(orientation) {
  const files = orientation === 'landscape' ? state.landscapeFiles : state.portraitFiles
  const listEl = orientation === 'landscape' ? el.landscapeSummary : el.portraitSummary
  const clearBtn = orientation === 'landscape' ? el.clearLandscape : el.clearPortrait

  if (!files.length) {
    listEl.innerHTML = '<li class="file-list-empty">No photos selected</li>'
  } else {
    listEl.innerHTML = files
      .map(
        (h) =>
          `<li class="file-list-item" data-orientation="${orientation}" data-name="${h.name}">
            <span class="file-list-name">${h.name}</span>
            <button type="button" class="btn-remove" aria-label="Remove ${h.name}">✕</button>
          </li>`
      )
      .join('')
  }
  clearBtn.hidden = files.length === 0
}

async function pickFiles(orientation) {
  try {
    const handles = await window.showOpenFilePicker({
      multiple: true,
      types: [{ description: 'Images', accept: IMAGE_ACCEPT }],
    })
    const existing = orientation === 'landscape' ? state.landscapeFiles : state.portraitFiles
    const existingNames = new Set(existing.map((h) => h.name))
    const newHandles = handles.filter((h) => !existingNames.has(h.name))
    const merged = [...existing, ...newHandles]
    if (orientation === 'landscape') {
      state.landscapeFiles = merged
    } else {
      state.portraitFiles = merged
    }
    updatePickerSummary(orientation)
  } catch (err) {
    if (err.name !== 'AbortError') {
      setStatus(`Error picking ${orientation} photos: ${err.message}`, 'error')
    }
  }
}

function clearFiles(orientation) {
  if (orientation === 'landscape') {
    state.landscapeFiles = []
  } else {
    state.portraitFiles = []
  }
  updatePickerSummary(orientation)
}

function removeFile(orientation, name) {
  if (orientation === 'landscape') {
    state.landscapeFiles = state.landscapeFiles.filter((h) => h.name !== name)
  } else {
    state.portraitFiles = state.portraitFiles.filter((h) => h.name !== name)
  }
  updatePickerSummary(orientation)
}

function renderWorkOptions(pages) {
  const options = ['<option value="">Select work page</option>']
  pages.forEach((page) => {
    options.push(`<option value="${page.slug}">${page.slug}</option>`)
  })
  el.workSelect.innerHTML = options.join('\n')
  el.workSelect.disabled = pages.length === 0
}

function readForm() {
  const slug = el.workSelect.value.trim()
  const blobFolderInput = el.blobFolder.value.trim()
  return {
    slug,
    blobFolder: blobFolderInput || slug,
  }
}

function validateForm(data) {
  clearErrors()
  let valid = true

  if (!data.slug) {
    setFieldError('workSelect', 'Select an existing work page.')
    valid = false
  }

  if (!state.landscapeFiles.length && !state.portraitFiles.length) {
    setFieldError('landscape', 'Pick at least one landscape or portrait photo.')
    valid = false
  }

  return valid
}

async function ensureBlobContainerClient() {
  if (state.containerClient) return state.containerClient
  const { createBlobContainerClient } = await import('./blob-storage.js')
  state.containerClient = await createBlobContainerClient(state.rootHandle)
  return state.containerClient
}

async function uploadFilesToBlob(fileHandles, blobFolder, orientation, containerClient) {
  if (!fileHandles.length) return []
  const { uploadImageToBlob, getBlobCDNUrl } = await import('./blob-storage.js')
  return Promise.all(
    fileHandles.map(async (handle) => {
      const file = await handle.getFile()
      const buffer = await file.arrayBuffer()
      const blobKey = `${blobFolder}/${orientation}/${handle.name}`
      await uploadImageToBlob(blobKey, buffer, containerClient)
      return getBlobCDNUrl(blobKey)
    })
  )
}

async function loadWorkPages() {
  const pages = await listExistingWorkPages(state.rootHandle)
  state.workPages = pages
  renderWorkOptions(pages)
  if (!pages.length) {
    setStatus('No existing work pages found in /work.', 'error')
    return
  }
  setStatus('Project folder selected. Choose a work page and pick photos.', 'success')
}

async function selectRoot() {
  try {
    state.rootHandle = await pickProjectRoot()
    el.rootLabel.textContent = state.rootHandle?.name || 'Selected folder'
    el.resultPreview.value = ''
    await loadWorkPages()
    el.addPhotos.disabled = false
  } catch (error) {
    setStatus(error.message, 'error')
  }
}

async function addPhotos() {
  if (state.isRunning) {
    setStatus('Photo update already in progress. Please wait...', 'info')
    return
  }
  if (!state.rootHandle) {
    setStatus('Select the project folder first.', 'error')
    return
  }

  const data = readForm()
  if (!validateForm(data)) {
    setStatus('Fix the field errors before adding photos.', 'error')
    return
  }

  state.isRunning = true
  el.addPhotos.disabled = true

  try {
    setStatus('Uploading to Azure Blob Storage...', 'info')
    const containerClient = await ensureBlobContainerClient()
    const [landscapeCdnUrls, portraitCdnUrls] = await Promise.all([
      uploadFilesToBlob(state.landscapeFiles, data.blobFolder, 'landscape', containerClient),
      uploadFilesToBlob(state.portraitFiles, data.blobFolder, 'portrait', containerClient),
    ])

    setStatus('Updating work page...', 'info')
    const result = await appendCdnUrlsToWorkPage(state.rootHandle, {
      slug: data.slug,
      landscapeCdnUrls,
      portraitCdnUrls,
    })

    el.resultPreview.value = result.workPageHtml
    setStatus(
      `Updated "${data.slug}" — added ${result.appendedLandscapeCount} landscape and ${result.appendedPortraitCount} portrait photos.`,
      'success'
    )
  } catch (error) {
    setStatus(`Error: ${error.message}`, 'error')
    console.error('Add photos error:', error)
  } finally {
    state.isRunning = false
    el.addPhotos.disabled = !state.rootHandle
  }
}

function wireEvents() {
  el.pickRoot.addEventListener('click', selectRoot)
  el.addPhotos.addEventListener('click', addPhotos)
  el.pickLandscape.addEventListener('click', () => pickFiles('landscape'))
  el.clearLandscape.addEventListener('click', () => clearFiles('landscape'))
  el.pickPortrait.addEventListener('click', () => pickFiles('portrait'))
  el.clearPortrait.addEventListener('click', () => clearFiles('portrait'))

  // Remove individual file via event delegation on both lists
  ;[el.landscapeSummary, el.portraitSummary].forEach((listEl) => {
    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-remove')
      if (!btn) return
      const li = btn.closest('[data-orientation]')
      removeFile(li.dataset.orientation, li.dataset.name)
    })
  })
}

function initializeDefaults() {
  el.addPhotos.disabled = true
  el.resultPreview.value = ''
  updatePickerSummary('landscape')
  updatePickerSummary('portrait')
}

if (showBrowserSupportGuard()) {
  initializeDefaults()
  wireEvents()
  setStatus('Select the project folder to begin.', 'info')
}
