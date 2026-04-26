# CLAUDE.md

Gridfinity Layout Tool: React + TypeScript web app for 3D-printed drawer organizer layouts.

**Stack:** React 19, TypeScript 6, Vite 7, Zustand 5 + Immer, Tailwind CSS 4, Three.js, Vitest, Playwright, PWA, Vercel Blob + Redis, Liveblocks, PostHog.

## Git & Quality

- **Main is protected** - all changes via PRs
- Pre-commit hooks enforce lint-staged, module boundaries, i18n (4 checks), exhaustiveness, affected tests, component structure, missing tests, readme reminders

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
├── core/           # Infrastructure: api/, constants.ts, labs/, result/, storage/, store/, types.ts
├── features/       # Vertical slices (each has README.md): bin-designer, bin-inspector,
│                   # categories, cloud-share, command-palette, design-linking, generation,
│                   # grid-editor, inspiration-gallery, labs, layers, layout-library,
│                   # name-suggestions, onboarding, print-export, staging
├── shared/         # Cross-cutting: analytics/, components/, constants/, contexts/,
│                   # generation/, hooks/, printSettings/, types/, utils/
├── shell/          # App shell: Header/, Sidebar/, Collab/, Mobile/, Modals/,
│                   # Tablet/, layouts/, styles/
├── design-system/  # UI primitives: Button, Checkbox, Dialog, Input, Select, etc.
└── i18n/           # Localization (en, de, es, fr, nb, nl, pt-BR)
```

## Core Architecture

### Stores (`src/core/store/`)

| Store                | Purpose                                                                          |
| -------------------- | -------------------------------------------------------------------------------- |
| `layout.ts`          | Layout data (bins, layers, categories, drawer). Returns `Result<T, LayoutError>` |
| `library.ts`         | Multi-layout library, `activeLayoutId`, thumbnails                               |
| `settings.ts`        | User preferences (localStorage: `gridfinity-settings-v1`)                        |
| `history.ts`         | Undo/redo (max 100). Automatic via CQRS undo capture middleware                  |
| `selection.ts`       | Selected bins, active layer/category                                             |
| `interaction.ts`     | Current interaction, drop targets, layer view mode                               |
| `ui.ts`              | Panel visibility, sidebar state, UI toggles                                      |
| `view.ts`            | 3D preview camera, isometric snap                                                |
| `toast.ts`           | Toast notification queue                                                         |
| `labs.ts`            | Experimental feature flags                                                       |
| `halfBinMode.ts`     | Half-bin toggle state                                                            |
| `mobile.ts`          | Mobile-specific UI state                                                         |
| `layoutAnalytics.ts` | Layout statistics tracking                                                       |
| `sharedPreview.ts`   | Shared preview/embed state                                                       |

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
5. **Wall Pattern Border Rule**: Any feature that cuts through a wall (cutouts, handles, etc.) MUST have corresponding border clipping in `wallPatternBuilder.ts`. Cutout/handle clips use `CUTOUT_BORDER_WIDTH` (1.5mm); divider junction clips use `max(CUTOUT_BORDER_WIDTH, shapeRadius)` so larger hex prisms (4u+ bins) can't bleed into divider walls. Without border clipping, hex prisms overlap the cut region producing jagged edges.

### Result Type (`src/core/result/`)

Use `Result<T, E>` for fallible operations. Import `ok`, `err`, `isOk`, `isErr` from `@/core/result`.

Error types: `LayoutError`, `ValidationError`, `StorageError`, `ApiError`. Use `getUserMessage()` for display.

### Storage (`src/core/storage/`)

**Atomic ops (preferred):** `saveLayoutWithMetadata()`, `createLayoutEntry()`, `deleteLayoutWithEntry()`, `switchActiveLayout()`

Import from `@/core/storage` (public facade).

### Interaction Types (`src/core/types.ts`)

`draw` | `drag` | `resize` | `stagingDrag` | `paint`

**Layer view modes** (`interaction.ts`): `focus` | `stack` | `all`

### CQRS (`src/core/cqrs/`)

| Component   | Purpose                                                   |
| ----------- | --------------------------------------------------------- |
| Commands    | Typed user intents via `createCommand()` factory          |
| Events      | Past-tense domain facts, persisted to IndexedDB           |
| Handlers    | Command -> store mutation + event emission                |
| Middleware  | Validation (Zod), undo capture (Labs), analytics, logging |
| Event Store | IndexedDB append-only with retry queue                    |
| Versioning  | Schema versions + migration registry for persisted events |

See `src/core/cqrs/README.md` for architecture details, adding new commands/events, and migration guide.

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

Add keys to `en.ts` first, then all locale JSONs. Run `pnpm run check:i18n`. Locales: de, en, es, fr, nb, nl, pt-BR.

## API (`api/`)

| Endpoint                    | Purpose                        |
| --------------------------- | ------------------------------ |
| `share.ts`                  | POST: Create share             |
| `share/[id].ts`             | GET/PUT/DELETE share           |
| `liveblocks-auth.ts`        | Liveblocks auth token endpoint |
| `ml-telemetry.ts`           | ML usage telemetry             |
| `report/[id].ts`            | Report shared layout           |
| `lib/rateLimit.ts`          | 100/min (CRUD), 10/hr (report) |
| `lib/validation.ts`         | 500KB max, 2500 bins max       |
| `lib/contentFilter.ts`      | Content moderation             |
| `lib/designerValidation.ts` | Bin designer input validation  |

## Testing

- **Convention:** Colocated sibling tests — `foo.ts` + `foo.test.ts` in the same directory
- **Unit:** Vitest + jsdom. Use `createTestLayout()` from `@/test/testUtils`
- **E2E:** Playwright in `e2e/`. `pnpm run test:e2e`
- **Infrastructure (`src/test/`):** `setup.ts`, `testUtils.ts`, `mocks/` — shared test utilities (stays centralized)
- Pre-commit **blocks** if edited component file has no sibling test
- Run `pnpm run test:coverage` before commit

## Mutation Testing

Complements coverage. Runs nightly via `.github/workflows/mutation-testing.yml`.

**Scope:** `src/core/result`, `src/core/cqrs/{handlers,middleware}`, `src/shared/{utils,generation}`. Generators (`src/features/generation/worker/generators`) are excluded — their scenario tests are too slow to multiply across mutants. Stores, components, and features outside this list are not yet mutated.

| Command                                 | Purpose                                         |
| --------------------------------------- | ----------------------------------------------- |
| `pnpm run test:mutation`                | Full targeted run (~5-10 min with warm cache)   |
| `pnpm run test:mutation:changed`        | Mutates only files changed vs `main` (~2-5 min) |
| `pnpm run test:mutation:file -- <path>` | Single file — iterate on one test quickly       |

Reports land in `reports/mutation/mutation.html`. The incremental baseline (`incremental.json`) flows through CI artifacts — **not committed to git** (~100MB+). The nightly workflow restores the prior baseline, runs Stryker, and uploads the updated one. Locally, your cache builds up after the first run.

**Surviving mutants** indicate tests whose assertions don't cover the mutated logic. Add assertions rather than deleting mutants. Use `// Stryker disable next-line <mutator>` only for genuinely equivalent mutants (e.g., unobservable optimizations).

Threshold is currently **advisory** — PRs are not blocked by mutation score. Will tighten after baseline stabilizes.

## Debugging & Bug Fixing

- **Real dependencies only** — never substitute mocks/stubs for runtime libraries (brepjs, Three.js) to bypass setup issues. Fix the loading problem instead.
- **Reproduce first** — write or run a failing test before changing code.
- **Fix all layers** — bugs spanning UI → store → computation must be verified at each layer. Don't stop at the first fix that silences the visible symptom.
- **Geometry/math validation** — after any generation change, verify: output > 0, no NaN/Infinity, correct coordinate system (grid origin bottom-left, Y-up). Run scenario tests:
  ```bash
  pnpm run test:run -- src/features/generation/worker/generators/binGenerator.scenario
  ```
- **Coordinate transforms** — grid units ↔ mm conversions use `gridUnitMm` (42mm). Height units use `heightUnitMm` (7mm). Never mix unit systems.
- **Common traps**: stale closures in hooks (missing deps), `useShallow` omitted on multi-select, `layers[0]` = bottom (UI reverses display).

## Scripts

```bash
pnpm run dev           # Dev server
pnpm run build         # TypeScript + production build
pnpm run test:coverage # Tests with coverage
pnpm run test:e2e      # Playwright E2E
pnpm run test:mutation # Stryker mutation testing (targeted scope, incremental)
pnpm run quality       # typecheck + lint + knip (dead code)
pnpm run typecheck     # TypeScript check (no emit)
pnpm run lint          # ESLint
pnpm run size          # Bundle size check
```

## Environment Variables

**Vercel (required):** `BLOB_READ_WRITE_TOKEN`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `TOKEN_SALT`

**Optional:** `VITE_LIVEBLOCKS_PUBLIC_KEY`, `LIVEBLOCKS_SECRET_KEY`, `VITE_PUBLIC_POSTHOG_KEY`
