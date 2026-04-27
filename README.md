<div align="center">

# Gridfinity Layout Tool

[![CI](https://github.com/andymai/gridfinity-layout-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/andymai/gridfinity-layout-tool/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/andymai/gridfinity-layout-tool)](https://github.com/andymai/gridfinity-layout-tool/releases)
[![License: AGPL-3.0](https://img.shields.io/github/license/andymai/gridfinity-layout-tool)](./LICENSE)

Plan and design [Gridfinity](https://www.youtube.com/c/ZackFreedman) drawer organizer layouts for 3D printing — right in your browser.

### → [**gridfinitylayouttool.com**](https://gridfinitylayouttool.com)

</div>

## Features

- **Layout Planner** — Drag-and-drop bin placement with stacked layers and color-coded categories
- **3D Preview** — Isometric visualization of your drawer layout
- **Bin Designer** — Parametric 3D bin generator with STL export
- **Baseplate Generator** — 3D-printable Gridfinity baseplates with automatic splitting and STL / STEP / 3MF export
- **Print List** — Optimized print list with filament, time, and cost estimates
- **Inspiration Gallery** — Browse curated example layouts across workshop, kitchen, office, hobby, and personal themes
- **Cloud Sharing** — Share layouts via link with optional real-time collaboration
- **PWA** — Installable, works offline

## Built With

- **[brepjs](https://github.com/andymai/brepjs)** — Parametric 3D geometry & STL export (OpenCascade WASM)
- **[Three.js](https://threejs.org)** — 3D visualization

## Local Development

Requires **Node.js 24+** and **pnpm 10+**. Use `nvm use` to switch to the correct version (requires [nvm](https://github.com/nvm-sh/nvm)).

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

## Contributing

This project is open source but not open contribution — see [CONTRIBUTING.md](./CONTRIBUTING.md) for details on bug reports, feature requests, and the pull request policy.

## License

[GNU Affero General Public License v3.0](./LICENSE) — see the LICENSE file for details.
