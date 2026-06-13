# Copilot Instructions for thinkdavid Portfolio

## Project Overview

This is a personal portfolio website for photographer/designer David. The project uses:
- **Frontend:** Webflow-generated HTML/CSS with custom styling
- **Admin tools:** Node.js utilities for publishing portfolio work entries
- **Test framework:** Node's built-in `test` module with `assert/strict`

The core workflow publishes photography work entries by combining directory scanning, HTML generation, and index page updates.

## Testing & Development Commands

### Run Tests
```bash
node admin/publish.test.js
```
All tests pass (20+ test cases covering HTML insertion, file classification, photo collection, and publishing).

### Run Single Test
The test file uses Node's built-in test runner. To run individual tests:
```bash
node --test --grep "insertSnippetAtAnchor" admin/publish.test.js
```

### Test Coverage Areas
- `publish.js` — HTML snippet insertion, marker path classification, photo collection
- `generator.js` — HTML generation, slug creation, image path sanitization
- Error handling for invalid folder structures, missing files, duplicate entries

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
- Tests are comprehensive (20+ cases) covering happy paths and error conditions
- Error messages are explicit and developer-friendly
- File operations tested through dependency injection (no real files)

## Browser Compatibility

Admin publishing interface requires:
- **Chrome 86+** or **Edge 86+** (File System Access API)
- `showDirectoryPicker()` not available in Safari or Firefox

The published portfolio pages work on all modern browsers (standard HTML/CSS).

## Getting Started

When enhancing the portfolio:

1. **For publishing fixes/features:** Modify `admin/` files; run tests via `node admin/publish.test.js`
2. **For portfolio content:** Add work folders in `work/` directory following the landscape/portrait structure
3. **For styling:** Webflow files are authoritative for design; use `css/thinkdavid.webflow.css` for custom overrides
4. **For new work pages:** Use existing `work/guadalajara-mexico.html` as template (copy, update title/subtitle/images)

Posts should be processed in descending order (newest first).
