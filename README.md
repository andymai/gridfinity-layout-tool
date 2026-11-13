<div align="center">

# Gridfinity Layout Tool

[![CI](https://github.com/andymai/gridfinity-layout-tool/actions/workflows/ci.yml/badge.svg)](https://github.com/andymai/gridfinity-layout-tool/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/andymai/gridfinity-layout-tool)](https://github.com/andymai/gridfinity-layout-tool/releases)
[![Last release](https://img.shields.io/github/release-date/andymai/gridfinity-layout-tool?label=last%20release)](https://github.com/andymai/gridfinity-layout-tool/releases)
[![Commit activity](https://img.shields.io/github/commit-activity/m/andymai/gridfinity-layout-tool?label=commits%2Fmonth)](https://github.com/andymai/gridfinity-layout-tool/commits/main)
[![License: AGPL-3.0](https://img.shields.io/github/license/andymai/gridfinity-layout-tool)](./LICENSE)

Plan drawer layouts in your browser with [Gridfinity](https://www.youtube.com/c/ZackFreedman), a modular storage system that you 3D print. You can design bins and export baseplates as STL, STEP, or 3MF.

### → [**gridfinitylayouttool.com**](https://gridfinitylayouttool.com)

https://github.com/user-attachments/assets/eb7a7b68-07f0-45b3-9273-ecf1dfcf6a7c

</div>

The video plans an IKEA Alex drawer, from its measured size to the 3MF export of its baseplate. [Watch it on YouTube](https://www.youtube.com/watch?v=X85QnDIGCJc).

<img width="1436" height="847" alt="image" src="https://github.com/user-attachments/assets/17dba424-3a01-4064-b3e9-7742687fc2d5" />

---

<img width="1436" height="844" alt="image" src="https://github.com/user-attachments/assets/30230ac3-bdac-4dcc-83ab-c13b0f40739d" />

---

<img width="1232" height="848" alt="image" src="https://github.com/user-attachments/assets/51db8aaa-8598-4b82-94ce-04f5289a9106" />

## Features

- **Layout Planner.** Place bins with drag and drop, in stacked layers. Each category has its own color.
- **3D Preview.** See your drawer layout in an isometric 3D view.
- **Bin Designer.** A parametric generator makes 3D bins and exports them as STL.
- **Baseplate Generator.** It makes Gridfinity baseplates that you can 3D print. It splits them automatically and exports them as STL, STEP, or 3MF.
- **Print List.** Get a print list with estimates of filament, time, and cost.
- **Inspiration Gallery.** Browse curated example layouts in five themes: workshop, kitchen, office, hobby, and personal.
- **Cloud Sharing.** Share a layout with a link. Real-time collaboration is optional.
- **Cloud Sync.** Sign in with Google or GitHub to sync your layouts and bin designs across devices.
- **PWA.** You can install the app, and it works offline.

## Scope

To set expectations, this tool deliberately does not:

- **Slice models for printing.** Export STL, STEP, or 3MF. Then slice the file in Bambu Studio, PrusaSlicer, OrcaSlicer, or a different slicer.
- **Replace general-purpose CAD.** The Bin Designer is parametric, but it stays within the Gridfinity spec. For other shapes, use Fusion, OpenSCAD, or a different CAD tool.
- **Require accounts.** By default, your layouts stay in your browser. The sign-in for Cloud Sync is opt-in, and Cloud Sharing is opt-in too.
- **Support legacy browsers.** The app needs a browser with WebGL support.

## Built With

- **[brepjs](https://github.com/andymai/brepjs)** makes the parametric 3D geometry and the STL export, with OpenCascade compiled to WebAssembly (WASM).
- **[Three.js](https://threejs.org)** draws the 3D view.

## Local Development

You need **Node.js 26+** and **pnpm 11+**. Run `nvm use` to switch to the correct Node.js version. This command needs [nvm](https://github.com/nvm-sh/nvm).

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

## Self-Hosting

```bash
docker run -d -p 8080:8080 ghcr.io/andymai/gridfinity-layout-tool:latest
```

The image serves the full planner, the designer, and every exporter from your own machine. The features that need the cloud backend stay off: share links, sign-in, and community. See [docs/self-hosting.md](./docs/self-hosting.md) for Compose, reverse proxies, updates, and builds from source.

## Contributing

This project is open source but not open contribution. See [CONTRIBUTING.md](./CONTRIBUTING.md) for bug reports, feature requests, and the pull request policy.

## License

The license is the [GNU Affero General Public License v3.0](./LICENSE).
