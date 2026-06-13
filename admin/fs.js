function splitPath(relativePath) {
  return relativePath.split('/').filter(Boolean)
}

async function walkDirectory(dirHandle, segments, create = false) {
  let current = dirHandle

  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment, { create })
  }

  return current
}

export async function pickProjectRoot() {
  if (!window.showDirectoryPicker) {
    throw new Error('File System Access API is not supported in this browser.')
  }

  return window.showDirectoryPicker({ mode: 'readwrite' })
}

export async function ensureDirectory(dirHandle, relativePath) {
  const segments = splitPath(relativePath)
  return walkDirectory(dirHandle, segments, true)
}

export async function readTextFile(dirHandle, relativePath) {
  const segments = splitPath(relativePath)
  if (segments.length === 0) {
    throw new Error('File path is empty.')
  }

  const fileName = segments.pop()
  const parent = await walkDirectory(dirHandle, segments, false)
  const fileHandle = await parent.getFileHandle(fileName)
  const file = await fileHandle.getFile()

  return file.text()
}

export async function writeTextFile(dirHandle, relativePath, contents) {
  const segments = splitPath(relativePath)
  if (segments.length === 0) {
    throw new Error('File path is empty.')
  }

  const fileName = segments.pop()
  const parent = await walkDirectory(dirHandle, segments, true)
  const fileHandle = await parent.getFileHandle(fileName, { create: true })
  const writable = await fileHandle.createWritable()

  await writable.write(contents)
  await writable.close()
}
