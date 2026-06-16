# Admin Publishing Tools

## Running Tests

**All tests:**
```bash
npm test
```

**Single test by name:**
```bash
npm run test:single "test name pattern"
# Example:
npm run test:single "slugify"
```

**Direct Node execution:**
```bash
node admin/publish.test.js
```

## Cross-Platform Testing

Tests run automatically on GitHub Actions for:
- **Windows** (windows-latest)
- **macOS** (macos-latest)
- **Linux** (ubuntu-latest)

All tests must pass on all platforms before merging.

## Generator Specification

See `admin/GENERATOR-SPEC.md` for API documentation and cross-platform guarantees.

## Common Issues

### Case-Sensitivity on Different Filesystems
- macOS (default): Case-insensitive, but preserves case
- Linux: Case-sensitive
- Windows: Case-insensitive, but preserves case

**Problem:** Directory named `peopleOfSicily` but code references `peopleofsicily` fails on Linux.

**Solution:** Always use exact case matching. Tests verify this.

## Publishing Workflow

1. Select project folder via admin UI (`/admin/index.html`)
2. Fill in metadata (title, subtitle, optional caption)
3. Click "Generate and publish"
4. Admin tools:
   - Collect photos from landscape/portrait folders
   - Generate HTML snippet and work detail page
   - Update `index.html` and `gallery.html`
   - Display generated HTML for review

See `GENERATOR-SPEC.md` for technical details.
