import { slugify } from './generator.js'
import { pickProjectRoot } from './fs.js'
import { collectPhotoPaths, publishWorkEntry } from './publish.js'

const el = {
  form: document.getElementById('photoForm'),
  pickRoot: document.getElementById('pickRoot'),
  generate: document.getElementById('generate'),
  status: document.getElementById('status'),
  rootLabel: document.getElementById('rootLabel'),
  title: document.getElementById('title'),
  subtitle: document.getElementById('subtitle'),
  caption: document.getElementById('caption'),
  slug: document.getElementById('slug'),
  workName: document.getElementById('workName'),
  snippetPreview: document.getElementById('snippetPreview'),
  pagePreview: document.getElementById('pagePreview'),
  fieldErrors: document.querySelectorAll('[data-error-for]'),
}

const state = {
  rootHandle: null,
  slugAuto: true,
  isPublishing: false,
}

function setStatus(message, tone = 'info') {
  el.status.textContent = message
  el.status.dataset.tone = tone
}

function setFieldError(name, message = '') {
  const target = document.querySelector(`[data-error-for="${name}"]`)
  if (target) {
    target.textContent = message
  }
}

function clearErrors() {
  el.fieldErrors.forEach((node) => {
    node.textContent = ''
  })
}

function showBrowserSupportGuard() {
  if (!window.showDirectoryPicker) {
    el.pickRoot.disabled = true
    el.generate.disabled = true
    setStatus('This browser does not support the File System Access API. Use Chrome or Edge.', 'error')
    return false
  }

  return true
}

function syncSlugFromTitle() {
  if (!state.slugAuto) {
    return
  }

  el.slug.value = slugify(el.title.value)
}

function readForm() {
  const title = el.title.value.trim()
  const subtitle = el.subtitle.value.trim()
  const caption = el.caption.value.trim()
  const slugValue = slugify(el.slug.value.trim() || title)
  const workNameInput = el.workName.value.trim()
  const workName = workNameInput ? slugify(workNameInput) : slugValue

  return {
    title,
    subtitle,
    caption,
    slugValue,
    workNameInput,
    workName,
  }
}

function validateForm() {
  clearErrors()
  const data = readForm()
  let valid = true

  if (!data.title) {
    setFieldError('title', 'Title is required.')
    valid = false
  }

  if (!data.subtitle) {
    setFieldError('subtitle', 'Subtitle is required.')
    valid = false
  }

  if (!data.slugValue) {
    setFieldError('slug', 'Slug cannot be empty after sanitizing the title.')
    valid = false
  }

  if (data.workNameInput && !data.workName) {
    setFieldError('workName', 'Work folder name is invalid after sanitizing. Use letters and numbers.')
    valid = false
  }

  return valid ? data : null
}

async function generate() {
  if (state.isPublishing) {
    setStatus('Publish already in progress. Please wait...', 'info')
    return
  }

  if (!state.rootHandle) {
    setStatus('Select the project folder before generating.', 'error')
    return
  }

  const data = validateForm()
  if (!data) {
    setStatus('Fix the field errors before generating.', 'error')
    return
  }

  state.isPublishing = true
  el.generate.disabled = true

  try {
    const { createBlobContainerClient } = await import('./blob-storage.js')
    setStatus('Connecting to Azure Blob Storage...', 'info')
    const containerClient = await createBlobContainerClient(state.rootHandle)
    
    const { landscapePhotos, portraitPhotos } = await collectPhotoPaths(state.rootHandle, data.workName)
    const payload = {
      title: data.title,
      subtitle: data.subtitle,
      caption: data.caption,
      slug: data.slugValue,
      coverPhotoPath: landscapePhotos[0],
      landscapePhotos,
      portraitPhotos,
    }
    
    setStatus('Uploading images to Azure Blob Storage and publishing...', 'info')
    const { snippetHtml, workPageHtml } = await publishWorkEntry(state.rootHandle, payload, containerClient)

    el.snippetPreview.value = snippetHtml
    el.pagePreview.value = workPageHtml
    
    setStatus(`Published "${data.slugValue}" with images uploaded to Azure Blob Storage + CDN.`, 'success')
  } catch (error) {
    setStatus(`Error: ${error.message}`, 'error')
    console.error('Publish error:', error)
  } finally {
    state.isPublishing = false
    el.generate.disabled = !state.rootHandle
  }
}

async function selectRoot() {
  try {
    state.rootHandle = await pickProjectRoot()
    el.snippetPreview.value = ''
    el.pagePreview.value = ''
    el.rootLabel.textContent = state.rootHandle?.name || 'Selected folder'
    el.generate.disabled = false
    setStatus('Project folder selected. Generate and publish when ready.', 'success')
  } catch (error) {
    setStatus(error.message, 'error')
  }
}

function wireEvents() {
  el.pickRoot.addEventListener('click', selectRoot)
  el.generate.addEventListener('click', () => {
    generate()
  })

  el.title.addEventListener('input', () => {
    syncSlugFromTitle()
  })

  el.slug.addEventListener('input', () => {
    state.slugAuto = el.slug.value.trim() === '' || el.slug.value.trim() === slugify(el.title.value)
  })
}

function initializeDefaults() {
  el.slug.value = ''
  el.workName.value = ''
  el.generate.disabled = true
  el.snippetPreview.value = ''
  el.pagePreview.value = ''
  syncSlugFromTitle()
}

if (showBrowserSupportGuard()) {
  initializeDefaults()
  wireEvents()
  setStatus('Select the project folder to begin.', 'info')
}
