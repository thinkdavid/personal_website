# MCP Server Configuration for thinkdavid Portfolio

This file documents the MCP (Model Context Protocol) servers configured for this repository.

## Installation

### Claude Desktop Configuration

Add these servers to `~/.config/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-playwright"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem", "/Users/thinkdavid/Documents/website/website files"]
    }
  }
}
```

### GitHub Token Setup

1. Go to https://github.com/settings/tokens
2. Create a Personal Access Token with scopes:
   - `repo` (full control of private repositories)
   - `workflow` (manage GitHub Actions workflows)
3. Copy the token and add it to the config above

### Other Platforms

For Copilot CLI, Cline, or other tools, refer to their documentation for MCP configuration.

---

## Server Descriptions

### Playwright MCP

**Purpose:** Test published portfolio pages with automated browser testing.

**Capabilities:**
- Navigate to and interact with web pages
- Take screenshots of rendered work entries
- Verify responsive layout across breakpoints (mobile, tablet, desktop)
- Test gallery image loading and lightbox functionality
- Validate HTML structure of generated work pages

**Example use cases:**
```
"Test that the People of Sicily work page renders correctly on mobile"
"Verify all landscape images load at the 1600px breakpoint"
"Check that the cover image displays in the index list"
```

### GitHub MCP

**Purpose:** Automate PR/issue management and repository operations.

**Capabilities:**
- Create and manage pull requests
- Add labels, milestones, and reviews to issues
- Query repository history and branch status
- Manage CI/CD workflow runs
- Post comments on PRs during code review

**Example use cases:**
```
"Create a PR from dabecher/peopleOfSicily with a summary of the changes"
"Add a label 'documentation' to this PR"
"Check the status of the cross-platform test workflow"
```

### Filesystem MCP

**Purpose:** Direct access to repository files for reading/writing operations.

**Root:** `/Users/thinkdavid/Documents/website/website files`

**Capabilities:**
- List directory contents
- Read file contents
- Create new files
- Edit existing files
- Monitor changes

**Safety:** Scoped to repository root only—cannot access files outside this directory.

---

## Usage in This Repository

### When to Use Each Server

| Task | Server | Example |
|------|--------|---------|
| Fix publishing logic | Filesystem + Tests | Edit `admin/publish.js`, run `npm test` |
| Test rendered output | Playwright | Verify new work entry displays correctly |
| Manage PRs | GitHub | Create PR, add labels, request review |
| Complex code review | GitHub + Filesystem | Comment on PR with suggestions, link to relevant code |

### Workflow Example

1. **Develop:** Edit files via Filesystem MCP, run tests locally
2. **Test:** Use Playwright MCP to verify rendered portfolio pages
3. **Review:** Use GitHub MCP to create PR, add context
4. **Deploy:** GitHub Actions (configured in `.github/workflows/test.yml`) handles cross-platform testing

---

## Configuration for This Repository

### Test Fixtures for Playwright

When testing portfolio pages, use these URLs:

- **Index (published works):** `file://.../index.html`
- **Work detail page:** `file://.../work/people-of-sicily.html`
- **Gallery:** `file://.../gallery.html`
- **About:** `file://.../about.html`

### Recommended Playwright Tests

Create `admin/playwright.config.ts` for frontend testing:

```typescript
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'file://./...',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
```

### GitHub Actions Integration

The workflow in `.github/workflows/test.yml` already:
- Runs Node tests on all platforms
- Can be extended to run Playwright tests
- Supports automatic PR checks

---

## Troubleshooting

### GitHub Token Expired
- Generate a new token at https://github.com/settings/tokens
- Update `GITHUB_PERSONAL_ACCESS_TOKEN` in `claude_desktop_config.json`

### Playwright Cannot Find Chrome
- Install Playwright browsers: `npx playwright install`
- Or specify browser path in config

### Filesystem MCP Scope Limited
- Paths are scoped to repository root
- Use relative paths from repository root
- Cannot access `.git/` or files outside the project

