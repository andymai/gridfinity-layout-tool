# Gridfinity Layout Tool

Web app for designing storage layouts for 3D-printed Gridfinity drawer organizers.

**Live:** [gridfinitylayouttool.com](https://gridfinitylayouttool.com)

## Features

- **Layout Planner** - Drag-and-drop bin placement with multi-layer support
- **3D Preview** - Isometric visualization of your drawer layout
- **Bin Designer** - Parametric 3D bin generator with STL export
- **Print List** - Optimized print list with filament estimation
- **Cloud Sharing** - Share layouts via link with optional collaboration
- **Multi-Layout Library** - Manage multiple drawer layouts
- **Responsive Design** - Desktop, tablet, and mobile support
- **PWA** - Installable, works offline

## Quick Start

```bash
npm install
npm run dev      # Development server at localhost:5173
npm run build    # Production build
npm run test     # Unit tests (watch mode)
npm run test:e2e # Playwright e2e tests
```

## Deployment

Deployed via **Vercel** with automatic deployments on push to `main`. Preview deployments for pull requests.

## Documentation

See **[CLAUDE.md](./CLAUDE.md)** for architecture, data model, code style, and testing details.
