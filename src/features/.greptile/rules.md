# Feature Development Review Guidelines

## Vertical Slice Structure

Each feature is a self-contained vertical slice with a consistent structure:

```
src/features/{feature}/
├── README.md          # Required: architecture, concepts, gotchas
├── index.ts           # Public barrel export (explicit API only)
├── components/        # React components with colocated tests
├── hooks/             # Custom hooks with colocated tests
├── store/             # Feature-specific Zustand stores (optional)
├── types/             # TypeScript definitions (prevents circular deps)
├── constants/         # Feature constants and defaults
├── utils/             # Pure functions
├── storage/           # Feature persistence (optional)
└── workers/           # Web Workers (optional)
```

## Isolation Boundary

Features are isolated modules. The `index.ts` barrel is the contract boundary:

- **Exported**: Components, hooks, types, and constants that other parts of the app need
- **Hidden**: Internal implementation details, sub-components, helper functions

When you see an import like `import { BinDesigner } from '@/features/bin-designer'`, only public API items should resolve. If someone imports `@/features/bin-designer/components/InternalWidget`, that's a violation.

## Component Patterns

- Props interfaces are defined separately from implementation
- Focus management: restore focus after modal/dialog closes
- Portal rendering for modals, tooltips, and overlays
- Keyboard handling: Escape to close, Tab trapping in dialogs
- Error boundaries: `PanelErrorBoundary` wraps feature-level components
- Lazy loading via `lazyWithRetry()` for large components (3D preview ~800KB)

## Interaction Modes

Features involving grid interaction (grid-editor, bin-designer, layers) must handle all five interaction types: `draw`, `drag`, `resize`, `stagingDrag`, `paint`. New interactions should be registered in `src/core/types.ts`.
