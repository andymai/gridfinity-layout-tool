---
name: json-schemas
description: Hand-authoring or editing the two user-facing JSON documents: layout files (drawer, grid, layers, bins, baseplateParams, linkedDesigns) and bin design files (the gridfinity-bin-design wrapper around BinParams). Covers validating a file before import, the cross-field rules JSON Schema cannot express, the unit and orientation traps that produce valid-but-wrong files, and how to change a schema without breaking its four drift guards. Load when writing a layout or design JSON by hand, when an import is rejected, or when adding a field to Layout, Bin, or BinParams.
---

# JSON schemas

## When to use

- Writing or editing a layout `.json` or bin design `.json` by hand, rather than
  through the app.
- An import fails and you need to know which layer rejected it and why.
- You added, removed, or retyped a field on `Layout`, `Drawer`, `Layer`,
  `Bin`, `BinParams`, or any of their sub-configs, and `pnpm run typecheck` or a
  `scripts/schema/` test is now failing.
- You need a field's unit, range, default, or enum values.

## Where everything lives

| What                                  | Where                                                        |
| ------------------------------------- | ------------------------------------------------------------ |
| Prose reference                       | `docs/schemas/README.md`, `layout.md`, `bin-design.md`       |
| Bounds and enums with their constants | `docs/schemas/constraints.md`                                |
| Schemas                               | `public/schema/layout.schema.json`, `bin-design.schema.json` |
| Worked examples                       | `docs/schemas/examples/`                                     |
| Key manifests                         | `src/shared/schema/`                                         |
| Guards and generator                  | `scripts/schema/`                                            |

Read `docs/schemas/README.md` before authoring. It leads with the traps.

## Validate, always

```bash
pnpm run validate:json path/to/file.json
```

Two legs are reported separately, and a file is only importable when both pass:

1. **schema**: structure, types, enums, ranges, with exact JSON pointers.
2. **importer**: the real `validateImport` / `validateImportedBinParams`.

Schema-green does not mean importable. JSON Schema cannot express: a
`bin.category` referencing a category that exists, a bin fitting inside the
drawer and its layer without colliding, `compartments.cells.length === cols * rows`,
`cellMask.cells.length === cols * rows`, or `splitOverride` sums matching the
plate. `docs/schemas/examples/invalid/importer/` holds files that pass the schema
and fail the importer, kept as proof of that gap.

## Traps

These produce files that are valid and wrong.

- **Origin is bottom-left.** `x` grows right, `y` grows **up**. Reading `y` as a
  screen coordinate mirrors the layout vertically.
- **`layers[0]` is the bottom layer.** The UI reverses for display; the file is
  always bottom-first.
- **`__staging__` is not a layer.** A bin with that `layerId` is in the off-grid
  stash: it keeps coordinates, is exempt from collision checks, and must not
  appear in `layers`.
- **Three unit systems.** Grid units (`width`, `depth`, `x`, `y`), height units
  (`height`, and it is not mm), and millimetres (anything ending in `Mm`).
  Outline vertices are the exception worth memorising: mm, while everything
  around them is grid units.
- **Percentages among the millimetres.** `walls.width`, `label.width`,
  `handles.width` are percentages. `label.depth`, `walls.offset` are mm.
  `handles.verticalPosition` is a 0-1 fraction.
- **Half-grid means 0.5.** `2.25` is not a finer step, it is invalid.
- **Ids are regenerated on import**, references remapped. They only need to be
  internally consistent, so `layer-bottom` beats a UUID.
- **`version` is inert.** Always `"1.0"`, never branched on. Back-compat is
  per-field via `migrateParams`. Do not bump it.
- **Designs travel only if exported with them.** A bin with `linkedDesignId` and
  no matching `linkedDesigns` entry arrives dangling.
- **Most `BinParams` fields are omittable.** They are non-optional in TypeScript
  but `migrateParams` backfills them, so a minimal design carries nine fields,
  not twenty config objects.

## Changing a schema

Four guards will stop you if you do half the job. That is the point; read the
failure rather than working around it.

1. **Compile-time key parity.** Add a field to a documented interface and
   `pnpm run typecheck` fails with `{ typeHasKeysTheManifestDoesNotList: "yourField" }`.
   Fix: add it to the manifest in `src/shared/schema/`. Every manifest needs a
   `KeysMatch` assertion, and a test enforces that; the only exemption is
   `UNTYPED_MANIFESTS`, for shapes with no named type.
2. **Manifest to schema parity** (`scripts/schema/keys.test.ts`). Add the
   property to the `$def` too. A new `$def` needs a manifest entry in
   `SCHEMA_KEYS`, or a place in `UNCHECKED_DEFS` if it has no fixed properties.
3. **Constants-derived bounds** (`bounds.test.ts`). A bound that mirrors a
   constant carries `"x-constant": {"maximum": "CONSTRAINTS.GRID_MAX"}`, and
   enums backed by an exported `as const` array carry
   `"x-constant": {"enum": "BIN_STYLES"}`. Add the constant to `SOURCES` in that
   test if it is not there. `MIN_ANNOTATED_BOUNDS` is a ratchet: raise it when
   coverage grows.
4. **Docs parity** (`docs.test.ts`). Run `pnpm run gen:schema-docs` and commit
   the result. A new `$def` also needs a `<!-- schema:Name -->` section in
   `docs/schemas/`.

Then update `docs/schemas/examples/` if the change affects them, and re-run
`pnpm run validate:json docs/schemas/examples`.

### What the guards do NOT check

Key parity checks property **names**, not their types. A field typed `string`
in the schema when the code says `boolean`, or an enum with wrong values, passes
every name-based check. The `x-constant` enum annotations close this for enums
backed by a const array; everything else is on you to verify against the type.
Five such bugs shipped in the first draft and were caught in review.

## Adding a locale-facing link

The schema docs are linked from both import views and both export dialogs via
one shared i18n key. Adding another surface means reusing that key, not adding a
new one.
