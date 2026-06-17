# Add Photos UI for Existing Work Pages

## Goal
Add a new admin UI that lets David append new photos to an already published work page, without creating a new work entry.

## Scope
- New standalone admin page dedicated to adding photos to existing work.
- Reuse existing publishing/path-safety helpers where possible.
- Update existing `work/<slug>.html` files by appending new gallery images.
- Copy/upload selected new source images into the target work folder before HTML update.

Out of scope:
- Reordering existing photos.
- Editing title/subtitle/caption of existing work.
- Replacing existing photos.

## UX and Entry Point
- Add `admin/add-photos.html` and `admin/add-photos.js`.
- Keep visual style and interaction model aligned with current `admin/index.html`.
- Primary flow:
  1. Select project folder.
  2. Pick an existing work page from detected `work/*.html`.
  3. Provide source folder(s) for new images (landscape, portrait, or both).
  4. Run **Add photos**.
  5. Show status and updated HTML preview.

## Functional Design

### 1) Existing Work Discovery
- On project root selection, scan `work/` for `.html` work pages.
- Populate a dropdown for target work selection.
- Value should map to the exact slug/file casing on disk.

### 2) Source Image Intake
- Accept supported extensions already used by publisher logic.
- Allow independent orientation updates:
  - landscape-only
  - portrait-only
  - both
- Require at least one orientation with at least one valid image.

### 3) Image Copy/Upload
- For repository mode, copy selected images into:
  - `work/<slug>/landscape/`
  - `work/<slug>/portrait/`
- If Blob mode is available, upload in the same pattern as current publisher pipeline.
- Keep path normalization and sanitization consistent with existing generator/publish code:
  - preserve exact case
  - normalize separators (`\` -> `/`)
  - URI-encode URL path segments

### 4) HTML Update Strategy
- Load current `work/<slug>.html`.
- Identify landscape and portrait gallery insertion points using existing page structure expectations.
- Build image markup using the same generator logic used for work pages (no duplicate markup implementation).
- Deduplicate by URL/path: if an image is already referenced in the corresponding gallery, skip it.
- Append only newly added images at the end of each target gallery.
- Write the updated HTML back to the same file.

## Error Handling
- Explicit failures for:
  - no project folder selected
  - no existing work pages found
  - selected work page missing/unreadable
  - no valid selected source images
  - gallery markers not found in target page
  - only duplicates selected (nothing to append)
  - copy/upload failure
- Surface errors through existing admin status/field-error patterns.

## Testing Design
Extend `admin/publish.test.js` with append-photo scenarios:
- appends new landscape photos to end of landscape gallery
- appends new portrait photos to end of portrait gallery
- supports one-orientation-only updates
- skips already-present images
- preserves path case and normalizes Windows separators
- fails clearly when expected gallery insertion marker is missing

## Files Expected to Change (Implementation Phase)
- `admin/add-photos.html` (new)
- `admin/add-photos.js` (new)
- `admin/publish.js` (shared append/update helpers)
- `admin/generator.js` (reuse/export helper pieces if needed, without duplication)
- `admin/publish.test.js` (new tests)
- optional: `admin/README.md` or related docs if command/UI usage needs explicit notes

## Success Criteria
- User can append new photos to an existing work page from a dedicated admin page.
- New photos appear at end of selected gallery/orientation.
- No duplicate image references are added.
- Existing cross-platform path safety behavior remains intact.
