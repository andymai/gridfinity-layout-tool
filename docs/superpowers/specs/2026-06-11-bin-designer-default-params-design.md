# Bin Designer — "Set current settings as default for new bins"

**Date:** 2026-06-11
**Status:** Design approved, pending spec review
**Feature slice:** `src/features/bin-designer/`

## Goal

Let a user capture their current bin-designer settings as the **default style for all new bins**. New bins (and in-design "reset to defaults") then start from the user's preferred style/size instead of the hardcoded factory baseline. A one-click **Reset to factory defaults** clears the custom default.

## Decisions (from brainstorming)

| Question         | Decision                                                                                                 |
| ---------------- | -------------------------------------------------------------------------------------------------------- |
| What is captured | **Style/feature prefs only** — reusable settings carry over; per-design geometry resets to factory       |
| Field partition  | **Smart partition incl. size** — dimensions (W×D×H) carry over                                           |
| Compartments     | **Strip whole field** — reset to factory single 1×1 cell                                                 |
| Storage          | **Dedicated designer localStorage key**, via the existing `@/core/storage/backends/localStorage` helpers |
| UI placement     | Overflow ("⋯") menu in the **Saved Designs dialog header**                                               |
| Save UX          | **Instant save + toast**, no confirmation dialog                                                         |
| Scope            | **Both** `newDesign()` and `resetToDefaults()` honor the custom default                                  |

### Out of scope (YAGNI)

Export/import of defaults, multiple named presets, per-section selection UI, cloud sync, analytics events.

## Field partition

Implemented as a **denylist** (not an allowlist) so future style params automatically flow into user defaults.

```
STYLE_DEFAULT_OMIT_KEYS  (stripped → reset to factory on new bins):
  cellMask, compartments, cutouts, inserts, handles, walls, overhang

Carried over (everything else in BinParams):
  width, depth, height, gridUnitMm, heightUnitMm, wallThickness,
  base, style, scoop, label, lid, featureColors, textDefaults,
  wallPattern, slotConfig, dividerPieces, cutoutConfig, splitConnectors
```

`migrateParams()` backfills every stripped key from `DEFAULT_BIN_PARAMS` on load
(`migrateWalls(undefined)` → factory walls; `params.compartments ?? default`;
`cutouts`/`inserts ?? default`; absent `cellMask`/`overhang` → factory). Verified
in `constants/defaults.ts` + `constants/paramMigration.ts`.

## Architecture

### Single overlay chokepoint

Both `newDesign()` (persistenceSlice) and `resetToDefaults()` (paramSlice) already
call `defaultsForNewDesign()` in `store/helpers.ts`. That stays the **only** place
the custom default is read.

```ts
// store/helpers.ts
export function defaultsForNewDesign(): BinParams {
  // (3) widened return type
  const base = loadDefaultParams() ?? DEFAULT_BIN_PARAMS; // user default wins
  const halfGridOn = useHalfGridModeStore.getState().halfGridMode;
  // (2) coupling reads the RESOLVED base style, not DEFAULT_BIN_PARAMS
  if (!halfGridOn || base.base.style === 'flat') return base;
  return { ...base, base: { ...base.base, halfSockets: true } };
}
```

### New module: `storage/defaultParamsStorage.ts`

Thin wrapper over `@/core/storage/backends/localStorage` (mirrors `customBinRegistry`).

```ts
const DEFAULT_PARAMS_KEY = 'gridfinity-designer-default-params-v1';

// Strips per-design geometry, persists the partial.
saveDefaultParams(params: BinParams): Result<void, StorageError>
  → saveToLocalStorage(DEFAULT_PARAMS_KEY, extractStyleDefaults(params))

// Returns a complete, migrated BinParams or null (→ factory fallback).
loadDefaultParams(): BinParams | null
  → loadFromLocalStorage<Partial<BinParams>>(key); isErr/null → null
  → migrated = migrateParams(value)
  → (4) drop a stray cellMask (parity w/ loadDesign belt-and-braces) → return migrated

clearDefaultParams(): void          → deleteFromLocalStorage(key)
hasCustomDefault(): boolean         → existsInLocalStorage(key)
```

### New helper: `extractStyleDefaults` (in `constants/defaults.ts`)

```ts
export const STYLE_DEFAULT_OMIT_KEYS = [
  'cellMask',
  'compartments',
  'cutouts',
  'inserts',
  'handles',
  'walls',
  'overhang',
] as const satisfies readonly (keyof BinParams)[];

export function extractStyleDefaults(params: BinParams): Partial<BinParams> {
  const out: Partial<BinParams> = { ...params }; // Partial → `delete` is type-legal
  for (const k of STYLE_DEFAULT_OMIT_KEYS) delete out[k];
  return out;
}
```

Domain knowledge ("what is a style pref") lives next to `DEFAULT_BIN_PARAMS`;
storage I/O lives in the storage module. Clean separation.

### UI-state normalization fix (correctness, finding #1)

Custom defaults may carry fractional dimensions, so the hardcoded
`halfGridMode = false` in `newDesign()` and the untouched toggle in
`resetToDefaults()` would desync from params.

- `newDesign()`: replace `state.ui.halfGridMode = false` with
  `state.ui.halfGridMode = paramsNeedHalfGridMode(state.params)`.
  `shapeEditorOpen` stays `false` (cellMask always stripped).
- `resetToDefaults()`: after `state.params = { ...defaultsForNewDesign() }`,
  add `state.ui.halfGridMode = paramsNeedHalfGridMode(state.params)` and
  `state.ui.shapeEditorOpen = false`.

### UI: overflow menu in `DesignListDialog` header

A small "⋯" trigger (design-system `Menu.Root`, anchored to the button's
`getBoundingClientRect()` per its position API) beside **New Design**, with:

- **"Set current settings as default for new bins"** — reads
  `useDesignerStore.getState().params`, calls `saveDefaultParams`, fires success
  toast `binDesigner.savedAsDefault`. Instant, no confirm.
- **divider**
- **"Reset to factory defaults"** — `clearDefaultParams()` + toast
  `binDesigner.factoryDefaultsRestored`. Disabled when `hasCustomDefault()` is
  false. A subtle `binDesigner.customDefaultActive` hint renders in the menu
  when a custom default exists.

Local component state (`hasCustomDefault()` read on open, updated after
save/clear) drives the disabled state + hint reactively within the dialog session.

## i18n

New keys in **`en.ts` and `en.json`** (dual-source) + 9 locale JSONs
(de, es, fr, ja, nb, nl, pt-BR, sv, uk):

```
binDesigner.setAsDefault            "Set current settings as default for new bins"
binDesigner.savedAsDefault          "Saved as the default for new bins"
binDesigner.resetFactoryDefaults    "Reset to factory defaults"
binDesigner.factoryDefaultsRestored "Factory defaults restored"
binDesigner.customDefaultActive     "Custom default active"
```

Run `pnpm run check:i18n` for key parity.

## Testing

- `storage/defaultParamsStorage.test.ts` — round-trip; missing key → null;
  corrupt JSON → null; strips geometry keys on save; `migrateParams` backfill on
  load; stray cellMask dropped; `hasCustomDefault`/`clear` behavior.
- `constants/defaults.test.ts` (extend) — `extractStyleDefaults`: every
  `STYLE_DEFAULT_OMIT_KEYS` key absent, representative carried keys present.
- `store/helpers.test.ts` (or persistenceSlice/paramSlice tests) —
  `defaultsForNewDesign()` overlays a stored default; half-grid coupling reads
  resolved base (non-flat → halfSockets true; flat → unchanged); null store →
  `DEFAULT_BIN_PARAMS`.
- `persistenceSlice.test.ts` / `paramSlice` — `newDesign()` and
  `resetToDefaults()` with a fractional-dimension custom default set
  `halfGridMode = true`; with integer default set `false`; geometry keys reset
  to factory.
- `DesignListDialog` interaction test — menu opens; "Set as default" toast +
  persistence; "Reset to factory" disabled when none, enabled + clears when one
  exists.

## Files touched

| File                                               | Change                                                 |
| -------------------------------------------------- | ------------------------------------------------------ |
| `constants/defaults.ts`                            | `STYLE_DEFAULT_OMIT_KEYS`, `extractStyleDefaults`      |
| `storage/defaultParamsStorage.ts`                  | **new** — save/load/clear/has                          |
| `store/helpers.ts`                                 | `defaultsForNewDesign()` overlay + widened return type |
| `store/slices/persistenceSlice.ts`                 | `newDesign()` halfGridMode normalization               |
| `store/slices/paramSlice.ts`                       | `resetToDefaults()` UI-toggle normalization            |
| `components/DesignListDialog/DesignListDialog.tsx` | overflow menu + handlers                               |
| `i18n/en.ts` + `en.json` + 9 locale JSONs          | new keys                                               |
| Colocated `*.test.ts(x)`                           | as above                                               |
