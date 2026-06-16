# Copilot Instructions for thinkdavid Portfolio

## Project Overview

This is a personal portfolio website for photographer/designer David. The project uses:
- **Frontend:** Webflow-generated HTML/CSS with custom styling
- **Admin tools:** Node.js utilities for publishing portfolio work entries
- **Test framework:** Node's built-in `test` module with `assert/strict`
- **MCP Servers:** Playwright (page testing), GitHub (PR automation), Filesystem (file access)

The core workflow publishes photography work entries by combining directory scanning, HTML generation, and index page updates.

## Testing & Development Commands

### Run Tests
```bash
npm test
```
All 26 tests pass, covering HTML insertion, file classification, photo collection, publishing, and cross-platform path handling.

### Run Single Test
```bash
npm run test:single "test name pattern"
# Example: npm run test:single "case"
```

Or directly with Node:
```bash
node --test --grep "slugify" admin/publish.test.js
```

### Test Coverage Areas
- `publish.js` — HTML snippet insertion, marker path classification, photo collection
- `generator.js` — HTML generation, slug creation, image path sanitization
- `publish.test.js` — 26 test cases covering:
  - Happy path publishing workflows
  - XSS/injection sanitization (HTML entities, URI encoding)
  - Cross-platform path handling (case-sensitivity, Windows separators)
  - Error handling for invalid folder structures, missing files, duplicate entries

### Cross-Platform CI/CD
Tests automatically run on GitHub Actions for Windows, macOS, and Linux. Branch must pass all platforms before merging.

## Architecture & Conventions

### Directory Structure
```
├── index.html, about.html          # Main portfolio pages (Webflow-generated)
├── work/                           # Published work pages (landscape/portrait photo collections)
├── admin/                          # Publishing tools
│   ├── app.js                      # Browser UI for publishing work (File System Access API)
│   ├── publish.js                  # Core publishing logic (HTML generation, file operations)
│   ├── generator.js                # HTML/slug generation utilities
│   ├── fs.js                       # Filesystem wrapper (File System Access API)
│   ├── publish.test.js             # All tests
│   └── index.html                  # Admin interface
├── css/                            # Webflow-generated + custom styles
└── js/                             # Webflow runtime + custom scripts
```

### Key Publishing Pipeline
1. **Input:** User selects a work directory via `showDirectoryPicker()` containing:
   - `landscape/` folder with horizontal orientation images
   - `portrait/` folder with vertical orientation images
2. **Processing:** 
   - `collectPhotoPaths()` validates and collects images by orientation
   - `generator.js` builds HTML for work detail page and list snippet
   - `publish.js` inserts snippet into index and writes files
3. **Output:** Work entry appears on homepage with responsive images at defined breakpoints

### Image Extensions & Breakpoints
- **Supported extensions:** jpg, jpeg, png, webp, avif, gif
- **Landscape widths:** 500, 800, 1080, 1600, 2000, 2600, 3200px
- **Portrait widths:** 500, 800px

### HTML Markers for Dynamic Content
The admin tools inject work snippets after a specific anchor:
```html
<div role="list" class="work-list_list w-dyn-items">
```
This anchor marks where new work entries are inserted in `index.html`.

### Key Conventions

**Slug Generation:**
- Input: "Guadalajara, Mexico" → Output: "guadalajara-mexico"
- Lowercase, trimmed, alphanumeric + hyphens, no leading/trailing hyphens

**Error Handling:**
- Marker folder structure is strict: `workName/landscape` and `workName/portrait` required
- Each orientation folder must contain at least one valid image
- Duplicate slugs in index detected and prevented
- Paths are normalized (`\` → `/`) and URI-encoded

**HTML Generation:**
- All user input (title, subtitle, caption) escaped via HTML entities
- Asset paths prefixed correctly for work detail pages (relative to work/ directory)
- Snippet inserted at anchor with newline preservation

**Testing Philosophy:**
- Tests are comprehensive (26 cases) covering happy paths, error conditions, and cross-platform edge cases
- Error messages are explicit and developer-friendly
- File operations tested through dependency injection (no real files)
- New tests verify case-sensitivity and Windows path separator handling

## Browser Compatibility

Admin publishing interface requires:
- **Chrome 86+** or **Edge 86+** (File System Access API)
- `showDirectoryPicker()` not available in Safari or Firefox

The published portfolio pages work on all modern browsers (standard HTML/CSS).

## Critical: Cross-Platform Path Handling

**This codebase runs on Windows, macOS, and Linux. Case-sensitivity varies by platform:**

- **macOS (default):** Case-insensitive filesystem, but preserves directory case
- **Linux:** Case-sensitive filesystem
- **Windows:** Case-insensitive filesystem, but preserves directory case

### Path Handling Rules
1. **Always preserve exact case** — Directory `peopleOfSicily` must be referenced as `peopleOfSicily`, not `peopleofsicily`
2. **Normalize separators** — `generator.js` converts backslashes (`\`) to forward slashes (`/`) for web URLs
3. **Path sanitization** — All paths are URI-encoded and validated; relative paths with `..` are rejected

### Known Issue (Fixed)
- **Problem:** Directory named `peopleOfSicily` but `index.html` referenced `peopleofsicily` (broke on Linux)
- **Fix:** Updated to use correct case; added tests to prevent regression
- **Prevention:** 2 new cross-platform tests verify case-sensitivity and Windows path separators

See `admin/GENERATOR-SPEC.md` for complete path handling API documentation.

## Getting Started

When enhancing the portfolio:

1. **For publishing fixes/features:** Modify `admin/` files; run tests via `npm test`
2. **For portfolio content:** Add work folders in `work/` directory following the landscape/portrait structure
3. **For styling:** Webflow files are authoritative for design; use `css/thinkdavid.webflow.css` for custom overrides
4. **For new work pages:** Use existing `work/guadalajara-mexico.html` as template (copy, update title/subtitle/images)
5. **For testing rendered pages:** Use Playwright MCP to verify published portfolio pages display correctly
6. **For PR management:** Use GitHub MCP to create PRs and manage issues

Posts should be processed in descending order (newest first).

## MCP Server Integration

See `.github/mcp-servers.md` for complete configuration instructions.

**Three MCP servers are available:**
- **Playwright** — Test published portfolio pages (responsive layout, image loading, lightbox)
- **GitHub** — Manage PRs, issues, and CI/CD workflows
- **Filesystem** — Direct file access within the repository

To use them:
1. Follow setup instructions in `.github/mcp-servers.md`
2. Configure `claude_desktop_config.json` with authentication tokens
3. Ask Copilot to use specific servers: "Use Playwright MCP to test the Sicily page on mobile"
