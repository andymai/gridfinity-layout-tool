# Gridfinity Layout Tool

Web app for designing storage layouts for 3D-printed Gridfinity drawer organizers. Features multi-layer support, drag-and-drop bin placement, 3D isometric preview, print optimization with filament estimation, and responsive design.

**Live:** [gridfinitylayouttool.com](https://gridfinitylayouttool.com)

## Quick Start

```bash
npm install
npm run dev      # Development server at localhost:5173
npm run build    # Production build
npm run test     # Unit tests (watch mode)
npm run test:e2e # Playwright e2e tests
```

## Project Structure

```
src/
├── components/     # React components (Grid/, Sidebar/, modals/, mobile/, tablet/)
├── store/          # Zustand stores (layout, library, ui, history, toast)
├── hooks/          # Custom hooks (useInteraction, useKeyboard, useAutoSave, etc.)
├── utils/          # Pure utilities (validation, collision, fill, split, storage)
├── types.ts        # Core data model (Layout, Bin, Layer, Category)
├── constants.ts    # App constraints and defaults
└── test/           # Vitest unit tests
e2e/                # Playwright e2e tests
```

## Documentation

See **[CLAUDE.md](./CLAUDE.md)** for complete technical documentation:
- Architecture and state management patterns
- Component and hook reference
- Data model and coordinate system
- Code style requirements (pre-commit enforced)
- Testing approach
- Build configuration
