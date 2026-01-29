# CLAUDE.md

Gridfinity Layout Tool: React + TypeScript web app for 3D-printed drawer organizer layouts.

**Stack:** React 19, TypeScript 5.9, Vite 7, Zustand 5 + Immer, Tailwind CSS 4, Three.js, Vitest, Playwright, PWA, Vercel Blob + Redis, Liveblocks, PostHog.

## Git & Quality

- **Main is protected** - all changes via PRs
- Pre-commit hooks enforce lint, build, test coverage

## Code Style (Enforced)

| Required                      | Prohibited                |
| ----------------------------- | ------------------------- |
| `import type` for types       | `any` (use `unknown`)     |
| Explicit types                | `console.log`             |
| `useShallow` for multi-select | `var`, `==`               |
| `@/` path alias               | Non-null assertions (`!`) |

## Directory Structure

```
src/
├── core/           # Infrastructure: api/, constants.ts, result/, storage/, store/, types.ts
├── features/       # Vertical slices (each has README.md): bin-designer, bin-inspector,
│                   # categories, cloud-share, generation, grid-editor, inspiration-gallery,
│                   # labs, layers, layout-library, print-export, staging
├── shared/         # Cross-cutting: components/, contexts/, hooks/, utils/
├── components/     # App-level: Collab/, Mobile/, Modals/, Sidebar/, Tablet/
├── hooks/          # App-level hooks + interactions/
├── i18n/           # Localization (en, de, es, fr, nl, pt-BR)
└── layouts/        # Responsive layout shells
```

## Core Architecture

### Stores (`src/core/store/`)

| Store            | Purpose                                                                          |
| ---------------- | -------------------------------------------------------------------------------- |
| `layout.ts`      | Layout data (bins, layers, categories, drawer). Returns `Result<T, LayoutError>` |
| `library.ts`     | Multi-layout library, `activeLayoutId`, thumbnails                               |
| `settings.ts`    | User preferences (localStorage: `gridfinity-settings-v1`)                        |
| `history.ts`     | Undo/redo (max 100). Use `useUndoableAction()`                                   |
| `selection.ts`   | Selected bins, active layer/category                                             |
| `interaction.ts` | Current mode, drop targets, paint mode                                           |

### Data Model (`src/core/types.ts`)

```
Layout → Drawer, Categories[], Layers[], Bins[], printBedSize, gridUnitMm, heightUnitMm
Bin → position (x,y), size (w,d,h), layerId, category, label, notes, customProperties?
```

### Critical Gotchas

1. **Coordinate System**: Grid (0,0) is **bottom-left**. `layers[0]` is bottom. UI reverses via `getDisplayLayers()`.
2. **Staging**: `layerId === '__staging__'` = off-grid stash. Auto-used when bins displaced.
3. **Half-Bin Mode**: 0.5 increments. Helpers: `snapToHalf()`, `snapToGrid()`, `isFractional()`. `HALF_BIN_SCALE = 2`.
4. **Multi-Layout**: Each layout stored by UUID (`gridfinity-layout-{uuid}`). Library index tracks metadata only.

### Result Type (`src/core/result/`)

Use `Result<T, E>` for fallible operations. Import `ok`, `err`, `isOk`, `isErr` from `@/core/result`.

Error types: `LayoutError`, `ValidationError`, `StorageError`, `ApiError`. Use `getUserMessage()` for display.

### Storage (`src/core/storage/`)

**Atomic ops (preferred):** `saveLayoutWithMetadata()`, `createLayoutEntry()`, `deleteLayoutWithEntry()`, `switchActiveLayout()`

Import from `@/core/storage` (public facade).

### Interaction Modes

`draw` | `drag` | `resize` | `stagingDrag` | `paint`

## Key Constants (`src/core/constants.ts`)

| Constraint        | Value        |
| ----------------- | ------------ |
| Grid size         | 0.5-50 units |
| Layers            | 1-10         |
| Categories        | 1-20         |
| Layouts           | 100 max      |
| Undo states       | 100          |
| Grid unit         | 42mm         |
| Height unit       | 7mm          |
| Print bed default | 256mm        |

**Breakpoints:** MD: 768px (mobile/tablet), LG: 900px (tablet/desktop)

## i18n (`src/i18n/`)

```typescript
const t = useTranslation();
t('toast.binsDeleted', { count: 5 }); // Interpolation with {variable}
```

Add keys to `en.ts` first, then all locale JSONs. Run `npm run check:i18n`.

## API (`api/`)

| Endpoint            | Purpose                        |
| ------------------- | ------------------------------ |
| `share.ts`          | POST: Create share             |
| `share/[id].ts`     | GET/PUT/DELETE share           |
| `lib/rateLimit.ts`  | 100/min (CRUD), 10/hr (report) |
| `lib/validation.ts` | 500KB max, 2500 bins max       |

## Testing

- **Convention:** Colocated sibling tests — `foo.ts` + `foo.test.ts` in the same directory
- **Unit:** Vitest + jsdom. Use `createTestLayout()` from `@/test/testUtils`
- **E2E:** Playwright in `e2e/`. `npm run test:e2e`
- **Infrastructure (`src/test/`):** `setup.ts`, `testUtils.ts`, `mocks/` — shared test utilities (stays centralized)
- Pre-commit warns if edited source file has no sibling test (non-blocking)
- Run `npm run test:coverage` before commit

## Scripts

```bash
npm run dev           # Dev server
npm run build         # TypeScript + production build
npm run test:coverage # Tests with coverage
npm run test:e2e      # Playwright E2E
npm run size          # Bundle size check
```

## Environment Variables

**Vercel (required):** `BLOB_READ_WRITE_TOKEN`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `TOKEN_SALT`

**Optional:** `VITE_LIVEBLOCKS_PUBLIC_KEY`, `LIVEBLOCKS_SECRET_KEY`
