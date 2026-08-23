# JSON schema reference

Two documents in this app are meant to be read and written by hand, or by an
agent. This directory describes both.

| Document        | Produced by                         | Reference                      |
| --------------- | ----------------------------------- | ------------------------------ |
| Layout JSON     | Export Layout                       | [layout.md](layout.md)         |
| Bin design JSON | Export design from the bin designer | [bin-design.md](bin-design.md) |

Machine-readable schemas, served so `$schema` resolves:

- `https://gridfinitylayouttool.com/schema/layout.schema.json`
- `https://gridfinitylayouttool.com/schema/bin-design.schema.json`

Every numeric bound and enum, with the constant it comes from, is in
[constraints.md](constraints.md).

## Validate before you import

```bash
pnpm run validate:json path/to/file.json      # one file
pnpm run validate:json docs/schemas/examples  # a directory
```

Two legs are checked and reported separately:

1. **schema**: structure, types, enums, ranges, with exact JSON pointers.
2. **importer**: the rules JSON Schema cannot express.

A file is only safe to import when both pass. Schema validation alone would
accept a file the app then rejects, so treat a green schema leg as necessary,
not sufficient.

### What only the importer can catch

- `bin.category` must name a category that exists in the same file.
- A bin must actually fit: inside the drawer, within its layer's height, not
  overlapping another bin on the same layer.
- `compartments.cells.length` must equal `cols * rows`.
- `cellMask.cells.length` must equal `cols * rows`, at half-bin resolution.
- `splitOverride.cols` must sum to the plate width, `rows` to its depth.

[examples/invalid/importer/](examples/invalid/importer/) holds files that pass
the schema and fail the importer, kept as executable proof of this gap.

## The schema is stricter than the importer

The schemas are an **authoring contract**, not a description of what the app
tolerates. They enforce enums and ranges strictly so a hand-written file is
guided toward correctness.

`required` is the one place they stay honest to the runtime: it lists only what
the importer genuinely rejects a file for. Most `BinParams` fields are
non-optional in TypeScript yet safe to omit in a file, because `migrateParams`
backfills them on load. Omitting them is normal, and both the schema and
`validate:json` accept it.

Unknown properties are allowed in both documents. A newer file validates
against an older schema.

## Traps

These produce files that are valid and wrong, which is worse than invalid.

**Grid origin is bottom-left.** `x` grows right, `y` grows **up**. A bin at
`y: 0` is at the front of the drawer, not the back. Reading `y` as a screen
coordinate mirrors the whole layout vertically.

**`layers[0]` is the bottom layer.** The UI shows layers top-down and reverses
them for display. The file is always bottom-first.

**`__staging__` is not a layer.** A bin whose `layerId` is the literal string
`__staging__` is parked in an off-grid stash: it has coordinates, but they do
not place it in the drawer, and it is exempt from collision checks. It must not
appear in the `layers` array.

**Grid units and millimetres never mix.** `width`, `depth`, `x` and `y` are grid
units. `height` is height **units**, not mm. Anything ending in `Mm` is
millimetres. Conversions are `gridUnitMm` (42 by default) and `heightUnitMm`
(7). Outline vertices are the exception worth memorising: they are in mm even
though everything around them is in grid units.

**Percentages hide among the millimetres.** `walls.width`, `label.width` and
`handles.width` are percentages of their span. `label.depth` and `walls.offset`
are millimetres. `handles.verticalPosition` is a fraction from 0 to 1. The
`Constraint` and `Notes` columns state the unit for every field.

**Half-grid means 0.5, not any decimal.** Drawer and bin dimensions step by 0.5.
`2.25` is not a smaller step, it is invalid.

**IDs are regenerated on import.** Every layer, category and bin id is replaced
and the references remapped. Ids only need to be internally consistent within
the file, so readable ones like `layer-bottom` are better than UUIDs.
`linkedDesignId` is matched against `linkedDesigns[].id` the same way.

**`version` does nothing.** It is always `"1.0"` and no importer branches on it.
Backward compatibility is handled per field by `migrateParams`. Do not reason
about it, and do not bump it.

**A design travels only if you export it.** A layout whose bins carry
`linkedDesignId` but no `linkedDesigns` array arrives with dangling references.
Plain export omits them; "export with designs" includes them.

## Editing an exported file

Keep `_meta` or delete it, either is fine. Adding `$schema` gives you editor
completion and costs nothing, since the importer ignores unknown keys.

The safest loop is small edits plus `validate:json` after each, rather than a
large rewrite validated once. Placement errors compound: one bin moved into
another bin's cells reports as a collision on the _second_ bin, which is rarely
the one you edited.

## Maintaining these docs

The field tables are generated from the schemas by `pnpm run gen:schema-docs`,
which only rewrites the regions between `generated:start` and `generated:end`
markers. Narrative prose around them is hand-written and left alone.

A stale table fails CI, so regenerate after any schema change rather than
editing a table by hand.
