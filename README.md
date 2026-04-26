# Gridfinity Layout Tool

[![CI](https://github.com/andymai/gridfinity-layout-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/andymai/gridfinity-layout-tool/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/andymai/gridfinity-layout-tool)](https://github.com/andymai/gridfinity-layout-tool/releases)
[![License: AGPL-3.0](https://img.shields.io/github/license/andymai/gridfinity-layout-tool)](./LICENSE)

Plan and design [Gridfinity](https://www.youtube.com/c/ZackFreedman) drawer organizer layouts for 3D printing — right in your browser.

**Live:** [gridfinitylayouttool.com](https://gridfinitylayouttool.com)

## Features

- **Layout Planner** — Drag-and-drop bin placement with multi-layer support
- **3D Preview** — Isometric visualization of your drawer layout
- **Bin Designer** — Parametric 3D bin generator with STL export
- **Print List** — Optimized print list with filament, time, and cost estimates
- **Inspiration Gallery** — Browse curated example layouts across workshop, kitchen, office, hobby, and personal themes
- **Cloud Sharing** — Share layouts via link with optional real-time collaboration
- **PWA** — Installable, works offline

## Built With

| Technology                                   | Purpose                                                |
| -------------------------------------------- | ------------------------------------------------------ |
| [React 19](https://react.dev)                | UI framework                                           |
| [TypeScript](https://www.typescriptlang.org) | Type safety                                            |
| [Zustand](https://github.com/pmndrs/zustand) | State management                                       |
| [Three.js](https://threejs.org)              | 3D visualization                                       |
| [brepjs](https://github.com/andymai/brepjs)  | Parametric 3D geometry & STL export (OpenCascade WASM) |
| [Tailwind CSS 4](https://tailwindcss.com)    | Styling                                                |
| [Vitest](https://vitest.dev)                 | Unit testing                                           |
| [Playwright](https://playwright.dev)         | End-to-end testing                                     |
| [Vercel](https://vercel.com)                 | Hosting & serverless API                               |

## Local Development

Requires **Node.js 20+** and **pnpm 10+**. Use `nvm use` to switch to the correct version (requires [nvm](https://github.com/nvm-sh/nvm)).

```bash
git clone https://github.com/andymai/gridfinity-layout-tool.git
cd gridfinity-layout-tool
nvm use
pnpm install
pnpm run dev           # Development server at localhost:5173
pnpm run build         # Production build
pnpm run test:coverage # Unit tests with coverage
pnpm run test:e2e      # Playwright end-to-end tests
```

### PWA Update Smoke Gate

A two-tier smoke harness verifies that a deploy is healthy before users see it:

1. **CI smoke** — `.github/workflows/smoke-preview.yml` runs Playwright against
   the Vercel PR preview (required check for merge); `smoke-postpromote.yml`
   runs against production and auto-rolls-back on failure.
2. **Client smoke** (PR #2 — pending) — gates an existing user's reload into
   the new bundle behind a hidden-iframe boot test.

Both rely on `?smoke=1`, which boots a synthetic fixture while skipping
layout/library hydration, www-migration recovery, PostHog, and ML telemetry.
See `src/shell/smokeBoot.tsx` and `e2e/smoke/`.

**One-time setup required for the smoke workflows:**

- `VERCEL_AUTOMATION_BYPASS_SECRET` — required by **both** smoke workflows when
  the Vercel project has Deployment Protection enabled (default on paid plans).
  Generate via Vercel project Settings → Deployment Protection → Protection
  Bypass for Automation, then add as a GitHub Actions secret.
- `VERCEL_TOKEN` and `VERCEL_ORG_ID` — required by `smoke-postpromote.yml` so
  `vercel rollback` can run on smoke failure (`vercel rollback` reads the
  linked project from the deployment URL — no separate project ID needed).
- Add `smoke-preview` to branch protection's required status checks (Settings
  → Branches → main → Require status checks).

## Contributing

This project is open source but not open contribution — see [CONTRIBUTING.md](./CONTRIBUTING.md) for details on bug reports, feature requests, and the pull request policy.

## License

[GNU Affero General Public License v3.0](./LICENSE) — see the LICENSE file for details.
