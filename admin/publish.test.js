import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSnippetHtml, buildWorkPageHtml } from './generator.js'
import {
  insertSnippetAtAnchor,
  classifyMarkerPath,
  collectPhotoPaths,
  publishWorkEntry,
  listExistingWorkPages,
  appendPhotosToExistingWorkPage,
  appendCdnUrlsToWorkPage,
} from './publish.js'

test('insertSnippetAtAnchor inserts immediately after work-list anchor', () => {
  const anchor = '<div role="list" class="work-list_list w-dyn-items">'
  const input = `<main>${anchor}\n<div>existing</div>\n</div></main>`
  const snippet = '<div role="listitem">new</div>'
  const output = insertSnippetAtAnchor(input, snippet)
  assert.equal(output.includes(`${anchor}\n${snippet}`), true)
})

test('insertSnippetAtAnchor prepends new snippet before existing snippet', () => {
  const anchor = '<div role="list" class="work-list_list w-dyn-items">'
  const existing = '<div role="listitem">existing</div>'
  const input = `<main>${anchor}\n${existing}\n</div></main>`
  const snippet = '<div role="listitem">new</div>'
  const output = insertSnippetAtAnchor(input, snippet)
  assert.equal(output.indexOf(snippet) < output.indexOf(existing), true)
})

test('insertSnippetAtAnchor throws when anchor missing', () => {
  assert.throws(() => insertSnippetAtAnchor('<main></main>', '<div>x</div>'), /anchor/i)
})

test('insertSnippetAtAnchor throws explicit missing-anchor error message', () => {
  assert.throws(
    () => insertSnippetAtAnchor('<main></main>', '<div>x</div>'),
    (error) => {
      assert.equal(error?.message, 'Could not find index work-list anchor')
      return true
    }
  )
})

test('classifyMarkerPath maps marker folders', () => {
  assert.equal(classifyMarkerPath('landscape/a.jpg'), 'landscape')
  assert.equal(classifyMarkerPath('portrait/a.jpg'), 'portrait')
  assert.equal(classifyMarkerPath('peru/landscape/a.jpg'), 'landscape')
  assert.equal(classifyMarkerPath('peru/portrait/b.jpg'), 'portrait')
  assert.equal(classifyMarkerPath('peru/misc/c.jpg'), null)
})

function createDirHandle(children = {}) {
  return {
    async getDirectoryHandle(name) {
      if (!(name in children) || !children[name] || children[name].kind !== 'directory') {
        throw new Error(`Missing directory: ${name}`)
      }
      return children[name].handle
    },
    async *entries() {
      for (const [name, child] of Object.entries(children)) {
        yield [name, child.handle]
      }
    }
  }
}

function createFileHandle() {
  return { kind: 'file' }
}

function createDirectory(children = {}) {
  return { kind: 'directory', handle: createDirHandle(children) }
}

function createFile() {
  return { kind: 'file', handle: createFileHandle() }
}

test('collectPhotoPaths returns sorted prefixed landscape and portrait photos', async () => {
  const rootHandle = createDirHandle({
    peru: createDirectory({
      landscape: createDirectory({
        'notes.txt': createFile(),
        'z.jpg': createFile(),
        'a.jpg': createFile()
      }),
      portrait: createDirectory({
        'thumb.db': createFile(),
        '2.jpg': createFile(),
        '1.jpg': createFile()
      })
    })
  })

  const result = await collectPhotoPaths(rootHandle, 'peru')
  assert.deepEqual(result, {
    landscapePhotos: ['peru/landscape/a.jpg', 'peru/landscape/z.jpg'],
    portraitPhotos: ['peru/portrait/1.jpg', 'peru/portrait/2.jpg']
  })
})

test('collectPhotoPaths accepts common image extensions only', async () => {
  const rootHandle = createDirHandle({
    peru: createDirectory({
      landscape: createDirectory({
        'a.JPG': createFile(),
        'b.jpeg': createFile(),
        'c.png': createFile(),
        'd.webp': createFile(),
        'e.avif': createFile(),
        'f.gif': createFile(),
        'readme.md': createFile()
      }),
      portrait: createDirectory({
        '1.jpg': createFile(),
        'video.mp4': createFile()
      })
    })
  })

  const result = await collectPhotoPaths(rootHandle, 'peru')
  assert.deepEqual(result.landscapePhotos, [
    'peru/landscape/a.JPG',
    'peru/landscape/b.jpeg',
    'peru/landscape/c.png',
    'peru/landscape/d.webp',
    'peru/landscape/e.avif',
    'peru/landscape/f.gif'
  ])
  assert.deepEqual(result.portraitPhotos, ['peru/portrait/1.jpg'])
})

test('collectPhotoPaths throws when a marker folder has no images', async () => {
  const rootHandle = createDirHandle({
    peru: createDirectory({
      landscape: createDirectory({}),
      portrait: createDirectory({ '1.jpg': createFile() })
    })
  })

  await assert.rejects(() => collectPhotoPaths(rootHandle, 'peru'), /expected peru\/landscape and peru\/portrait/i)
})

test('collectPhotoPaths throws when marker folders contain only non-image files', async () => {
  const rootHandle = createDirHandle({
    peru: createDirectory({
      landscape: createDirectory({ 'notes.txt': createFile() }),
      portrait: createDirectory({ 'clip.mov': createFile() })
    })
  })

  await assert.rejects(() => collectPhotoPaths(rootHandle, 'peru'), /expected peru\/landscape and peru\/portrait/i)
})

test('collectPhotoPaths throws a friendly error when marker folders are missing', async () => {
  const rootHandle = createDirHandle({
    peru: createDirectory({
      portrait: createDirectory({ '1.jpg': createFile() })
    })
  })

  await assert.rejects(
    () => collectPhotoPaths(rootHandle, 'peru'),
    (error) => {
      assert.equal(
        error?.message,
        'Invalid marker folder structure. Expected peru/landscape and peru/portrait with at least one image each.'
      )
      return true
    }
  )
})

test('collectPhotoPaths throws a friendly error when the work folder is missing', async () => {
  const rootHandle = createDirHandle({})
  await assert.rejects(() => collectPhotoPaths(rootHandle, 'peru'), /expected peru\/landscape and peru\/portrait/i)
})

test('listExistingWorkPages returns sorted work page slugs preserving case', async () => {
  const rootHandle = createDirHandle({
    work: createDirectory({
      'peopleOfSicily.html': createFile(),
      'guadalajara-mexico.html': createFile(),
      'work-page-with-variables.html': createFile(),
      'finalOutput.html': createFile(),
      'notes.txt': createFile(),
    }),
  })

  const pages = await listExistingWorkPages(rootHandle)
  assert.deepEqual(pages, [
    { slug: 'guadalajara-mexico', filePath: 'work/guadalajara-mexico.html' },
    { slug: 'peopleOfSicily', filePath: 'work/peopleOfSicily.html' },
  ])
})

test('appendPhotosToExistingWorkPage appends new blob URLs and writes backup', async () => {
  const writes = []
  const originalHtml = `
    <section>
      <div role="list" class="still_list w-dyn-items">
        <div class="still_item">existing-landscape</div>
      </div>
      <div role="list" class="collection-list w-dyn-items w-row">
        <div class="collection-item">existing-portrait</div>
      </div>
    </section>
  `

  const loadDeps = async () => ({
    readTextFile: async (_root, path) => {
      if (path === 'work/people-of-sicily.html') return originalHtml
      throw new Error(`Unexpected read: ${path}`)
    },
    writeTextFile: async (_root, path, contents) => {
      writes.push({ path, contents })
    },
    readBinaryFile: async () => new Uint8Array([1, 2, 3]).buffer,
    buildLandscapeItem: (url) => `<div class="still_item" data-url="${url}"></div>`,
    buildPortraitItem: (url) => `<div class="collection-item" data-url="${url}"></div>`,
    uploadImageToBlob: async () => {},
    getBlobCDNUrl: (localPath) => `https://cdn.example.com/${localPath}`,
  })

  const result = await appendPhotosToExistingWorkPage(
    {},
    {
      slug: 'people-of-sicily',
      workName: 'peopleOfSicily',
      landscapePhotos: ['peopleOfSicily/landscape/new-a.jpg'],
      portraitPhotos: ['peopleOfSicily/portrait/new-b.jpg'],
    },
    { loadDependencies: loadDeps, containerClient: {} }
  )

  assert.equal(result.appendedLandscapeCount, 1)
  assert.equal(result.appendedPortraitCount, 1)
  assert.deepEqual(writes.map((entry) => entry.path), [
    'work/people-of-sicily.html.backup',
    'work/people-of-sicily.html',
  ])
  const updated = writes[1].contents
  assert.equal(updated.includes('existing-landscape'), true)
  assert.equal(updated.includes('existing-portrait'), true)
  assert.equal(updated.includes('https://cdn.example.com/peopleOfSicily/landscape/new-a.jpg'), true)
  assert.equal(updated.includes('https://cdn.example.com/peopleOfSicily/portrait/new-b.jpg'), true)
})

test('appendPhotosToExistingWorkPage skips duplicates already in html', async () => {
  const writes = []
  const existingUrl = 'https://cdn.example.com/peopleOfSicily/landscape/existing.jpg'
  const originalHtml = `
    <section>
      <div role="list" class="still_list w-dyn-items">
        <img src="${existingUrl}">
      </div>
      <div role="list" class="collection-list w-dyn-items w-row"></div>
    </section>
  `

  const loadDeps = async () => ({
    readTextFile: async () => originalHtml,
    writeTextFile: async (_root, path, contents) => {
      writes.push({ path, contents })
    },
    readBinaryFile: async () => new Uint8Array([1, 2, 3]).buffer,
    buildLandscapeItem: (url) => `<div class="still_item" data-url="${url}"></div>`,
    buildPortraitItem: (url) => `<div class="collection-item" data-url="${url}"></div>`,
    uploadImageToBlob: async () => {},
    getBlobCDNUrl: (localPath) => `https://cdn.example.com/${localPath}`,
  })

  await assert.rejects(
    () =>
      appendPhotosToExistingWorkPage(
        {},
        {
          slug: 'people-of-sicily',
          workName: 'peopleOfSicily',
          landscapePhotos: ['peopleOfSicily/landscape/existing.jpg'],
          portraitPhotos: [],
        },
        { loadDependencies: loadDeps, containerClient: {} }
      ),
    /already exist/i
  )
  assert.equal(writes.length, 0)
})

test('appendPhotosToExistingWorkPage throws explicit error when gallery marker is missing', async () => {
  const loadDeps = async () => ({
    readTextFile: async () => '<main>missing lists</main>',
    writeTextFile: async () => {},
    readBinaryFile: async () => new Uint8Array([1, 2, 3]).buffer,
    buildLandscapeItem: (url) => `<div>${url}</div>`,
    buildPortraitItem: (url) => `<div>${url}</div>`,
    uploadImageToBlob: async () => {},
    getBlobCDNUrl: (localPath) => `https://cdn.example.com/${localPath}`,
  })

  await assert.rejects(
    () =>
      appendPhotosToExistingWorkPage(
        {},
        {
          slug: 'people-of-sicily',
          workName: 'peopleOfSicily',
          landscapePhotos: ['peopleOfSicily/landscape/new-a.jpg'],
          portraitPhotos: [],
        },
        { loadDependencies: loadDeps, containerClient: {} }
      ),
    /landscape gallery marker/i
  )
})

test('publishWorkEntry writes backups, work page, and updated index/gallery via injected dependencies', async () => {
  const writes = []
  const payload = { slug: 'iceland-dawn', title: 'Iceland Dawn' }

  const loadDeps = async () => ({
    readTextFile: async (_root, path) => {
      if (path === 'workSnippetWithVariables.html') return 'snippet-template'
      if (path === 'work/work-page-with-variables.html') return 'work-template'
      if (path === 'index.html') return '<main><div role="list" class="work-list_list w-dyn-items"></div></main>'
      if (path === 'gallery.html') return '<main><div role="list" class="work-list_list w-dyn-items"></div></main>'
      throw new Error(`Unexpected read: ${path}`)
    },
    writeTextFile: async (_root, path, contents) => {
      writes.push({ path, contents })
    },
    buildSnippetHtml: (template, data) => `${template}:${data.title}`,
    buildWorkPageHtml: (template, data) => `${template}:${data.slug}`
  })

  const result = await publishWorkEntry({}, payload, loadDeps)
  assert.equal(result.snippetHtml, 'snippet-template:Iceland Dawn')
  assert.equal(result.workPageHtml, 'work-template:iceland-dawn')
  assert.deepEqual(writes.map((w) => w.path), [
    'index.html.backup',
    'gallery.html.backup',
    'work/iceland-dawn.html',
    'index.html',
    'gallery.html'
  ])
  const writtenByPath = Object.fromEntries(writes.map((write) => [write.path, write.contents]))
  assert.match(writtenByPath['work/iceland-dawn.html'], /work-template:iceland-dawn/)
  assert.match(writtenByPath['index.html'], /snippet-template:Iceland Dawn/)
  assert.match(writtenByPath['gallery.html'], /snippet-template:Iceland Dawn/)
})

test('publishWorkEntry with blob client writes CDN URLs (not local paths) into work page html', async () => {
  const writes = []
  const uploadCalls = []
  const payload = {
    slug: 'egypt',
    title: 'Egypt',
    subtitle: 'Photography',
    caption: 'Test',
    coverPhotoPath: 'egypt/landscape/_DAB3066.jpg',
    landscapePhotos: ['egypt/landscape/_DAB3066.jpg'],
    portraitPhotos: ['egypt/portrait/_DAB3051.jpg'],
  }

  const loadDependencies = async () => ({
    readTextFile: async (_root, path) => {
      if (path === 'workSnippetWithVariables.html') return 'snippet-template'
      if (path === 'work/work-page-with-variables.html') return 'work-template'
      if (path === 'index.html') return '<main><div role="list" class="work-list_list w-dyn-items"></div></main>'
      if (path === 'gallery.html') return '<main><div role="list" class="work-list_list w-dyn-items"></div></main>'
      throw new Error(`Unexpected read: ${path}`)
    },
    writeTextFile: async (_root, path, contents) => writes.push({ path, contents }),
    buildSnippetHtml: (_template, data) => `snippet:${data.coverPhotoPath}`,
    buildWorkPageHtml: (_template, data) => JSON.stringify(data),
  })

  const loadBlobDependencies = async () => ({
    readBinaryFile: async () => new Uint8Array([1, 2, 3]).buffer,
    uploadImageToBlob: async (localPath) => {
      uploadCalls.push(localPath)
    },
    getBlobCDNUrl: (localPath) => `https://cdn.example.com/${localPath}`,
  })

  const result = await publishWorkEntry(
    {},
    payload,
    { loadDependencies, loadBlobDependencies, containerClient: {} }
  )

  assert.deepEqual(uploadCalls, [
    'egypt/landscape/_DAB3066.jpg',
    'egypt/portrait/_DAB3051.jpg',
  ])
  assert.match(result.workPageHtml, /https:\/\/cdn\.example\.com\/egypt\/landscape\/_DAB3066\.jpg/)
  assert.match(result.workPageHtml, /https:\/\/cdn\.example\.com\/egypt\/portrait\/_DAB3051\.jpg/)
  assert.doesNotMatch(result.workPageHtml, /"\.\.\/egypt\/landscape\/_DAB3066\.jpg"/)
  assert.doesNotMatch(result.workPageHtml, /"\.\.\/egypt\/portrait\/_DAB3051\.jpg"/)
  assert.doesNotMatch(result.workPageHtml, /"egypt\/landscape\/_DAB3066\.jpg"/)
  assert.doesNotMatch(result.workPageHtml, /"egypt\/portrait\/_DAB3051\.jpg"/)
  assert.match(writes.find((w) => w.path === 'work/egypt.html').contents, /https:\/\/cdn\.example\.com\//)
})

test('publishWorkEntry throws when called without blob container client in runtime mode', async () => {
  const payload = { slug: 'iceland-dawn', title: 'Iceland Dawn' }
  await assert.rejects(
    () =>
      publishWorkEntry({}, payload, {
        loadDependencies: async () => {
          throw new Error('loadDependencies should not run when blob client is missing')
        },
      }),
    /container client is required/i
  )
})

test('publishWorkEntry throws when index already has the same work slug', async () => {
  const writes = []
  const payload = { slug: 'iceland-dawn', title: 'Iceland Dawn' }

  const loadDeps = async () => ({
    readTextFile: async (_root, path) => {
      if (path === 'workSnippetWithVariables.html') return 'snippet-template'
      if (path === 'work/work-page-with-variables.html') return 'work-template'
      if (path === 'index.html') {
        return '<main><a href="/work/iceland-dawn">Existing</a><div role="list" class="work-list_list w-dyn-items"></div></main>'
      }
      if (path === 'gallery.html') {
        return '<main><div role="list" class="work-list_list w-dyn-items"></div></main>'
      }
      throw new Error(`Unexpected read: ${path}`)
    },
    writeTextFile: async (_root, path, contents) => {
      writes.push({ path, contents })
    },
    buildSnippetHtml: (template, data) => `${template}:${data.title}`,
    buildWorkPageHtml: (template, data) => `${template}:${data.slug}`
  })

  await assert.rejects(
    () => publishWorkEntry({}, payload, loadDeps),
    /already contains an entry for slug "iceland-dawn"/i
  )
  assert.equal(writes.length, 0)
})

test('publishWorkEntry detects duplicate slug links with .html in relative and absolute forms', async () => {
  const payload = { slug: 'iceland-dawn', title: 'Iceland Dawn' }
  const duplicateHrefs = ['/work/iceland-dawn.html', 'work/iceland-dawn.html', '../work/iceland-dawn.html']

  for (const href of duplicateHrefs) {
    const writes = []
    const loadDeps = async () => ({
      readTextFile: async (_root, path) => {
        if (path === 'workSnippetWithVariables.html') return 'snippet-template'
        if (path === 'work/work-page-with-variables.html') return 'work-template'
        if (path === 'index.html') {
          return `<main><a href="${href}">Existing</a><div role="list" class="work-list_list w-dyn-items"></div></main>`
        }
        if (path === 'gallery.html') {
          return '<main><div role="list" class="work-list_list w-dyn-items"></div></main>'
        }
        throw new Error(`Unexpected read: ${path}`)
      },
      writeTextFile: async (_root, path, contents) => {
        writes.push({ path, contents })
      },
      buildSnippetHtml: (template, data) => `${template}:${data.title}`,
      buildWorkPageHtml: (template, data) => `${template}:${data.slug}`
    })

    await assert.rejects(
      () => publishWorkEntry({}, payload, loadDeps),
      /already contains an entry for slug "iceland-dawn"/i
    )
    assert.equal(writes.length, 0)
  }
})

const WORK_TEMPLATE_WITH_DESCRIPTION = `
<h1>{title}</h1>
<p>{subtitle}</p>
<img alt="Woman in Cartagena Colombia with the Palaqueras." src="{coverPhotoUrl}" srcset="placeholder">
<section>{insertLandscapePhotosHere}</section>
<section>{insertPortraitImagesHere}</section>
<p>{description}</p>
`

test('buildWorkPageHtml renders caption when provided', () => {
  const html = buildWorkPageHtml(WORK_TEMPLATE_WITH_DESCRIPTION, {
    title: 'Iceland Dawn',
    subtitle: 'A quiet morning',
    coverPhotoPath: 'iceland/cover.jpg',
    landscapePhotos: [],
    portraitPhotos: [],
    caption: 'Shot at first light.'
  })

  assert.match(html, /<p>Shot at first light\.<\/p>/)
  assert.equal(html.includes('{description}'), false)
})

test('buildWorkPageHtml escapes caption HTML entities', () => {
  const html = buildWorkPageHtml(WORK_TEMPLATE_WITH_DESCRIPTION, {
    title: 'Iceland Dawn',
    subtitle: 'A quiet morning',
    coverPhotoPath: 'iceland/cover.jpg',
    landscapePhotos: [],
    portraitPhotos: [],
    caption: '<script>alert("x")</script> Fish & Chips < Rocks >'
  })

  assert.match(
    html,
    /<p>&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt; Fish &amp; Chips &lt; Rocks &gt;<\/p>/
  )
  assert.equal(html.includes('<script>'), false)
})

test('buildWorkPageHtml escapes title and subtitle in text and alt attributes', () => {
  const title = '"><img src=x onerror=alert(1)> & "quote"'
  const subtitle = '<script>alert("x")</script> & rocks'
  const escapedTitle = '&quot;&gt;&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quote&quot;'
  const escapedSubtitle = '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; rocks'

  const html = buildWorkPageHtml(WORK_TEMPLATE_WITH_DESCRIPTION, {
    title,
    subtitle,
    coverPhotoPath: 'iceland/cover.jpg',
    landscapePhotos: [],
    portraitPhotos: []
  })

  assert.equal(html.includes(`<h1>${escapedTitle}</h1>`), true)
  assert.equal(html.includes(`<p>${escapedSubtitle}</p>`), true)
  assert.equal(html.includes(`alt="${escapedTitle}"`), true)
  assert.equal(html.includes('alt=""><img src=x onerror=alert(1)>'), false)
})

test('buildWorkPageHtml prefixes asset paths for work pages', () => {
  const html = buildWorkPageHtml(WORK_TEMPLATE_WITH_DESCRIPTION, {
    title: 'Iceland Dawn',
    subtitle: 'A quiet morning',
    coverPhotoPath: 'iceland/cover.jpg',
    landscapePhotos: ['iceland/landscape/a.jpg'],
    portraitPhotos: ['iceland/portrait/b.jpg']
  })

  assert.match(html, /src="\.\.\/iceland\/cover\.jpg"/)
  assert.match(html, /src="\.\.\/iceland\/landscape\/a\.jpg"/)
  assert.match(html, /"url":"\.\.\/iceland\/portrait\/b\.jpg"/)
})

test('buildWorkPageHtml preserves absolute CDN URLs without ../ prefix', () => {
  const html = buildWorkPageHtml(WORK_TEMPLATE_WITH_DESCRIPTION, {
    title: 'Egypt',
    subtitle: 'Photography',
    coverPhotoPath: 'https://thinkdavidportfolio91556.blob.core.windows.net/images/egypt/landscape/_DAB3066.jpg',
    landscapePhotos: ['https://thinkdavidportfolio91556.blob.core.windows.net/images/egypt/landscape/_DAB3066.jpg'],
    portraitPhotos: ['https://thinkdavidportfolio91556.blob.core.windows.net/images/egypt/portrait/_DAB3051.jpg']
  })

  assert.match(
    html,
    /src="https:\/\/thinkdavidportfolio91556\.blob\.core\.windows\.net\/images\/egypt\/landscape\/_DAB3066\.jpg"/
  )
  assert.match(
    html,
    /src="https:\/\/thinkdavidportfolio91556\.blob\.core\.windows\.net\/images\/egypt\/portrait\/_DAB3051\.jpg"/
  )
  assert.match(
    html,
    /"url":"https:\/\/thinkdavidportfolio91556\.blob\.core\.windows\.net\/images\/egypt\/portrait\/_DAB3051\.jpg"/
  )
  assert.doesNotMatch(html, /\.\.\/https%3A\/\//)
})

test('buildWorkPageHtml omits cover photo from landscape gallery items', () => {
  const html = buildWorkPageHtml(WORK_TEMPLATE_WITH_DESCRIPTION, {
    title: 'Salkantay Trek, Peru',
    subtitle: 'Photography, Digital: 2019',
    coverPhotoPath: 'peru/landscape/DSC_0818.jpg',
    landscapePhotos: ['peru/landscape/DSC_0818.jpg', 'peru/landscape/DSC_0845.jpg'],
    portraitPhotos: []
  })

  assert.match(html, /src="\.\.\/peru\/landscape\/DSC_0818\.jpg"/)
  assert.equal(html.includes('src="../peru/landscape/DSC_0818.jpg"'), true)
  assert.equal(html.includes('src="../peru/landscape/DSC_0845.jpg"'), true)
  assert.equal(
    html.includes('<img loading="lazy" height="Auto" alt="" src="../peru/landscape/DSC_0818.jpg" sizes="(max-width: 479px) 92vw, 95vw" srcset="../peru/landscape/DSC_0818.jpg" class="work-image">'),
    false
  )
})

test('buildWorkPageHtml leaves caption empty when omitted', () => {
  const html = buildWorkPageHtml(WORK_TEMPLATE_WITH_DESCRIPTION, {
    title: 'Iceland Dawn',
    subtitle: 'A quiet morning',
    coverPhotoPath: 'iceland/cover.jpg',
    landscapePhotos: [],
    portraitPhotos: []
  })

  assert.match(html, /<p><\/p>/)
  assert.equal(html.includes('{description}'), false)
})

test('buildSnippetHtml escapes title subtitle and coverPhotoAlt', () => {
  const title = '"><img src=x onerror=alert(1)> & "quote"'
  const subtitle = '<script>alert("x")</script> & rocks'
  const escapedTitle = '&quot;&gt;&lt;img src=x onerror=alert(1)&gt; &amp; &quot;quote&quot;'
  const escapedSubtitle = '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; rocks'
  const template = `
    <a href="work/{urlSlug}.html">
      <h2>{title}</h2>
      <p>{subtitle}</p>
      <img alt="{coverPhotoAlt}" src="{imageUrl}.{imageSuffix}" srcset="placeholder">
    </a>
  `

  const html = buildSnippetHtml(template, {
    title,
    subtitle,
    slug: 'iceland-dawn',
    coverPhotoPath: 'iceland/cover.jpg'
  })

  assert.equal(html.includes(`<h2>${escapedTitle}</h2>`), true)
  assert.equal(html.includes(`<p>${escapedSubtitle}</p>`), true)
  assert.equal(html.includes(`alt="${escapedTitle}"`), true)
  assert.equal(html.includes('<img src=x onerror=alert(1)>'), false)
  assert.equal(html.includes('<script>alert("x")</script>'), false)
})

test('buildSnippetHtml links to the generated html page', () => {
  const html = buildSnippetHtml('<a href="work/{urlSlug}.html">{title}</a>', {
    title: 'Pereira, Colombia',
    subtitle: 'Photography',
    slug: 'pereira-colombia',
    coverPhotoPath: 'iceland/cover.jpg'
  })

  assert.match(html, /href="work\/pereira-colombia\.html"/)
})

test('buildSnippetHtml sanitizes malicious cover photo path for html attributes and srcset', () => {
  const maliciousPath = 'iceland/cover" onerror="alert(1)</script><script>alert(2)</script>.jpg'
  const template = `
    <a href="/work/{urlSlug}">
      <img alt="{coverPhotoAlt}" src="{imageUrl}" srcset="placeholder">
    </a>
  `

  const html = buildSnippetHtml(template, {
    title: 'Iceland Dawn',
    subtitle: 'A quiet morning',
    slug: 'iceland-dawn',
    coverPhotoPath: maliciousPath
  })

  assert.match(
    html,
    /src="iceland\/cover%22%20onerror%3D%22alert\(1\)%3C\/script%3E%3Cscript%3Ealert\(2\)%3C\/script%3E\.jpg"/
  )
  assert.equal(html.includes('onerror='), false)
  assert.equal(html.includes('</script><script>'), false)
  assert.equal(html.includes('srcset="iceland/cover"'), false)
})

test('buildWorkPageHtml sanitizes malicious cover and gallery paths for attributes, srcset, and lightbox json', () => {
  const coverPhotoPath = 'iceland/cover" onerror="alert(1).jpg'
  const landscapePath = 'iceland/landscape/frame" onclick="evil(1).jpg'
  const portraitPath = 'iceland/portrait/pose"</script><script>alert(1)</script>.jpg'

  const html = buildWorkPageHtml(WORK_TEMPLATE_WITH_DESCRIPTION, {
    title: 'Iceland Dawn',
    subtitle: 'A quiet morning',
    coverPhotoPath,
    landscapePhotos: [landscapePath],
    portraitPhotos: [portraitPath]
  })

  assert.match(html, /src="\.\.\/iceland\/cover%22%20onerror%3D%22alert\(1\)\.jpg"/)
  assert.match(html, /src="\.\.\/iceland\/landscape\/frame%22%20onclick%3D%22evil\(1\)\.jpg"/)
  assert.match(html, /src="\.\.\/iceland\/portrait\/pose%22%3C\/script%3E%3Cscript%3Ealert\(1\)%3C\/script%3E\.jpg"/)
  assert.match(html, /"url":"\.\.\/iceland\/portrait\/pose%22%3C\/script%3E%3Cscript%3Ealert\(1\)%3C\/script%3E\.jpg"/)
  assert.equal(html.includes('onclick='), false)
  assert.equal(html.includes('onerror='), false)
  assert.equal(html.includes('</script><script>'), false)
})

const GALLERY_HTML = `
  <section>
    <div role="list" class="still_list w-dyn-items">
      <div class="still_item">existing-landscape</div>
    </div>
    <div role="list" class="collection-list w-dyn-items w-row">
      <div class="collection-item">existing-portrait</div>
    </div>
  </section>
`

test('appendCdnUrlsToWorkPage appends CDN URLs and writes backup', async () => {
  const writes = []
  const loadDeps = async () => ({
    readTextFile: async (_root, path) => {
      if (path === 'work/people-of-sicily.html') return GALLERY_HTML
      throw new Error(`Unexpected read: ${path}`)
    },
    writeTextFile: async (_root, path, contents) => writes.push({ path, contents }),
    buildLandscapeItem: (url) => `<div class="still_item" data-url="${url}"></div>`,
    buildPortraitItem: (url) => `<div class="collection-item" data-url="${url}"></div>`,
  })

  const result = await appendCdnUrlsToWorkPage(
    {},
    {
      slug: 'people-of-sicily',
      landscapeCdnUrls: ['https://cdn.example.com/peopleOfSicily/landscape/new-a.jpg'],
      portraitCdnUrls: ['https://cdn.example.com/peopleOfSicily/portrait/new-b.jpg'],
    },
    loadDeps
  )

  assert.equal(result.appendedLandscapeCount, 1)
  assert.equal(result.appendedPortraitCount, 1)
  assert.deepEqual(writes.map((w) => w.path), [
    'work/people-of-sicily.html.backup',
    'work/people-of-sicily.html',
  ])
  const updated = writes[1].contents
  assert.equal(updated.includes('existing-landscape'), true)
  assert.equal(updated.includes('https://cdn.example.com/peopleOfSicily/landscape/new-a.jpg'), true)
  assert.equal(updated.includes('https://cdn.example.com/peopleOfSicily/portrait/new-b.jpg'), true)
})

test('appendCdnUrlsToWorkPage skips URLs already in the page', async () => {
  const existingUrl = 'https://cdn.example.com/peopleOfSicily/landscape/existing.jpg'
  const writes = []
  const loadDeps = async () => ({
    readTextFile: async () =>
      `<section><div role="list" class="still_list w-dyn-items"><img src="${existingUrl}"></div><div role="list" class="collection-list w-dyn-items w-row"><div class="new-portrait" data-url="https://cdn.example.com/peopleOfSicily/portrait/new.jpg"></div></div></section>`,
    writeTextFile: async (_root, path, contents) => writes.push({ path, contents }),
    buildLandscapeItem: (url) => `<div data-url="${url}"></div>`,
    buildPortraitItem: (url) => `<div data-url="${url}"></div>`,
  })

  await assert.rejects(
    () =>
      appendCdnUrlsToWorkPage(
        {},
        { slug: 'people-of-sicily', landscapeCdnUrls: [existingUrl], portraitCdnUrls: [] },
        loadDeps
      ),
    /already exist/i
  )
  assert.equal(writes.length, 0)
})

test('appendCdnUrlsToWorkPage throws when landscape gallery marker is missing', async () => {
  const loadDeps = async () => ({
    readTextFile: async () => '<main>no gallery here</main>',
    writeTextFile: async () => {},
    buildLandscapeItem: (url) => `<div>${url}</div>`,
    buildPortraitItem: (url) => `<div>${url}</div>`,
  })

  await assert.rejects(
    () =>
      appendCdnUrlsToWorkPage(
        {},
        { slug: 'people-of-sicily', landscapeCdnUrls: ['https://cdn.example.com/a.jpg'], portraitCdnUrls: [] },
        loadDeps
      ),
    /landscape gallery marker/i
  )
})

test('buildSnippetHtml preserves exact case in image paths for case-sensitive filesystems', () => {
  const template = `<img src="{imageUrl}" srcset="{imageUrl}" alt="{coverPhotoAlt}"/>`
  const snippet = buildSnippetHtml(template, {
    title: 'People of Sicily',
    subtitle: 'Photo series',
    slug: 'people-of-sicily',
    coverPhotoPath: 'peopleOfSicily/landscape/photo.jpg',
  })
  
  assert.match(snippet, /src="peopleOfSicily\/landscape\/photo\.jpg"/)
})

test('buildSnippetHtml normalizes Windows path separators to forward slashes', () => {
  const template = `<img src="{imageUrl}" alt="test"/>`
  const snippet = buildSnippetHtml(template, {
    title: 'Test',
    subtitle: 'Test',
    slug: 'test',
    coverPhotoPath: 'work\\testfolder\\image.jpg',
  })
  
  assert.match(snippet, /src="work\/testfolder\/image\.jpg"/)
  assert.doesNotMatch(snippet, /\\/)
})
