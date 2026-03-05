# Core Architecture Review Guidelines

## Result Type Contract

The `Result<T, E>` pattern is the cornerstone of error handling in this codebase. It replaces exceptions for all expected failure paths.

- `ok(value)` for success, `err(error)` for failure
- Callers must check `isOk(result)` / `isErr(result)` before accessing values
- Error types are discriminated unions with `kind` and `code` fields
- `getUserMessage(error)` provides user-safe error messages; internal details stay in `metadata`
- `tryCatchAsync()` wraps async operations that may throw into `Result`

## Store Boundaries

Each store owns a specific domain and must not reach into other stores' state directly:

- `layout.ts` — layout data (bins, layers, categories, drawer)
- `library.ts` — multi-layout index, active layout tracking
- `selection.ts` — selected bins, active layer/category
- `interaction.ts` — current tool, drop targets, layer view mode
- `history.ts` — undo/redo stack (max 100 via `CONSTRAINTS.UNDO_LIMIT`)

Cross-store coordination happens through hooks (e.g., `useUndoableAction`), not direct store-to-store calls.

## Storage Atomicity

The storage layer provides atomic operations that ensure consistency between layout data and library metadata. Breaking atomicity (e.g., saving layout without updating library entry) creates orphaned or stale state.

Atomic ops: `saveLayoutWithMetadata()`, `createLayoutEntry()`, `deleteLayoutWithEntry()`, `switchActiveLayout()`

## Type Safety

- Branded IDs prevent mixing domains: `BinId` cannot be assigned to `LayerId`
- Brand constructors (`binId()`, `layerId()`) are applied at deserialization boundaries (JSON parse, URL params, user input)
- Internal code passes branded IDs without re-branding
