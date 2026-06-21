# Copilot Instructions for thinkdavid Portfolio

## Project overview

This repository is a static photography portfolio with Webflow-generated pages plus a small Node-based admin tool for publishing work entries.

The publishing flow is:
1. Select a project folder in `admin/index.html`
2. Scan `landscape/` and `portrait/` images
3. Generate the work page and homepage snippet
4. Insert the snippet into `index.html` and `gallery.html`
5. Keep generated HTML pointed at CDN image URLs when Blob Storage is enabled

## Build, test, and run

```bash
npm test
```

Run a single test by pattern:

```bash
npm run test:single "slugify"
```

You can also run the test file directly:

```bash
node admin/publish.test.js
```

GitHub Actions runs the same test file on Linux, macOS, and Windows.

## Architecture

- `index.html`, `gallery.html`, and `about.html` are the public site pages.
- `work/` contains generated work detail pages.
- `admin/` contains the browser-based publishing UI and the Node helpers behind it.
- `admin/app.js` handles the UI flow.
- `admin/publish.js` owns photo collection, snippet insertion, duplicate-slug checks, and file writes.
- `admin/generator.js` builds the HTML and sanitizes titles, subtitles, captions, and asset paths.
- `admin/blob-storage.js` handles Blob upload and CDN URL generation.

The codebase treats the Webflow HTML as the source of truth for layout and the admin tooling as a content publisher layered on top of it.

## Key conventions

- Preserve exact folder case in paths. This repository runs on macOS, Linux, and Windows, and case mismatches can break on Linux.
- Normalize Windows separators to `/` before generating web URLs.
- Only accept image files with these extensions: `jpg`, `jpeg`, `png`, `webp`, `avif`, `gif`.
- Work folders must contain both `landscape/` and `portrait/`.
- Generated snippets are inserted after `<div role="list" class="work-list_list w-dyn-items">`.
- Escape user-provided text before rendering HTML.
- Keep `index.html.backup` and `gallery.html.backup` in sync with the current published pages.
- Tests use dependency injection and fake file handles; avoid real filesystem access in unit tests.
- New work should be added newest-first in the homepage list.

## Workflow

- **Do NOT commit changes automatically.** Only commit when explicitly approved by the user.
- Verify changes with tests (npm test) before requesting approval.
- Stage changes and wait for user approval before committing.

## MCP tools

Use Playwright MCP to verify rendered portfolio pages, GitHub MCP for PR and workflow operations, and Filesystem MCP for repository file work.

