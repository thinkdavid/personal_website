import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSnippetHtml, buildWorkPageHtml } from './generator.js'
import {
  insertSnippetAtAnchor,
  classifyMarkerPath,
  collectPhotoPaths,
  publishWorkEntry
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
