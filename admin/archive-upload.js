import { pickProjectRoot } from './fs.js'
import { appendPhotoToArchive } from './publish.js'

const IMAGE_ACCEPT = { 'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif'] }

const el = {
  pickRoot: document.getElementById('pickRoot'),
  pickPhoto: document.getElementById('pickPhoto'),
  upload: document.getElementById('upload'),
  status: document.getElementById('status'),
  rootLabel: document.getElementById('rootLabel'),
  photoSummary: document.getElementById('photoSummary'),
  category: document.getElementById('category'),
  columnOverride: document.getElementById('columnOverride'),
  resultPreview: document.getElementById('resultPreview'),
  fieldErrors: document.querySelectorAll('[data-error-for]'),
}

const state = {
  rootHandle: null,
  isUploading: false,
  containerClient: null,
  selectedFileHandle: null,
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
  if (!window.showDirectoryPicker || !window.showOpenFilePicker) {
    el.pickRoot.disabled = true
    el.pickPhoto.disabled = true
    el.upload.disabled = true
    setStatus('This browser does not support the File System Access API. Use Chrome or Edge.', 'error')
    return false
  }
  return true
}

function updatePhotoSummary() {
  el.photoSummary.textContent = state.selectedFileHandle
    ? `Selected: ${state.selectedFileHandle.name}`
    : 'No photo selected'
}

function readForm() {
  const category = el.category.value.trim().toLowerCase()
  const rawColumnOverride = el.columnOverride.value.trim()
  return {
    category,
    columnOverride: rawColumnOverride ? Number(rawColumnOverride) : null,
  }
}

function validateForm(data) {
  clearErrors()
  let valid = true

  if (!state.selectedFileHandle) {
    setFieldError('photo', 'Pick one photo to upload.')
    valid = false
  }

  if (!data.category) {
    setFieldError('category', 'Category is required.')
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

async function selectRoot() {
  try {
    state.rootHandle = await pickProjectRoot()
    el.rootLabel.textContent = state.rootHandle?.name || 'Selected folder'
    el.upload.disabled = false
    setStatus('Project folder selected. Pick a photo to upload.', 'success')
  } catch (error) {
    setStatus(error.message, 'error')
  }
}

async function pickPhoto() {
  try {
    const [handle] = await window.showOpenFilePicker({
      multiple: false,
      types: [{ description: 'Images', accept: IMAGE_ACCEPT }],
    })
    state.selectedFileHandle = handle || null
    updatePhotoSummary()
  } catch (error) {
    if (error.name !== 'AbortError') {
      setStatus(`Error picking photo: ${error.message}`, 'error')
    }
  }
}

async function uploadArchivePhoto() {
  if (state.isUploading) {
    setStatus('Upload already in progress. Please wait...', 'info')
    return
  }

  if (!state.rootHandle) {
    setStatus('Select the project folder first.', 'error')
    return
  }

  const data = readForm()
  if (!validateForm(data)) {
    setStatus('Fix the field errors before uploading.', 'error')
    return
  }

  state.isUploading = true
  el.upload.disabled = true

  try {
    setStatus('Uploading photo to Azure Blob Storage...', 'info')
    const containerClient = await ensureBlobContainerClient()
    const { uploadImageToBlob, getBlobCDNUrl } = await import('./blob-storage.js')

    const file = await state.selectedFileHandle.getFile()
    const buffer = await file.arrayBuffer()
    const blobKey = `archive/${state.selectedFileHandle.name}`
    await uploadImageToBlob(blobKey, buffer, containerClient)
    const photoUrl = getBlobCDNUrl(blobKey)

    setStatus('Updating archive page...', 'info')
    const result = await appendPhotoToArchive(state.rootHandle, {
      photoUrl,
      category: data.category,
      columnOverride: data.columnOverride,
    })

    el.resultPreview.value = result.archiveHtml
    setStatus(
      `Uploaded ${state.selectedFileHandle.name} to archive (${result.category}) in column ${result.insertedColumn}.`,
      'success'
    )
  } catch (error) {
    setStatus(`Error: ${error.message}`, 'error')
    console.error('Archive upload error:', error)
  } finally {
    state.isUploading = false
    el.upload.disabled = !state.rootHandle
  }
}

function wireEvents() {
  el.pickRoot.addEventListener('click', selectRoot)
  el.pickPhoto.addEventListener('click', pickPhoto)
  el.upload.addEventListener('click', uploadArchivePhoto)
}

function initializeDefaults() {
  el.upload.disabled = true
  el.resultPreview.value = ''
  updatePhotoSummary()
}

if (showBrowserSupportGuard()) {
  initializeDefaults()
  wireEvents()
  setStatus('Select the project folder to begin.', 'info')
}
