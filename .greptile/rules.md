# Gridfinity Layout Tool — Review Guidelines

## Domain Context

This is a React + TypeScript web app for designing 3D-printed Gridfinity drawer organizer layouts. The physical domain introduces constraints that don't exist in typical web apps — coordinate systems map to real-world objects, and incorrect math produces physically unusable prints.

## Critical Domain Gotchas

### Coordinate System (Most Common Bug Source)

- Grid origin `(0,0)` is at the **bottom-left**, not top-left
- `layers[0]` is the **bottom** physical layer; the UI reverses display order via `getDisplayLayers()`
- Grid units map to 42mm physical units (`gridUnitMm`); height units map to 7mm (`heightUnitMm`)
- Never mix unit systems — grid coordinates and mm dimensions must be converted explicitly
- Y-axis inversion: `gridY = drawer.depth - screenY - 1` when converting between screen and grid space

### Staging Layer

- `STAGING_ID` (`'__staging__'`) is a sentinel layer ID for off-grid bins
- Bins are auto-staged when displaced by grid resizes or layer deletions
- Always use the `STAGING_ID` constant, never the raw string literal
- Staging bins must be handled in any code that iterates layers or bins

### Half-Bin Mode

- Enables 0.5-unit grid increments for finer layouts
- Use `snapToHalf()`, `snapToGrid(halfBinMode)`, `isFractional()` from `@/core/constants`
- `HALF_BIN_SCALE = 2` — internal coordinates multiply by 2 for integer math
- Never round grid coordinates manually; always go through snap helpers

## Architecture Rules

### Result Type for Error Handling

All fallible operations return `Result<T, E>` from `@/core/result`:

- Use `ok()` / `err()` constructors, never raw objects
- Error types: `LayoutError`, `ValidationError`, `StorageError`, `ApiError`
- Display errors via `getUserMessage()` — never expose internal error details to users
- Use error constructors from `@/core/result/constructors`, not manual object literals

### Store Patterns (Zustand + Immer)

- All stores use `create<State>()(immer((set, get) => { ... }))`
- Mutations that can fail return `Result<T, E>`
- Mutations that always succeed call `set()` directly with no return value
- Use `useShallow` from Zustand when selecting multiple fields to prevent unnecessary re-renders
- Background persistence is fire-and-forget with error logging

### Storage Layer

- Import only from the public facade: `@/core/storage`
- Never import from `LayoutService`, `LayoutManager`, or `backends/` directly
- Prefer atomic operations: `saveLayoutWithMetadata()`, `createLayoutEntry()`, `deleteLayoutWithEntry()`, `switchActiveLayout()`

## Code Conventions

### Feature Structure (Vertical Slices)

- Each feature in `src/features/` is self-contained with its own components, hooks, stores, types
- Features expose a public API via `index.ts` barrel — internal implementation is hidden
- **No cross-feature imports** — shared code lives in `src/shared/`
- Every feature has a `README.md` documenting architecture, key files, concepts, and gotchas
- Feature changes should be accompanied by README updates when behavior changes

### Testing

- Colocated sibling tests: `foo.tsx` → `foo.test.ts` in the same directory
- Tests use `resetAllStores()` in `beforeEach` for complete isolation
- Use `createTestLayout()` and helpers from `@/test/testUtils`
- Real dependencies only — never mock runtime libraries (brepjs, Three.js) to bypass setup issues

### i18n

- All user-facing strings use `useTranslation()` hook
- Key naming: `feature.context.element` (e.g., `gridEditor.interaction.draw`)
- Interpolation: `{variableName}` syntax
- English locale (`en.ts`) is the source of truth; other locales are JSON files
- Gridfinity domain terms stay in English across all locales

## Geometry & Math Validation

After any generation or coordinate change, verify:

- Output values > 0, no NaN/Infinity
- Correct coordinate system (grid origin bottom-left, Y-up)
- Grid unit ↔ mm conversions use `gridUnitMm` (42mm) and `heightUnitMm` (7mm)
- Bin positions and sizes respect drawer bounds
- Half-bin increments are handled when half-bin mode is active
