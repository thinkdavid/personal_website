# Portfolio Generator Specification

## Purpose

The generator module produces HTML snippets and work detail pages from portfolio metadata. It handles:

- Slug generation for URLs
- HTML entity escaping for security
- Path sanitization for cross-platform compatibility
- Image path URI encoding
- Srcset variant generation

## Critical Guarantees

### Path Handling (Cross-Platform)

**Input paths must work on all platforms:**

- Accept Windows separators (`\`) and normalize to `/` for web URLs
- Preserve exact case of directory/file names as provided
- URI-encode special characters in filenames
- Reject paths with `..` or absolute paths

**Example:**

```javascript
// Input (Windows user)
coverPhotoPath: 'work\\PeopleOfSicily\\landscape\\photo.jpg';

// Output in HTML
src = 'work/PeopleOfSicily/landscape/photo.jpg';
```

**Why case is preserved:** Filesystem enforcement varies:

- macOS (case-insensitive by default): `peopleofsicily` ≠ `peopleOfSicily` mapped to same dir
- Linux (case-sensitive): `peopleofsicily` ≠ `peopleOfSicily` are different files
- Windows (case-insensitive): treated same but preserved in output

### HTML Escaping

**All user input must be escaped:**

- Title, subtitle, caption, alt text
- Escaping includes: `& < > " '`
- Prevents XSS when embedding in HTML attributes

**Example:**

```javascript
title: 'Ruby & Rails';
// Rendered as: Ruby &amp; Rails
```

### Slug Generation

**Rules:**

- Lowercase the input
- Convert non-alphanumeric characters to hyphens
- Remove leading/trailing hyphens
- Examples:
  - "Guadalajara, Mexico" → "guadalajara-mexico"
  - "People of Sicily" → "people-of-sicily"
  - " Leading spaces " → "leading-spaces"

## API Reference

### slugify(title)

Converts a title to a URL-safe slug.

- Input: string (title)
- Output: string (lowercase, hyphenated)

### buildSnippetHtml(template, payload)

Generates the index list item HTML for a work entry.

- Inputs:
  - `template`: HTML string with {placeholders}
  - `payload.title`, `payload.subtitle`, `payload.slug`, `payload.coverPhotoPath`, `payload.coverPhotoAlt`
- Output: HTML string with all placeholders replaced and paths sanitized
- Security: All user input escaped, paths URI-encoded

### buildWorkPageHtml(template, payload)

Generates the work detail page HTML.

- Inputs:
  - `template`: HTML string with {placeholders}
  - `payload.title`, `payload.subtitle`, `payload.coverPhotoPath`, `payload.landscapePhotos`, `payload.portraitPhotos`, `payload.caption`
- Output: HTML string with gallery items inserted and paths prefixed with `../`
- Security: All user input escaped, paths URI-encoded, cover photo excluded from gallery

## Testing Strategy

**Every change to generator.js must pass:**

1. All 26+ existing tests in `publish.test.js`
2. Cross-platform path tests (case-sensitivity, Windows separators)
3. Manual verification on target platform (macOS, Linux, or Windows)

**Before deploying:**

- Run full test suite: `node admin/publish.test.js`
- Verify on GitHub Actions (runs on macOS, Ubuntu, Windows)

## Known Issues & Fixes

### People of Sicily Path Mismatch (Fixed)

- **Issue:** Directory named `peopleOfSicily` but index.html referenced `peopleofsicily`
- **Root Cause:** Case-sensitive filesystem mismatch not caught by tests
- **Fix:** Updated index.html to use correct case
- **Prevention:** Added cross-platform path tests for case-sensitivity
