# Contributing to Gridfinity Layout Tool

Thank you for your interest in contributing! This guide will help you get set up and productive quickly.

## Quick Start

```bash
# Clone the repository
git clone https://github.com/andymai/gridfinity-layout-tool.git
cd gridfinity-layout-tool

# Use the correct Node version (requires nvm)
nvm use

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at `http://localhost:5173`.

## Development Environment

### Prerequisites

- **Node.js 20+** (see `.nvmrc` - use `nvm use` to switch)
- **npm 10+** (comes with Node 20)
- A modern browser (Chrome, Firefox, or Safari)

### Recommended VS Code Extensions

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) - Linting
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) - Formatting
- [EditorConfig](https://marketplace.visualstudio.com/items?itemName=EditorConfig.EditorConfig) - Consistent settings
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) - CSS autocomplete

### Editor Setup

The project includes `.editorconfig` and `.prettierrc.json` for consistent formatting. Configure your editor to:

1. Format on save using Prettier
2. Use 2-space indentation
3. Use single quotes for strings
4. Trim trailing whitespace

## Available Scripts

### Development

| Command           | Description                         |
| ----------------- | ----------------------------------- |
| `npm run dev`     | Start dev server at localhost:5173  |
| `npm run build`   | Production build with type checking |
| `npm run preview` | Preview production build locally    |

### Code Quality

| Command                    | Description                      |
| -------------------------- | -------------------------------- |
| `npm run lint`             | Run ESLint                       |
| `npm run lint:fix`         | Run ESLint with auto-fix         |
| `npm run format`           | Format all files with Prettier   |
| `npm run format:check`     | Check formatting without writing |
| `npm run check:boundaries` | Validate module boundary rules   |

### Testing

| Command                 | Description                         |
| ----------------------- | ----------------------------------- |
| `npm run test`          | Run unit tests in watch mode        |
| `npm run test:run`      | Run unit tests once                 |
| `npm run test:coverage` | Run tests with coverage report      |
| `npm run test:e2e`      | Run Playwright E2E tests (headless) |
| `npm run test:e2e:ui`   | Run Playwright with interactive UI  |

### Bundle Analysis

| Command              | Description                |
| -------------------- | -------------------------- |
| `npm run size`       | Report bundle sizes        |
| `npm run size:check` | Enforce bundle size limits |

## Pre-commit Hooks

This project uses Husky to run quality checks before each commit:

1. **lint-staged** - ESLint + Prettier on changed files
2. **Module boundaries** - Validates import rules
3. **Build** - Full TypeScript check
4. **Test coverage** - Enforces 83%+ line coverage

If a commit fails, check the error output. Common issues:

- **ESLint errors**: Run `npm run lint:fix` and review remaining issues
- **Type errors**: Run `npm run build` to see full error output
- **Coverage failures**: Add tests for new code

### Bypassing Hooks (Emergency Only)

```bash
git commit --no-verify -m "WIP: emergency fix"
```

Use sparingly - CI will still catch issues.

## Code Style

See [CLAUDE.md](./CLAUDE.md) for comprehensive code style rules. Key points:

### Required

- Use `import type` for type-only imports
- Use explicit types (never `any`, use `unknown`)
- Prefix unused parameters with `_`
- Use strict equality (`===`)
- Use `@/` path alias for imports

### Prohibited

- `any` type
- `console.log` (use `console.warn` or `console.error`)
- `var` keyword
- `==` comparison
- Non-null assertions (`!`)

## Testing Guidelines

### Unit Tests

- Located in `src/test/` or co-located with source files
- Use Testing Library and Vitest
- Focus on behavior, not implementation
- Use `createTestLayout()` factory for test data

```typescript
import { describe, it, expect } from 'vitest';
import { createTestLayout } from '@/test/testUtils';

describe('myFunction', () => {
  it('should handle valid input', () => {
    const layout = createTestLayout({ bins: [...] });
    expect(myFunction(layout)).toBe(expected);
  });
});
```

### E2E Tests

- Located in `e2e/`
- Use Playwright
- Test critical user journeys
- Run against all browsers in CI (Chromium, Firefox, WebKit)

```typescript
import { test, expect } from '@playwright/test';

test('user can create a bin', async ({ page }) => {
  await page.goto('/');
  // ... test steps
});
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with clear commits
3. Ensure all checks pass locally:
   ```bash
   npm run lint && npm run build && npm run test:coverage
   ```
4. Push and open a PR
5. CI will run lint, build, tests, bundle size, and E2E across browsers
6. Address review feedback
7. Merge once approved

### PR Guidelines

- Keep PRs focused and reasonably sized
- Write descriptive commit messages
- Add tests for new functionality
- Update documentation if needed
- Don't include unrelated changes

## Architecture Overview

See [CLAUDE.md](./CLAUDE.md) for detailed architecture documentation, including:

- Directory structure
- State management (Zustand + Immer)
- Core data model
- Component patterns
- Storage layer
- API endpoints

## Getting Help

- Check existing [issues](https://github.com/andymai/gridfinity-layout-tool/issues)
- Read [CLAUDE.md](./CLAUDE.md) for technical details
- Open a new issue for bugs or feature requests

## License

By contributing, you agree that your contributions will be licensed under the project's license.
