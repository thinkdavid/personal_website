// Updated app.js snippet - Blob Storage integration in generate()

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
    let containerClient = null
    let uploadMethod = 'repository'
    
    // Check if Azure Blob Storage is configured
    if (typeof process !== 'undefined' && process.env.AZURE_STORAGE_CONNECTION_STRING) {
      try {
        setStatus('Uploading images to Azure Blob Storage...', 'info')
        containerClient = await createBlobContainerClient()
        uploadMethod = 'Azure Blob Storage + CDN'
      } catch (error) {
        console.warn('Blob Storage not available, falling back to repository:', error.message)
        setStatus('Warning: Blob Storage unavailable, using repository upload', 'warn')
      }
    }
    
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
    
    setStatus('Generating HTML and publishing...', 'info')
    const { snippetHtml, workPageHtml } = await publishWorkEntry(state.rootHandle, payload, containerClient)

    el.snippetPreview.value = snippetHtml
    el.pagePreview.value = workPageHtml
    
    setStatus(`Published "${data.slugValue}" with images uploaded to ${uploadMethod}.`, 'success')
  } catch (error) {
    setStatus(`Error: ${error.message}`, 'error')
    console.error('Publish error:', error)
  } finally {
    state.isPublishing = false
    el.generate.disabled = !state.rootHandle
  }
}
