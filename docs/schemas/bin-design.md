# Bin design JSON reference

The document produced by **Export design** in the bin designer. One bin, and
optionally its companion solids (lid, knife rest).

- Schema: `https://gridfinitylayouttool.com/schema/bin-design.schema.json`
- Examples: [bin-design-minimal.json](examples/bin-design-minimal.json), [bin-design-full.json](examples/bin-design-full.json)
- Validate: `pnpm run validate:json path/to/file.json`

Read [README.md](README.md) first for the traps that apply to both formats.

Unlike the layout format, this one is a **wrapper**, not a flat spread. The
parameters live under `params`:

```json
{ "type": "gridfinity-bin-design", "version": "1.0", "name": "...", "params": {} }
```

## What you can leave out

Almost everything. `BinParams` declares most fields as non-optional in
TypeScript, but `migrateParams` backfills every one of them on load, so a file
carrying only the nine required fields imports fine and picks up defaults for
the rest.

That is why the minimal example is nine lines of parameters rather than
twenty configuration objects. Add a config object when you want to change it,
not to satisfy the shape.

## Document root

<!-- schema:root:bin-design.schema.json -->

<!-- generated:start -->

| Field     | Type                        | Required | Default | Constraint  | Notes                                                                                                                                 |
| --------- | --------------------------- | -------- | ------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `$schema` | `string`                    |          |         |             | Optional pointer to this schema. Ignored by the importer; present only so editors offer completion.                                   |
| `type`    | `"gridfinity-bin-design"`   | yes      |         |             | Document discriminator. The importer rejects any other value.                                                                         |
| `version` | `"1.0"`                     | yes      |         |             | Document format version. Always "1.0". The importer never branches on it; backward compatibility is handled by migrateParams instead. |
| `name`    | `string`                    | yes      |         | length >= 1 | Design name. Also seeds the export filename.                                                                                          |
| `params`  | [`BinParams`](#binparams)   | yes      |         |             |                                                                                                                                       |
| `_meta`   | [`ExportMeta`](#exportmeta) |          |         |             |                                                                                                                                       |

<!-- generated:end -->

## Parameters

Dimensions are in **grid units**; `height` is in height **units**, not mm.
Anything ending in `Mm` is millimetres.

Two fields are injected at generation time and should not appear in a file you
wrote: `magnetAnchor` comes from the owning layout so bin, lid and baseplate
magnets stay mated, and `nozzleSizeMm` comes from the local print setting and is
deliberately never persisted, so a printer's nozzle never syncs to other devices
or rides along in a shared design.

<!-- schema:BinParams -->

<!-- generated:start -->

| Field                   | Type                                            | Required | Default  | Constraint              | Notes                                                                                                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------- | -------- | -------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`                 | `number`                                        | yes      |          | >= 0.5, <= 16, step 0.5 | Width in grid units. 0.5 increments allowed.                                                                                                                                                                                                                              |
| `depth`                 | `number`                                        | yes      |          | >= 0.5, <= 16, step 0.5 | Depth in grid units. 0.5 increments allowed.                                                                                                                                                                                                                              |
| `height`                | `number`                                        | yes      |          | >= 1, <= 50, step 1     | Height in HEIGHT units, not mm. 1u is base only and is legal for spacers; every other base style needs at least 2u for a usable cavity.                                                                                                                                   |
| `fractionalEdgeX`       | `"start"` \| `"end"`                            |          | `"end"`  |                         | Side the half-unit foot column sits on when width is fractional. 'end' = right, 'start' = left. Lets a 2.5x2 bin pick its side without rotating the print, which would move the front scoop.                                                                              |
| `fractionalEdgeY`       | `"start"` \| `"end"`                            |          | `"end"`  |                         | Side the half-unit foot row sits on when depth is fractional. 'end' = back, 'start' = front.                                                                                                                                                                              |
| `fractionalEdgeManualX` | `boolean`                                       |          | `false`  |                         | True once the user deliberately chose the X fractional edge. Suppresses the drawer-mismatch warning for that axis only.                                                                                                                                                   |
| `fractionalEdgeManualY` | `boolean`                                       |          | `false`  |                         | True once the user deliberately chose the Y fractional edge.                                                                                                                                                                                                              |
| `gridUnitMm`            | `number`                                        | yes      | `42`     | >= 20, <= 60            | Millimetres per grid unit along X. Also the square grid unit when gridUnitMmY is omitted.                                                                                                                                                                                 |
| `gridUnitMmY`           | `number`                                        |          |          | >= 20, <= 60            | Millimetres per grid unit along Y for a non-square grid, e.g. 42x22. Omitted or equal to gridUnitMm means square. Only the cell pitch stretches; round features stay isotropic.                                                                                           |
| `magnetAnchor`          | `"edge"` \| `"center"`                          |          | `"edge"` |                         | Magnet hole anchor. INJECTED from the owning layout at generation time so bin, lid and baseplate magnets stay mated. Do not rely on it in a standalone design file.                                                                                                       |
| `nozzleSizeMm`          | `number`                                        |          | `0.4`    | > 0                     | Print nozzle in mm that a label socket's pocket clearance scales to. INJECTED transiently at generation time and never persisted, so a printer's nozzle never syncs to other devices or rides along in a shared design. Should not appear in an exported file.            |
| `heightUnitMm`          | `number`                                        | yes      | `7`      | >= 3, <= 20             | Millimetres per height unit. Standard Gridfinity is 7.                                                                                                                                                                                                                    |
| `wallThickness`         | `number`                                        | yes      |          | >= 0.4, <= 2.4          | Outer wall thickness in mm. 0.4 is one wall line on a 0.4mm nozzle; 2.4 is three lines on a 0.8mm nozzle.                                                                                                                                                                 |
| `base`                  | [`BaseConfig`](#baseconfig)                     | yes      |          |                         |                                                                                                                                                                                                                                                                           |
| `style`                 | `"standard"` \| `"slotted"` \| `"solid"`        | yes      |          |                         | Bin interior style. 'standard' is a walled cavity, 'slotted' adds divider slots, 'solid' is a filled block that cutouts are cut into.                                                                                                                                     |
| `compartments`          | [`CompartmentConfig`](#compartmentconfig)       | yes      |          |                         |                                                                                                                                                                                                                                                                           |
| `scoop`                 | [`ScoopConfig`](#scoopconfig)                   |          |          |                         |                                                                                                                                                                                                                                                                           |
| `label`                 | [`LabelTabConfig`](#labeltabconfig)             |          |          |                         |                                                                                                                                                                                                                                                                           |
| `walls`                 | [`WallConfig`](#wallconfig)                     |          |          |                         |                                                                                                                                                                                                                                                                           |
| `slide`                 | [`SlideConfig`](#slideconfig)                   |          |          |                         |                                                                                                                                                                                                                                                                           |
| `handles`               | [`HandleConfig`](#handleconfig)                 |          |          |                         |                                                                                                                                                                                                                                                                           |
| `slotConfig`            | [`SlotConfig`](#slotconfig)                     |          |          |                         |                                                                                                                                                                                                                                                                           |
| `dividerPieces`         | [`DividerPieceConfig`](#dividerpiececonfig)     |          |          |                         |                                                                                                                                                                                                                                                                           |
| `inserts`               | [`Insert`](#insert)[]                           |          |          |                         | Cavities cut into the bin floor. May be empty.                                                                                                                                                                                                                            |
| `cutouts`               | [`Cutout`](#cutout)[]                           |          |          |                         | Top-down cavity cuts, used mainly by the 'solid' style. May be empty.                                                                                                                                                                                                     |
| `cutoutConfig`          | [`CutoutConfig`](#cutoutconfig)                 |          |          |                         |                                                                                                                                                                                                                                                                           |
| `meshAssets`            | object of [`MeshAsset`](#meshasset)             |          |          |                         | Imported STL imprint meshes keyed by the id that a shape 'mesh' Cutout's meshId references. Omit for designs without mesh imprints.                                                                                                                                       |
| `wallPattern`           | [`WallPatternConfig`](#wallpatternconfig)       |          |          |                         |                                                                                                                                                                                                                                                                           |
| `floorPattern`          | [`FloorPatternConfig`](#floorpatternconfig)     |          |          |                         |                                                                                                                                                                                                                                                                           |
| `splitConnectors`       | [`SplitConnectorConfig`](#splitconnectorconfig) |          |          |                         |                                                                                                                                                                                                                                                                           |
| `featureColors`         | [`FeatureColorConfig`](#featurecolorconfig)     |          |          |                         |                                                                                                                                                                                                                                                                           |
| `textDefaults`          | [`TextStyleDefaults`](#textstyledefaults)       |          |          |                         |                                                                                                                                                                                                                                                                           |
| `surfaceText`           | [`SurfaceTextConfig`](#surfacetextconfig)       |          |          |                         |                                                                                                                                                                                                                                                                           |
| `lid`                   | [`LidConfig`](#lidconfig)                       |          |          |                         |                                                                                                                                                                                                                                                                           |
| `knifeRest`             | [`KnifeRestConfig`](#kniferestconfig)           |          |          |                         |                                                                                                                                                                                                                                                                           |
| `cellMask`              | [`CellMask`](#cellmask)                         |          |          |                         |                                                                                                                                                                                                                                                                           |
| `overhang`              | [`OverhangConfig`](#overhangconfig)             |          |          |                         |                                                                                                                                                                                                                                                                           |
| `extraWallHeightMm`     | `number`                                        |          | `0`      | >= 0, <= 100            | Extra exterior wall height in mm ABOVE the nominal bin height. Outer walls and stacking lip rise; the interior floor, cutouts, dividers, scoops and label tabs stay anchored at the original top plane. A collar of dead headroom. 0 reproduces the standard bin exactly. |

<!-- generated:end -->

## Base

How the bin attaches to a baseplate, and what its underside looks like. The bin
coordinate system puts Z=0 at the socket-box interface.

`style` is a string union, not an enum with independent flags: the UI presents
booleans and derives the style from them via `computeBaseStyle()`. Setting
`style` to `magnet` is what turns magnet holes on, not a separate toggle.

`spacer` is the one base that may be 1u tall. Every other style needs at least
2u, because 1u is base only with no usable cavity.

<!-- schema:BaseConfig -->

<!-- generated:start -->

| Field             | Type                                                                                                   | Required | Default      | Constraint  | Notes                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------ | -------- | ------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `style`           | `"standard"` \| `"magnet"` \| `"screw"` \| `"magnet_and_screw"` \| `"weighted"` \| `"flat"` \| `"lid"` | yes      |              |             | Base attachment style. This is a string union, not an enum: the UI derives it from boolean toggles via computeBaseStyle().   |
| `magnetDiameter`  | `number`                                                                                               |          |              | >= 4, <= 10 | Magnet hole diameter in mm.                                                                                                  |
| `magnetDepth`     | `number`                                                                                               |          |              | >= 1, <= 4  | Magnet hole depth in mm.                                                                                                     |
| `screwDiameter`   | `number`                                                                                               |          |              | >= 2, <= 6  | Screw hole diameter in mm.                                                                                                   |
| `stackingLip`     | `boolean`                                                                                              |          |              |             | Add the Gridfinity stacking lip at the rim so another bin can sit on top.                                                    |
| `solid`           | `boolean`                                                                                              |          |              |             | Fill the base solid instead of hollowing it.                                                                                 |
| `halfSockets`     | `boolean`                                                                                              |          |              |             | Use half-pitch sockets on the underside.                                                                                     |
| `footLatticeX`    | `"grid"` \| `"half"`                                                                                   |          | `"grid"`     |             | Foot lattice pitch along X. 'half' places feet every 0.5 unit.                                                               |
| `footLatticeY`    | `"grid"` \| `"half"`                                                                                   |          | `"grid"`     |             | Foot lattice pitch along Y.                                                                                                  |
| `lightweight`     | `boolean`                                                                                              |          |              |             | Remove material to save filament.                                                                                            |
| `lightweightMode` | `"interior"` \| `"underside"`                                                                          |          | `"interior"` |             | Where lightweighting removes material.                                                                                       |
| `feet`            | `"integral"` \| `"detachable"`                                                                         |          | `"integral"` |             | Whether feet are printed as part of the body or as separate pin-mounted parts.                                               |
| `feetPinDiameter` | `2.7` \| `2.8` \| `2.9` \| `3`                                                                         |          | `2.8`        |             | Pin diameter in mm for detachable feet. Only meaningful when feet is 'detachable'.                                           |
| `spacer`          | `boolean`                                                                                              |          |              |             | Build a floorless spacer used to shim a stack between odd and even total heights. A spacer may be 1u tall; nothing else may. |
| `tile`            | `boolean`                                                                                              |          |              |             | Build a baseplate-style tile rather than a bin body.                                                                         |
| `trayBottom`      | [`TrayBottomConfig`](#traybottomconfig)                                                                |          |              |             |                                                                                                                              |

<!-- generated:end -->

### TrayBottomConfig

Turns the underside into a lid-like tray bottom that mates with the bin below.

<!-- schema:TrayBottomConfig -->

<!-- generated:start -->

| Field               | Type                                                                     | Required | Default | Constraint    | Notes                                                                    |
| ------------------- | ------------------------------------------------------------------------ | -------- | ------- | ------------- | ------------------------------------------------------------------------ |
| `attachment`        | `"friction"` \| `"clickRails"` \| `"magnetic"` \| `"slide"` \| `"hinge"` | yes      |         |               | How the tray bottom attaches to the bin below.                           |
| `extraHeightMm`     | `number`                                                                 | yes      |         | >= 0          | Extra skirt depth in mm to clear contents protruding from the bin below. |
| `clickRails`        | [`SideFlags`](#sideflags)                                                |          |         |               |                                                                          |
| `clickRailCoverage` | `number`                                                                 |          |         | >= 50, <= 100 | Percentage of each rail's side that carries the click feature.           |
| `retentionMagnet`   | [`LidMagnetConfig`](#lidmagnetconfig)                                    |          |         |               |                                                                          |

<!-- generated:end -->

### SideFlags

Per-side booleans, used by click rails and lid grips. `front`/`back` are -Y/+Y
and `left`/`right` are -X/+X, matching the grid.

<!-- schema:SideFlags -->

<!-- generated:start -->

| Field   | Type      | Required | Default | Constraint | Notes    |
| ------- | --------- | -------- | ------- | ---------- | -------- |
| `front` | `boolean` | yes      |         |            | -Y side. |
| `back`  | `boolean` | yes      |         |            | +Y side. |
| `left`  | `boolean` | yes      |         |            | -X side. |
| `right` | `boolean` | yes      |         |            | +X side. |

<!-- generated:end -->

## Compartments

The interior grid. `cells` is **row-major** and its length must equal
`cols * rows`; the importer rejects a mismatch, and the schema cannot see it.

Cells sharing an id are one merged compartment. The per-compartment arrays
(`compartmentTexts`, `labelIcons`, `compartmentColors` and the rest) are
parallel to the compartment id space, not to `cells`, and are remapped together
when compartments merge or split.

The 12x12 ceiling is a generation-time budget, not an arbitrary limit: a 12x12
grid finishes in about 14s, while 16x16 reaches ~39s and risks a timeout.

<!-- schema:CompartmentConfig -->

<!-- generated:start -->

| Field                    | Type                                          | Required | Default | Constraint     | Notes                                                                                                                  |
| ------------------------ | --------------------------------------------- | -------- | ------- | -------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `cols`                   | `integer`                                     | yes      |         | >= 1, <= 12    | Compartment columns. Capped at 12 because a 16x16 grid risks a generation timeout.                                     |
| `rows`                   | `integer`                                     | yes      |         | >= 1, <= 12    | Compartment rows.                                                                                                      |
| `thickness`              | `number`                                      | yes      |         | >= 0.4, <= 2.4 | Divider wall thickness in mm.                                                                                          |
| `cells`                  | `integer`[]                                   | yes      |         |                | Row-major compartment id per grid cell. Length MUST equal cols * rows. Cells sharing an id are one merged compartment. |
| `compartmentTexts`       | `string` \| `null`[]                          |          |         |                | Per-compartment engraved text, parallel to the compartment id space.                                                   |
| `labelPlateWidths`       | `number` \| `null`[]                          |          |         |                | Per-compartment label plate width in grid units.                                                                       |
| `labelIcons`             | `string` \| `null`[]                          |          |         |                | Per-compartment label icon id.                                                                                         |
| `compartmentColors`      | `string` \| `null`[]                          |          |         |                | Per-compartment hex colour for multi-colour export.                                                                    |
| `compartmentColorScopes` | `"floor"` \| `"floorAndWalls"` \| `null`[]    |          |         |                | Whether a compartment's colour covers just its floor or its walls too.                                                 |
| `dividerOverrides`       | [`DividerOverride`](#divideroverride)[]       |          |         |                | Per-divider geometry overrides.                                                                                        |
| `drawnUnitCells`         | `integer`[]                                   |          |         |                | Unit cells painted by the compartment drawing tool.                                                                    |
| `stash`                  | [`StashedCompartment`](#stashedcompartment)[] |          |         | items <= 36    | Bento stash of saved compartment shapes.                                                                               |
| `dividerHeight`          | `number`                                      |          |         | >= 0           | Divider wall height in mm. Shorter than the cavity leaves an open top between compartments.                            |

<!-- generated:end -->

### DividerOverride

<!-- schema:DividerOverride -->

<!-- generated:start -->

| Field          | Type      | Required | Default | Constraint | Notes                                    |
| -------------- | --------- | -------- | ------- | ---------- | ---------------------------------------- |
| `compartmentA` | `integer` | yes      |         |            | First compartment id.                    |
| `compartmentB` | `integer` | yes      |         |            | Second compartment id.                   |
| `offsetStart`  | `number`  |          |         |            | Offset in mm at the divider's start end. |
| `offsetEnd`    | `number`  |          |         |            | Offset in mm at the divider's far end.   |
| `rakeDeg`      | `number`  |          |         |            | Divider rake angle in degrees.           |

<!-- generated:end -->

### StashedCompartment

<!-- schema:StashedCompartment -->

<!-- generated:start -->

| Field   | Type      | Required | Default | Constraint | Notes                                          |
| ------- | --------- | -------- | ------- | ---------- | ---------------------------------------------- |
| `w`     | `integer` | yes      |         | >= 1       | Width in compartment cells.                    |
| `h`     | `integer` | yes      |         | >= 1       | Height in compartment cells.                   |
| `label` | `string`  |          |         |            | Optional label carried with the stashed shape. |

<!-- generated:end -->

## Scoop

A ramp at one wall so contents can be scooped out.

<!-- schema:ScoopConfig -->

<!-- generated:start -->

| Field           | Type                                           | Required | Default    | Constraint   | Notes                                                                      |
| --------------- | ---------------------------------------------- | -------- | ---------- | ------------ | -------------------------------------------------------------------------- |
| `enabled`       | `boolean`                                      | yes      |            |              | Enable the scoop.                                                          |
| `side`          | `"front"` \| `"back"` \| `"left"` \| `"right"` | yes      |            |              | Which wall the scoop rises from.                                           |
| `radius`        | `number`                                       | yes      |            | >= 5, <= 25  | Scoop radius in mm.                                                        |
| `run`           | `number`                                       |          |            | >= 0, <= 140 | Horizontal run of the scoop in mm.                                         |
| `style`         | `"curved"` \| `"straight"`                     |          | `"curved"` |              | Scoop cross-section.                                                       |
| `autoMaxHeight` | `boolean`                                      |          |            |              | Let the scoop rise to the tallest printable height instead of a fixed one. |

<!-- generated:end -->

## Walls

Cutouts taken out of the bin's walls. Watch the units: `width` and `depth` are
**percentages** of the wall span and height, while `offset` and `widthMm` are
millimetres. Setting `widthMm` overrides the percentage `width`.

A `null` corner radius is meaningful rather than absent: on `WallConfig` it
means square (which is what every design saved before the control existed
already had), and on a per-side `WallCutout` it means "defer to the
`WallConfig` default".

<!-- schema:WallConfig -->

<!-- generated:start -->

| Field                | Type                                   | Required | Default | Constraint   | Notes                                                                                                           |
| -------------------- | -------------------------------------- | -------- | ------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| `enabled`            | `boolean`                              | yes      |         |              | Master toggle for wall cutouts.                                                                                 |
| `shape`              | `"u-shape"` \| `"scoop"` \| `"funnel"` | yes      |         |              | Cutout shape applied to all sides.                                                                              |
| `width`              | `number`                               | yes      |         | >= 0, <= 100 | Default cutout width as a PERCENTAGE of the wall span, for sides without an override.                           |
| `depth`              | `number`                               | yes      |         | >= 0, <= 100 | Default cutout depth as a PERCENTAGE of wall height, measured from the top.                                     |
| `cornerRadiusTop`    | `number` \| `null`                     |          |         | >= 0         | Default shoulder round-over in mm. null means square, which is what every design saved before this control had. |
| `cornerRadiusBottom` | `number` \| `null`                     |          |         | >= 0         | Default bottom fillet in mm. null means the automatic 15%-of-span rule.                                         |
| `front`              | [`WallCutout`](#wallcutout)            | yes      |         |              |                                                                                                                 |
| `back`               | [`WallCutout`](#wallcutout)            | yes      |         |              |                                                                                                                 |
| `left`               | [`WallCutout`](#wallcutout)            | yes      |         |              |                                                                                                                 |
| `right`              | [`WallCutout`](#wallcutout)            | yes      |         |              |                                                                                                                 |
| `interior`           | [`WallCutout`](#wallcutout)            | yes      |         |              |                                                                                                                 |

<!-- generated:end -->

### WallCutout

<!-- schema:WallCutout -->

<!-- generated:start -->

| Field                | Type                                | Required | Default | Constraint   | Notes                                                                                      |
| -------------------- | ----------------------------------- | -------- | ------- | ------------ | ------------------------------------------------------------------------------------------ |
| `enabled`            | `boolean`                           | yes      |         |              | Whether this side's cutout is on.                                                          |
| `width`              | `number`                            | yes      |         | >= 0, <= 100 | Cutout width as a PERCENTAGE of the wall span. Ignored when widthMm is set.                |
| `depth`              | `number`                            | yes      |         | >= 0, <= 100 | Cutout depth as a PERCENTAGE of wall height, from the top.                                 |
| `alignment`          | `"left"` \| `"center"` \| `"right"` | yes      |         |              | Horizontal alignment within the wall span.                                                 |
| `offset`             | `number`                            | yes      |         |              | Horizontal offset from the alignment anchor in MILLIMETRES. Positive is toward right/back. |
| `widthMm`            | `number` \| `null`                  | yes      |         | >= 0         | Absolute cutout width in mm. When null, the percentage width is used instead.              |
| `cornerRadiusTop`    | `number` \| `null`                  |          |         | >= 0         | Shoulder round-over in mm. null defers to WallConfig.cornerRadiusTop.                      |
| `cornerRadiusBottom` | `number` \| `null`                  |          |         | >= 0         | Bottom fillet in mm. null defers to WallConfig.cornerRadiusBottom.                         |

<!-- generated:end -->

## Wall and floor patterns

The pattern cut is the single most expensive step in generation. Cost is driven
by the boolean operation, not tessellation, so a smaller `scale` (more, finer
cells) on a large bin is what pushes a design toward the timeout.

The last seven wall patterns are kumiko patterns. The floor pattern list is a
subset: kumiko is not available there.

Floor perforation cuts through the floor slab **and** the base socket beneath
it, so holes drain rather than ending in a blind pocket.

<!-- schema:WallPatternConfig -->

<!-- generated:start -->

| Field      | Type                                                                                                                                                                               | Required | Default | Constraint | Notes                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------- | ---------- | --------------------------------------------------------------------- |
| `enabled`  | `boolean`                                                                                                                                                                          | yes      |         |            | Enable the wall pattern.                                              |
| `pattern`  | `"honeycomb"` \| `"round"` \| `"diamond"` \| `"triangle"` \| `"slots"` \| `"mitsukude"` \| `"goma"` \| `"asanoha"` \| `"sakura"` \| `"rindo"` \| `"mikado"` \| `"tsumiishi-kikko"` | yes      |         |            | Pattern type. The last seven are kumiko patterns.                     |
| `scale`    | `number`                                                                                                                                                                           | yes      | `0.5`   | > 0        | Pattern cell scale. Smaller means more, finer cells and a slower cut. |
| `dividers` | `boolean`                                                                                                                                                                          |          |         |            | Also apply the pattern to interior divider walls.                     |
| `sides`    | [`WallPatternSides`](#wallpatternsides)                                                                                                                                            | yes      |         |            |                                                                       |

<!-- generated:end -->

### WallPatternSides

<!-- schema:WallPatternSides -->

<!-- generated:start -->

| Field   | Type      | Required | Default | Constraint | Notes    |
| ------- | --------- | -------- | ------- | ---------- | -------- |
| `left`  | `boolean` | yes      |         |            | -X wall. |
| `right` | `boolean` | yes      |         |            | +X wall. |
| `front` | `boolean` | yes      |         |            | -Y wall. |
| `back`  | `boolean` | yes      |         |            | +Y wall. |

<!-- generated:end -->

### FloorPatternConfig

<!-- schema:FloorPatternConfig -->

<!-- generated:start -->

| Field     | Type                                                                   | Required | Default | Constraint | Notes                                                                                      |
| --------- | ---------------------------------------------------------------------- | -------- | ------- | ---------- | ------------------------------------------------------------------------------------------ |
| `enabled` | `boolean`                                                              | yes      |         |            | Enable floor perforation.                                                                  |
| `pattern` | `"round"` \| `"honeycomb"` \| `"diamond"` \| `"triangle"` \| `"slots"` | yes      |         |            | Floor pattern type. A subset of the wall patterns; kumiko patterns are not available here. |
| `scale`   | `number`                                                               | yes      |         | > 0        | Pattern cell scale.                                                                        |

<!-- generated:end -->

## Label tabs

A shelf across the compartments. Mixed units again: `depth`, `height`, `inset`
and `lipHeight` are millimetres, `width` is a percentage of the compartment
column width.

`height` is the Z position of the shelf **top** above the cavity floor, not the
tab's thickness. Absent means the wall top; lowering it creates a tuck-under
pocket between the rim and the shelf.

In `socket` mode the tab becomes a pocket for a separately printed swappable
label plate instead of carrying engraved text.

<!-- schema:LabelTabConfig -->

<!-- generated:start -->

| Field            | Type                                      | Required | Default  | Constraint    | Notes                                                                                                                                               |
| ---------------- | ----------------------------------------- | -------- | -------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enabled`        | `boolean`                                 | yes      |          |               | Enable label tabs.                                                                                                                                  |
| `mode`           | `"text"` \| `"socket"`                    |          | `"text"` |               | 'text' engraves directly on the tab. 'socket' builds a pocket for a separately printed swappable label plate.                                       |
| `plateFitOffset` | `number`                                  |          |          |               | Fit offset in mm applied to a socket's pocket. Positive is looser. Only meaningful in 'socket' mode.                                                |
| `socketStyle`    | `string`                                  |          |          |               | Which socket profile a 'socket' mode tab uses.                                                                                                      |
| `support`        | `"bracket"` \| `"solid"` \| `"fillet"`    | yes      |          |               | Support structure under the tab. 'bracket' is open gussets, 'solid' is a filled triangle, 'fillet' is a curve.                                      |
| `depth`          | `number`                                  | yes      |          | >= 8, <= 50   | Tab depth in MILLIMETRES. The UI further clamps to min(50, innerDepth - 1) so the tab cannot span past the opposite wall.                           |
| `width`          | `number`                                  | yes      |          | >= 10, <= 100 | Tab width as a PERCENTAGE of the compartment column width.                                                                                          |
| `height`         | `number`                                  |          |          | >= 9, <= 350  | Z position in mm of the shelf TOP above the cavity floor. Absent means the wall top. Lowering it creates a tuck-under pocket between rim and shelf. |
| `lip`            | `boolean`                                 |          |          |               | Add a raised rim on the tab's free edge to retain loose label cards.                                                                                |
| `lipHeight`      | `number`                                  |          |          | >= 0.4, <= 5  | Lip height in mm. Reserves that much shelf headroom.                                                                                                |
| `alignment`      | `"left"` \| `"center"` \| `"right"`       | yes      |          |               | Horizontal alignment of the tab within its span.                                                                                                    |
| `edges`          | `"back"` \| `"front"` \| `"both"`         | yes      |          |               | Which wall the tabs anchor to.                                                                                                                      |
| `inset`          | `number`                                  | yes      |          | >= 0, <= 100  | Inward offset in mm from the anchor wall. The UI clamps further per compartment depth so two tabs in 'both' mode cannot collide.                    |
| `textStyle`      | [`TextStyleOverride`](#textstyleoverride) |          |          |               |                                                                                                                                                     |
| `span`           | `string`                                  |          |          |               | How far a tab spans across compartments.                                                                                                            |
| `rowTexts`       | `string` \| `null`[]                      |          |          |               | Per-row label text.                                                                                                                                 |

<!-- generated:end -->

## Handles

<!-- schema:HandleConfig -->

<!-- generated:start -->

| Field              | Type                                   | Required | Default | Constraint     | Notes                                                       |
| ------------------ | -------------------------------------- | -------- | ------- | -------------- | ----------------------------------------------------------- |
| `enabled`          | `boolean`                              | yes      |         |                | Enable handles.                                             |
| `shape`            | `"rectangle"` \| `"oval"` \| `"scoop"` | yes      |         |                | Handle cutout shape.                                        |
| `width`            | `number`                               | yes      |         | >= 10, <= 100  | Handle width as a PERCENTAGE of the wall span.              |
| `height`           | `number`                               | yes      |         | >= 8, <= 30    | Handle height in mm.                                        |
| `cornerRadius`     | `number`                               |          |         | >= 0, <= 10    | Handle corner radius in mm.                                 |
| `verticalPosition` | `number`                               |          |         | >= 0.2, <= 0.9 | Handle centre as a FRACTION of wall height, 0 at the floor. |
| `count`            | `integer`                              |          |         | >= 1, <= 3     | Handles per enabled wall.                                   |
| `chamfer`          | `boolean`                              |          |         |                | Chamfer the handle opening.                                 |
| `interior`         | `boolean`                              |          |         |                | Also cut handles in interior divider walls.                 |
| `front`            | [`HandleSide`](#handleside)            | yes      |         |                |                                                             |
| `back`             | [`HandleSide`](#handleside)            | yes      |         |                |                                                             |
| `left`             | [`HandleSide`](#handleside)            | yes      |         |                |                                                             |
| `right`            | [`HandleSide`](#handleside)            | yes      |         |                |                                                             |

<!-- generated:end -->

### HandleSide

<!-- schema:HandleSide -->

<!-- generated:start -->

| Field          | Type      | Required | Default | Constraint    | Notes                                        |
| -------------- | --------- | -------- | ------- | ------------- | -------------------------------------------- |
| `enabled`      | `boolean` | yes      |         |               | Enable a handle on this wall.                |
| `width`        | `number`  |          |         | >= 10, <= 100 | Width override as a percentage of wall span. |
| `height`       | `number`  |          |         | >= 8, <= 30   | Height override in mm.                       |
| `cornerRadius` | `number`  |          |         | >= 0, <= 10   | Corner radius override in mm.                |

<!-- generated:end -->

## Dividers and slots

Slots are only meaningful for the `slotted` style. The divider pieces are
printed separately and ride in them.

<!-- schema:SlotConfig -->

<!-- generated:start -->

| Field          | Type                                       | Required | Default | Constraint   | Notes                                                                 |
| -------------- | ------------------------------------------ | -------- | ------- | ------------ | --------------------------------------------------------------------- |
| `x`            | [`AxisSlotConfig`](#axisslotconfig)        | yes      |         |              |                                                                       |
| `y`            | [`AxisSlotConfig`](#axisslotconfig)        | yes      |         |              |                                                                       |
| `width`        | `number`                                   | yes      |         | >= 1.8, <= 3 | Slot width in mm.                                                     |
| `depth`        | `number`                                   | yes      |         | >= 0.5, <= 2 | Slot depth in mm.                                                     |
| `crossStyle`   | `"lap"` \| `"insert"`                      |          |         |              | How crossing dividers meet.                                           |
| `longAxis`     | `string`                                   |          |         |              | Which axis the long divider runs along.                               |
| `partialStyle` | `"full"` \| `"snappable"` \| `"lengthSet"` |          |         |              | Whether dividers span fully, snap to length, or come as a length set. |
| `layout`       | `"even"` \| `"custom"`                     |          |         |              | Even pitch or a custom grid.                                          |
| `customGrid`   | `number`[]                                 |          |         |              | Custom slot positions. Only meaningful when layout is 'custom'.       |

<!-- generated:end -->

### AxisSlotConfig

<!-- schema:AxisSlotConfig -->

<!-- generated:start -->

| Field     | Type      | Required | Default | Constraint | Notes                      |
| --------- | --------- | -------- | ------- | ---------- | -------------------------- |
| `enabled` | `boolean` | yes      |         |            | Cut slots along this axis. |
| `pitch`   | `number`  | yes      |         | > 0        | Slot pitch in mm.          |

<!-- generated:end -->

### DividerPieceConfig

<!-- schema:DividerPieceConfig -->

<!-- generated:start -->

| Field       | Type     | Required | Default | Constraint     | Notes                                         |
| ----------- | -------- | -------- | ------- | -------------- | --------------------------------------------- |
| `height`    | `number` | yes      |         | > 0            | Divider height in mm.                         |
| `thickness` | `number` | yes      |         | >= 0.8, <= 2.4 | Divider thickness in mm.                      |
| `clearance` | `number` | yes      |         | >= 0, <= 0.3   | Fit clearance in mm between divider and slot. |

<!-- generated:end -->

## Cutouts

Top-down cavity cuts, used mainly by the `solid` style. Positions are in
**millimetres** from the bin interior's left and front edges, not grid units.

Three shapes carry extra requirements: `path` needs a valid `path` array,
`polygon` needs `sides`, and `mesh` needs a `meshId` present in
`params.meshAssets`.

A `path` with consecutive duplicate vertices is the trap worth knowing: the
worker silently falls back to a bounding box, so the shape renders correctly in
the 2D editor and comes out as a plain rectangle in 3D.

<!-- schema:CutoutConfig -->

<!-- generated:start -->

| Field           | Type                 | Required | Default | Constraint | Notes                                                                       |
| --------------- | -------------------- | -------- | ------- | ---------- | --------------------------------------------------------------------------- |
| `topOffset`     | `number`             | yes      |         | >= 0       | Lowers the solid fill surface below the rim in mm. 0 is flush with the rim. |
| `fillReference` | `"rim"` \| `"floor"` |          | `"rim"` |            | Which end topOffset is held against when the bin's wall height changes.     |

<!-- generated:end -->

### Cutout

<!-- schema:Cutout -->

<!-- generated:start -->

| Field              | Type                                                                                                                                 | Required | Default           | Constraint          | Notes                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`               | `string`                                                                                                                             | yes      |                   | length >= 1         | Unique cutout id within the design.                                                                                                                                                         |
| `shape`            | `"rectangle"` \| `"circle"` \| `"path"` \| `"polygon"` \| `"slot"` \| `"mesh"` \| `"knifeSlot"`                                      | yes      |                   |                     | Cutout shape. 'path' needs a valid path array; 'mesh' needs meshId; 'polygon' needs sides.                                                                                                  |
| `x`                | `number`                                                                                                                             | yes      |                   |                     | X position in mm from the bin interior's left edge.                                                                                                                                         |
| `y`                | `number`                                                                                                                             | yes      |                   |                     | Y position in mm from the bin interior's front edge.                                                                                                                                        |
| `width`            | `number`                                                                                                                             | yes      |                   | > 0                 | Width in mm, or diameter for a circle.                                                                                                                                                      |
| `depth`            | `number`                                                                                                                             | yes      |                   | > 0                 | Depth in mm. Ignored for a circle.                                                                                                                                                          |
| `cutDepth`         | `number`                                                                                                                             | yes      |                   | > 0                 | How deep the cut goes in mm.                                                                                                                                                                |
| `rotation`         | `number`                                                                                                                             |          |                   |                     | Rotation in degrees.                                                                                                                                                                        |
| `cornerRadius`     | `number`                                                                                                                             |          |                   | >= 0                | Corner radius in mm.                                                                                                                                                                        |
| `label`            | `string`                                                                                                                             |          |                   |                     | Text engraved next to the cutout.                                                                                                                                                           |
| `groupId`          | `string`                                                                                                                             |          |                   |                     | Boolean group this cutout belongs to.                                                                                                                                                       |
| `groupOp`          | `"union"` \| `"subtract"` \| `"intersect"` \| `"exclude"`                                                                            |          | `"union"`         |                     | Boolean operation within the group.                                                                                                                                                         |
| `scoopRadiusW`     | `number`                                                                                                                             |          |                   | >= 0                | Scoop radius along width in mm.                                                                                                                                                             |
| `scoopRadiusD`     | `number`                                                                                                                             |          |                   | >= 0                | Scoop radius along depth in mm.                                                                                                                                                             |
| `scoopEdges`       | `string`[]                                                                                                                           |          |                   |                     | Which edges of the cutout are scooped.                                                                                                                                                      |
| `name`             | `string`                                                                                                                             |          |                   |                     | Display name in the cutout list.                                                                                                                                                            |
| `locked`           | `boolean`                                                                                                                            |          |                   |                     | Prevent editing in the canvas.                                                                                                                                                              |
| `hidden`           | `boolean`                                                                                                                            |          |                   |                     | Hide from the preview without deleting.                                                                                                                                                     |
| `zIndex`           | `number`                                                                                                                             |          |                   |                     | Stacking order in the 2D editor.                                                                                                                                                            |
| `path`             | [`PathPoint`](#pathpoint)[]                                                                                                          |          |                   |                     | Pen-tool path. Required for shape 'path'. Duplicate consecutive vertices make the worker fall back to a bounding box, which renders as a plain rectangle in 3D while looking correct in 2D. |
| `sides`            | `integer`                                                                                                                            |          | `6`               | >= 3, <= 12         | Polygon side count. Only meaningful for shape 'polygon'.                                                                                                                                    |
| `clearance`        | `number`                                                                                                                             |          | `0.2`             | >= 0, <= 5          | Extra clearance in mm around the cut.                                                                                                                                                       |
| `chamferWidth`     | `number`                                                                                                                             |          |                   | >= 0, <= 5          | Chamfer width in mm at the cut's mouth.                                                                                                                                                     |
| `array`            | [`CutoutArrayConfig`](#cutoutarrayconfig)                                                                                            |          |                   |                     |                                                                                                                                                                                             |
| `engraveLabel`     | `boolean`                                                                                                                            |          |                   |                     | Engrave the label text next to this cutout.                                                                                                                                                 |
| `textSide`         | `"top"` \| `"bottom"` \| `"left"` \| `"right"`                                                                                       |          |                   |                     | Which side of the cutout the label sits on.                                                                                                                                                 |
| `textAnchor`       | `"top-left"` \| `"top"` \| `"top-right"` \| `"left"` \| `"center"` \| `"right"` \| `"bottom-left"` \| `"bottom"` \| `"bottom-right"` |          |                   |                     | Nine-point anchor for the label.                                                                                                                                                            |
| `textOffset`       | [`TextOffset`](#textoffset)                                                                                                          |          |                   |                     |                                                                                                                                                                                             |
| `textAngle`        | `number`                                                                                                                             |          |                   |                     | Label rotation in degrees.                                                                                                                                                                  |
| `textStyle`        | [`TextStyleOverride`](#textstyleoverride)                                                                                            |          |                   |                     |                                                                                                                                                                                             |
| `color`            | `string`                                                                                                                             |          |                   | `^#[0-9a-fA-F]{6}$` | Cutout colour for multi-colour export.                                                                                                                                                      |
| `colorScope`       | `"floor"` \| `"floorAndWalls"`                                                                                                       |          | `"floorAndWalls"` |                     | Whether the colour covers just the cut floor or its walls too.                                                                                                                              |
| `labelMode`        | `"text"` \| `"socket"`                                                                                                               |          |                   |                     | 'socket' builds a pocket for a swappable label plate instead of engraving.                                                                                                                  |
| `labelPlateWidthU` | `number`                                                                                                                             |          |                   | > 0                 | Label plate width in grid units for socket mode.                                                                                                                                            |
| `labelIcon`        | `string`                                                                                                                             |          |                   |                     | Icon id engraved with the label.                                                                                                                                                            |
| `meshId`           | `string`                                                                                                                             |          |                   |                     | Key into BinParams.meshAssets. Required for shape 'mesh'.                                                                                                                                   |
| `knife`            | [`KnifeSpec`](#knifespec)                                                                                                            |          |                   |                     |                                                                                                                                                                                             |

<!-- generated:end -->

### CutoutArrayConfig

<!-- schema:CutoutArrayConfig -->

<!-- generated:start -->

| Field            | Type                                    | Required | Default | Constraint  | Notes                                         |
| ---------------- | --------------------------------------- | -------- | ------- | ----------- | --------------------------------------------- |
| `mode`           | `"grid"` \| `"staggered"` \| `"radial"` | yes      |         |             | Array layout.                                 |
| `cols`           | `integer`                               |          |         | >= 1, <= 50 | Columns. Grid and staggered modes only.       |
| `rows`           | `integer`                               |          |         | >= 1, <= 50 | Rows. Grid and staggered modes only.          |
| `pitchX`         | `number`                                |          |         |             | Column pitch in mm.                           |
| `pitchY`         | `number`                                |          |         |             | Row pitch in mm.                              |
| `count`          | `integer`                               |          |         | >= 1, <= 50 | Instance count for radial mode.               |
| `radius`         | `number`                                |          |         | > 0         | Ring radius in mm for radial mode.            |
| `startAngle`     | `number`                                |          |         |             | Starting angle in degrees for radial mode.    |
| `rotateToCenter` | `boolean`                               |          |         |             | Rotate each instance to face the ring centre. |

<!-- generated:end -->

### PathPoint

<!-- schema:PathPoint -->

<!-- generated:start -->

| Field       | Type                                      | Required | Default | Constraint | Notes                                                                                    |
| ----------- | ----------------------------------------- | -------- | ------- | ---------- | ---------------------------------------------------------------------------------------- |
| `x`         | `number`                                  | yes      |         |            | X in mm from the bin interior's left edge.                                               |
| `y`         | `number`                                  | yes      |         |            | Y in mm from the bin interior's front edge.                                              |
| `handleIn`  | [`BezierHandle`](#bezierhandle) \| `null` |          |         |            | Incoming bezier control handle as a relative offset. null makes the point a hard corner. |
| `handleOut` | [`BezierHandle`](#bezierhandle) \| `null` |          |         |            | Outgoing bezier control handle as a relative offset. null makes the point a hard corner. |
| `symmetric` | `boolean`                                 |          |         |            | Keep handleIn and handleOut mirrored.                                                    |

<!-- generated:end -->

### BezierHandle

<!-- schema:BezierHandle -->

<!-- generated:start -->

| Field | Type     | Required | Default | Constraint | Notes           |
| ----- | -------- | -------- | ------- | ---------- | --------------- |
| `dx`  | `number` | yes      |         |            | X offset in mm. |
| `dy`  | `number` | yes      |         |            | Y offset in mm. |

<!-- generated:end -->

### KnifeSpec

Blade dimensions driving a `knifeSlot` cutout.

<!-- schema:KnifeSpec -->

<!-- generated:start -->

| Field              | Type                 | Required | Default | Constraint | Notes                                 |
| ------------------ | -------------------- | -------- | ------- | ---------- | ------------------------------------- |
| `presetId`         | `string`             |          |         |            | Preset knife id, when one was chosen. |
| `bladeLengthMm`    | `number`             |          |         | > 0        | Blade length in mm.                   |
| `heelHeightMm`     | `number`             |          |         | > 0        | Blade heel height in mm.              |
| `spineThicknessMm` | `number`             |          |         | > 0        | Spine thickness in mm.                |
| `handleDiameterMm` | `number`             |          |         | > 0        | Handle diameter in mm.                |
| `openEnd`          | `"start"` \| `"end"` |          |         |            | Which end of the slot is open.        |

<!-- generated:end -->

## Inserts

Cavities cut into the bin floor. Positions are in millimetres from the interior
left and front edges, like cutouts.

<!-- schema:Insert -->

<!-- generated:start -->

| Field          | Type                                                                       | Required | Default | Constraint  | Notes                                                   |
| -------------- | -------------------------------------------------------------------------- | -------- | ------- | ----------- | ------------------------------------------------------- |
| `id`           | `string`                                                                   | yes      |         | length >= 1 | Unique insert id.                                       |
| `templateId`   | `string` \| `null`                                                         |          |         |             | Template this insert came from, or null if hand-placed. |
| `shape`        | `"rectangle"` \| `"circle"` \| `"hexagon"` \| `"rounded-rect"` \| `"slot"` | yes      |         |             | Cavity shape.                                           |
| `x`            | `number`                                                                   | yes      |         |             | X in mm from the bin interior's left edge.              |
| `y`            | `number`                                                                   | yes      |         |             | Y in mm from the bin interior's front edge.             |
| `width`        | `number`                                                                   | yes      |         | > 0         | Width in mm, or diameter for circle and hexagon.        |
| `depth`        | `number`                                                                   | yes      |         | > 0         | Depth in mm. Ignored for circle and hexagon.            |
| `cutDepth`     | `number`                                                                   | yes      |         | > 0         | How deep the cavity goes in mm.                         |
| `rotation`     | `0` \| `90` \| `180` \| `270`                                              |          |         |             | Rotation in degrees. Only right angles.                 |
| `cornerRadius` | `number`                                                                   |          |         | >= 0        | Corner radius in mm for 'rounded-rect'.                 |
| `label`        | `string`                                                                   |          |         |             | Optional label for the insert.                          |

<!-- generated:end -->

## Non-rectangular bins

`cellMask` gives a bin a custom footprint. It is stored at **half-bin
resolution unconditionally**, so a `width` x `depth` bin has a
`(2 * width)` x `(2 * depth)` mask, and `cells.length` must equal `cols * rows`.

A mask with every cell filled is treated as a rectangle and takes the faster
path. A **partial** mask disables the features that cannot yet operate on a
non-rectangular footprint: compartments, cutouts, walls, handles, inserts,
scoops and label tabs are skipped rather than approximated.

<!-- schema:CellMask -->

<!-- generated:start -->

| Field   | Type         | Required | Default | Constraint | Notes                                                       |
| ------- | ------------ | -------- | ------- | ---------- | ----------------------------------------------------------- |
| `cols`  | `integer`    | yes      |         | >= 1       | Mask columns. Equals 2 * BinParams.width.                   |
| `rows`  | `integer`    | yes      |         | >= 1       | Mask rows. Equals 2 * BinParams.depth.                      |
| `cells` | `0` \| `1`[] | yes      |         |            | Row-major occupancy, 0 or 1. Length MUST equal cols * rows. |

<!-- generated:end -->

## Overhang

Per-side outward expansion in mm, letting a bin fill a gap an integral grid
cannot express: the centring slack a drawer leaves, or the remainder when a span
is divided into pieces that are not whole grid units.

Expansion is outward only. The base sockets stay at the nominal footprint, so
the overhang region has a flat bottom unless `feet` is set. Ignored for
`cellMask` bins.

<!-- schema:OverhangConfig -->

<!-- generated:start -->

| Field     | Type                                  | Required | Default | Constraint  | Notes                                                                                                           |
| --------- | ------------------------------------- | -------- | ------- | ----------- | --------------------------------------------------------------------------------------------------------------- |
| `enabled` | `boolean`                             |          |         |             | Absent means enabled is inferred from any non-zero side.                                                        |
| `left`    | `number`                              | yes      |         | >= 0, <= 21 | Outward expansion on -X in mm.                                                                                  |
| `right`   | `number`                              | yes      |         | >= 0, <= 21 | Outward expansion on +X in mm.                                                                                  |
| `front`   | `number`                              | yes      |         | >= 0, <= 21 | Outward expansion on -Y in mm.                                                                                  |
| `back`    | `number`                              | yes      |         | >= 0, <= 21 | Outward expansion on +Y in mm.                                                                                  |
| `feet`    | `boolean`                             |          | `false` |             | Add grid-aligned feet under the overhang region. False leaves a flat bottom with feet at the nominal footprint. |
| `taper`   | [`WallTaperConfig`](#walltaperconfig) |          |         |             |                                                                                                                 |

<!-- generated:end -->

### WallTaperConfig

Stored rim-anchored: the wall is full width at the rim and angles inward over
`bandHeight`, so the base never drops below the nominal footprint.

<!-- schema:WallTaperConfig -->

<!-- generated:start -->

| Field        | Type                      | Required | Default | Constraint   | Notes                                                                                  |
| ------------ | ------------------------- | -------- | ------- | ------------ | -------------------------------------------------------------------------------------- |
| `enabled`    | `boolean`                 |          |         |              | Absent means enabled is inferred from any non-zero side.                               |
| `profile`    | `"chamfer"` \| `"fillet"` | yes      |         |              | Cross-section shape.                                                                   |
| `bandHeight` | `number`                  | yes      |         | >= 0, <= 350 | How far up the wall the taper rises in mm, clamped to wall height at build.            |
| `left`       | `number`                  | yes      |         | >= 0, <= 42  | Magnitude on -X in mm. Chamfer: base inset. Fillet: radius. 0 keeps the side vertical. |
| `right`      | `number`                  | yes      |         | >= 0, <= 42  | Magnitude on +X in mm.                                                                 |
| `front`      | `number`                  | yes      |         | >= 0, <= 42  | Magnitude on -Y in mm.                                                                 |
| `back`       | `number`                  | yes      |         | >= 0, <= 42  | Magnitude on +Y in mm.                                                                 |

<!-- generated:end -->

## Split connectors

Connectors joining the pieces of a bin too large for the print bed.

<!-- schema:SplitConnectorConfig -->

<!-- generated:start -->

| Field                 | Type                | Required | Default | Constraint | Notes                                           |
| --------------------- | ------------------- | -------- | ------- | ---------- | ----------------------------------------------- |
| `enabled`             | `boolean`           | yes      |         |            | Enable split connectors.                        |
| `clearance`           | `number`            |          |         | >= 0       | Fit clearance in mm.                            |
| `tongueProtrusion`    | `number`            |          |         | >= 0       | How far the tongue protrudes in mm.             |
| `tongueThickness`     | `number`            |          |         | > 0        | Tongue thickness in mm.                         |
| `wallConnector`       | `"none"` \| `"key"` |          |         |            | Whether the wall seam also gets a separate key. |
| `ridgeWidthFraction`  | `number`            |          |         | >= 0, <= 1 | Ridge width as a fraction of the tongue.        |
| `ridgeHeightFraction` | `number`            |          |         | >= 0, <= 1 | Ridge height as a fraction of the tongue.       |
| `nozzleSizeMm`        | `number`            |          |         | > 0        | Nozzle size the connector clearances scale to.  |

<!-- generated:end -->

## Sliding tray

<!-- schema:SlideConfig -->

<!-- generated:start -->

| Field              | Type                    | Required | Default      | Constraint | Notes                                      |
| ------------------ | ----------------------- | -------- | ------------ | ---------- | ------------------------------------------ |
| `enabled`          | `boolean`               | yes      |              |            | Enable the sliding tray.                   |
| `railMount`        | `"interior"` \| `"rim"` |          | `"interior"` |            | Where the rail mounts.                     |
| `trayWidthUnits`   | `number`                |          |              | > 0        | Tray width in grid units.                  |
| `trayDepthMm`      | `number`                |          |              | > 0        | Tray depth in mm.                          |
| `trayWallMm`       | `number`                |          |              | > 0        | Tray wall thickness in mm.                 |
| `railDropMm`       | `number`                |          |              | >= 0       | How far the rail sits below the rim in mm. |
| `railProtrusionMm` | `number`                |          |              | >= 0       | How far the rail protrudes inward in mm.   |
| `railThicknessMm`  | `number`                |          |              | > 0        | Rail thickness in mm.                      |
| `clearanceMm`      | `number`                |          |              | >= 0       | Fit clearance in mm between rail and tray. |

<!-- generated:end -->

## Text

`textDefaults` sets design-level defaults for engraved geometry. Individual
label tabs and cutouts attach a `TextStyleOverride`, which is sparse: an omitted
field is not reset, it inherits.

`surfaceText` puts text on exterior surfaces. Lid text is deliberately
monochrome; wall text activates the text colour zone.

<!-- schema:TextStyleDefaults -->

<!-- generated:start -->

| Field                | Type                                                                                                                                             | Required | Default | Constraint | Notes                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------- | ---------- | --------------------------------------------------------------------- |
| `font`               | `"atkinson"` \| `"atkinson-bold"` \| `"jetbrains-mono"` \| `"jetbrains-mono-bold"` \| `"barlow-condensed"` \| `"poppins"` \| `"allerta-stencil"` | yes      |         |            | Font family.                                                          |
| `mode`               | `"engrave"` \| `"emboss"` \| `"through-cut"`                                                                                                     | yes      |         |            | How the glyphs meet the surface.                                      |
| `depth`              | `number`                                                                                                                                         | yes      |         | > 0        | Engrave or emboss depth in mm.                                        |
| `margin`             | `number`                                                                                                                                         |          |         | >= 0       | Margin in mm around the text block.                                   |
| `minFontSize`        | `number`                                                                                                                                         |          |         | > 0        | Lower bound in mm for auto-sized text.                                |
| `maxFontSize`        | `number`                                                                                                                                         |          |         | > 0        | Upper bound in mm for auto-sized text.                                |
| `anchor`             | `"top-left"` \| `"top"` \| `"top-right"` \| `"left"` \| `"center"` \| `"right"` \| `"bottom-left"` \| `"bottom"` \| `"bottom-right"`             |          |         |            | Nine-point anchor within the available area.                          |
| `offset`             | [`TextOffset`](#textoffset)                                                                                                                      |          |         |            |                                                                       |
| `sizeMode`           | `"auto"` \| `"fixed"`                                                                                                                            |          |         |            | 'auto' fits the text to the area; 'fixed' uses fixedSize.             |
| `fixedSize`          | `number`                                                                                                                                         |          |         | > 0        | Font size in mm when sizeMode is 'fixed'.                             |
| `snapToScale`        | `boolean`                                                                                                                                        |          |         |            | Snap the computed size to the shared type scale.                      |
| `uniformAcrossWalls` | `boolean`                                                                                                                                        |          |         |            | Use one size for every wall rather than fitting each separately.      |
| `tracking`           | `number`                                                                                                                                         |          |         |            | Letter spacing adjustment.                                            |
| `autoTracking`       | `boolean`                                                                                                                                        |          |         |            | Let the layout choose tracking.                                       |
| `textCase`           | `"as-typed"` \| `"upper"` \| `"title"`                                                                                                           |          |         |            | Case transform applied before layout.                                 |
| `lineScale`          | `number`                                                                                                                                         |          |         | > 0        | Line height multiplier.                                               |
| `lineGap`            | `number`                                                                                                                                         |          |         |            | Extra gap between lines in mm.                                        |
| `cutProfile`         | `"straight"` \| `"drafted"`                                                                                                                      |          |         |            | 'drafted' angles the glyph walls so an engraved cut releases cleanly. |
| `draftAngleDeg`      | `number`                                                                                                                                         |          |         | >= 3       | Draft angle in degrees. Only meaningful when cutProfile is 'drafted'. |

<!-- generated:end -->

### TextStyleOverride

<!-- schema:TextStyleOverride -->

<!-- generated:start -->

| Field                | Type                                                                                                                                             | Required | Default | Constraint | Notes                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------- | ---------- | ------------------------------------------------------------------- |
| `font`               | `"atkinson"` \| `"atkinson-bold"` \| `"jetbrains-mono"` \| `"jetbrains-mono-bold"` \| `"barlow-condensed"` \| `"poppins"` \| `"allerta-stencil"` |          |         |            | Font family override.                                               |
| `mode`               | `"engrave"` \| `"emboss"` \| `"through-cut"`                                                                                                     |          |         |            | Mode override.                                                      |
| `depth`              | `number`                                                                                                                                         |          |         | > 0        | Depth override in mm.                                               |
| `margin`             | `number`                                                                                                                                         |          |         | >= 0       | Margin override in mm.                                              |
| `minFontSize`        | `number`                                                                                                                                         |          |         | > 0        | Minimum size override in mm.                                        |
| `maxFontSize`        | `number`                                                                                                                                         |          |         | > 0        | Maximum size override in mm.                                        |
| `anchor`             | `"top-left"` \| `"top"` \| `"top-right"` \| `"left"` \| `"center"` \| `"right"` \| `"bottom-left"` \| `"bottom"` \| `"bottom-right"`             |          |         |            | Anchor override.                                                    |
| `offset`             | [`TextOffset`](#textoffset)                                                                                                                      |          |         |            |                                                                     |
| `sizeMode`           | `"auto"` \| `"fixed"`                                                                                                                            |          |         |            | Size mode override.                                                 |
| `fixedSize`          | `number`                                                                                                                                         |          |         | > 0        | Fixed size override in mm.                                          |
| `snapToScale`        | `boolean`                                                                                                                                        |          |         |            | Snap-to-scale override.                                             |
| `uniformAcrossWalls` | `boolean`                                                                                                                                        |          |         |            | Uniform-across-walls override.                                      |
| `tracking`           | `number`                                                                                                                                         |          |         |            | Tracking override.                                                  |
| `autoTracking`       | `boolean`                                                                                                                                        |          |         |            | Auto-tracking override.                                             |
| `textCase`           | `"as-typed"` \| `"upper"` \| `"title"`                                                                                                           |          |         |            | Case override.                                                      |
| `lineScale`          | `number`                                                                                                                                         |          |         | > 0        | Line height override.                                               |
| `lineGap`            | `number`                                                                                                                                         |          |         |            | Line gap override in mm.                                            |
| `cutProfile`         | `"straight"` \| `"drafted"`                                                                                                                      |          |         |            | Cut profile override.                                               |
| `draftAngleDeg`      | `number`                                                                                                                                         |          |         | >= 3       | Draft angle override in degrees.                                    |
| `fontSizeOverride`   | `number`                                                                                                                                         |          |         | > 0        | Hard font size in mm for this instance only, bypassing auto sizing. |

<!-- generated:end -->

### TextOffset

<!-- schema:TextOffset -->

<!-- generated:start -->

| Field | Type     | Required | Default | Constraint | Notes                   |
| ----- | -------- | -------- | ------- | ---------- | ----------------------- |
| `x`   | `number` | yes      |         |            | Horizontal nudge in mm. |
| `y`   | `number` | yes      |         |            | Vertical nudge in mm.   |

<!-- generated:end -->

### SurfaceTextConfig

<!-- schema:SurfaceTextConfig -->

<!-- generated:start -->

| Field        | Type                                                | Required | Default | Constraint | Notes                                                              |
| ------------ | --------------------------------------------------- | -------- | ------- | ---------- | ------------------------------------------------------------------ |
| `lidText`    | `string`                                            |          |         |            | Text engraved or embossed on the lid top. Deliberately monochrome. |
| `walls`      | object of `string`                                  |          |         |            | Per-wall text keyed by side: front, back, left, right.             |
| `wallAlign`  | object of `"top"` \| `"center"` \| `"bottom"`       |          |         |            | Per-wall vertical alignment keyed by side.                         |
| `style`      | [`TextStyleOverride`](#textstyleoverride)           |          |         |            |                                                                    |
| `lidStyle`   | [`TextStyleOverride`](#textstyleoverride)           |          |         |            |                                                                    |
| `wallStyles` | object of [`TextStyleOverride`](#textstyleoverride) |          |         |            | Per-wall style overrides keyed by side.                            |

<!-- generated:end -->

## Colours

Per-feature filament assignment for multi-colour 3MF export. A zone left unset
inherits the body colour.

<!-- schema:FeatureColorConfig -->

<!-- generated:start -->

| Field          | Type                                    | Required | Default | Constraint          | Notes                       |
| -------------- | --------------------------------------- | -------- | ------- | ------------------- | --------------------------- |
| `enabled`      | `boolean`                               | yes      |         |                     | Enable per-feature colours. |
| `body`         | `string`                                |          |         | `^#[0-9a-fA-F]{6}$` | Body colour.                |
| `lip`          | `string`                                |          |         | `^#[0-9a-fA-F]{6}$` | Stacking lip colour.        |
| `labelTab`     | `string`                                |          |         | `^#[0-9a-fA-F]{6}$` | Label tab colour.           |
| `base`         | `string`                                |          |         | `^#[0-9a-fA-F]{6}$` | Base colour.                |
| `scoop`        | `string`                                |          |         | `^#[0-9a-fA-F]{6}$` | Scoop colour.               |
| `dividers`     | `string`                                |          |         | `^#[0-9a-fA-F]{6}$` | Divider colour.             |
| `text`         | `string`                                |          |         | `^#[0-9a-fA-F]{6}$` | Engraved text colour.       |
| `lid`          | `string`                                |          |         | `^#[0-9a-fA-F]{6}$` | Lid colour.                 |
| `lidLip`       | `string`                                |          |         | `^#[0-9a-fA-F]{6}$` | Lid lip colour.             |
| `topAccent`    | [`AccentBandConfig`](#accentbandconfig) |          |         |                     |                             |
| `bottomAccent` | [`AccentBandConfig`](#accentbandconfig) |          |         |                     |                             |

<!-- generated:end -->

### AccentBandConfig

<!-- schema:AccentBandConfig -->

<!-- generated:start -->

| Field      | Type      | Required | Default | Constraint          | Notes                   |
| ---------- | --------- | -------- | ------- | ------------------- | ----------------------- |
| `enabled`  | `boolean` | yes      |         |                     | Enable the accent band. |
| `color`    | `string`  |          |         | `^#[0-9a-fA-F]{6}$` | Band colour.            |
| `heightMm` | `number`  |          | `2`     | >= 0                | Band height in mm.      |

<!-- generated:end -->

## Lid

Generated as a separate companion solid. The lid has the largest surface area of
any config here; the tables below are complete, and the authoritative
definitions live in `src/features/bin-designer/types/lid.ts`.

<!-- schema:LidConfig -->

<!-- generated:start -->

| Field                | Type                                                                     | Required | Default | Constraint    | Notes                                                                  |
| -------------------- | ------------------------------------------------------------------------ | -------- | ------- | ------------- | ---------------------------------------------------------------------- |
| `enabled`            | `boolean`                                                                | yes      |         |               | Generate a lid alongside the bin.                                      |
| `attachment`         | `"friction"` \| `"clickRails"` \| `"magnetic"` \| `"slide"` \| `"hinge"` |          |         |               | How the lid attaches.                                                  |
| `stackableTop`       | `boolean`                                                                |          |         |               | Give the lid a socket-patterned top so another bin can stack on it.    |
| `stackLipOnly`       | `boolean`                                                                |          |         |               | Emit only the stacking lip band rather than a full stackable top.      |
| `magnetHoles`        | `boolean`                                                                |          |         |               | Cut magnet holes in the lid.                                           |
| `separateStackPlate` | `boolean`                                                                |          |         |               | Emit the stackable top as its own printable plate.                     |
| `clickRails`         | [`SideFlags`](#sideflags)                                                |          |         |               |                                                                        |
| `clickRailCoverage`  | `number`                                                                 |          |         | >= 50, <= 100 | Percentage of each side carrying the click rail.                       |
| `extraHeightMm`      | `number`                                                                 |          |         | >= 0, <= 100  | Extra lid height in mm. The lid mirror of BinParams.extraWallHeightMm. |
| `topThicknessMm`     | `number`                                                                 |          |         | >= 0.8, <= 5  | Lid top slab thickness in mm.                                          |
| `retentionMagnet`    | [`LidMagnetConfig`](#lidmagnetconfig)                                    |          |         |               |                                                                        |
| `tray`               | [`LidTrayConfig`](#lidtrayconfig)                                        |          |         |               |                                                                        |
| `grip`               | [`LidGripConfig`](#lidgripconfig)                                        |          |         |               |                                                                        |
| `relieveInterior`    | `boolean`                                                                |          |         |               | Hollow the lid interior to save filament.                              |
| `slide`              | [`LidSlideConfig`](#lidslideconfig)                                      |          |         |               |                                                                        |
| `hinge`              | [`LidHingeConfig`](#lidhingeconfig)                                      |          |         |               |                                                                        |
| `cutouts`            | [`Cutout`](#cutout)[]                                                    |          |         | items <= 24   | Cutouts taken out of the lid, using the same Cutout shape as the bin.  |

<!-- generated:end -->

### LidMagnetConfig

<!-- schema:LidMagnetConfig -->

<!-- generated:start -->

| Field         | Type      | Required | Default | Constraint  | Notes                                               |
| ------------- | --------- | -------- | ------- | ----------- | --------------------------------------------------- |
| `diameter`    | `number`  | yes      |         | >= 4, <= 10 | Magnet diameter in mm.                              |
| `depth`       | `number`  | yes      |         | >= 1, <= 4  | Magnet pocket depth in mm.                          |
| `edgeMagnets` | `boolean` |          |         |             | Place magnets at the edges rather than the corners. |

<!-- generated:end -->

### LidTrayConfig

<!-- schema:LidTrayConfig -->

<!-- generated:start -->

| Field     | Type      | Required | Default | Constraint | Notes                      |
| --------- | --------- | -------- | ------- | ---------- | -------------------------- |
| `enabled` | `boolean` | yes      |         |            | Enable the lid tray.       |
| `depthMm` | `number`  |          |         | >= 0       | Tray depth in mm.          |
| `wallMm`  | `number`  |          |         | > 0        | Tray wall thickness in mm. |

<!-- generated:end -->

### LidGripConfig

<!-- schema:LidGripConfig -->

<!-- generated:start -->

| Field      | Type                                                 | Required | Default | Constraint   | Notes                                   |
| ---------- | ---------------------------------------------------- | -------- | ------- | ------------ | --------------------------------------- |
| `mode`     | `"none"` \| `"chamfer"` \| `"reveal"` \| `"scallop"` | yes      |         |              | Grip style.                             |
| `sides`    | [`SideFlags`](#sideflags)                            |          |         |              |                                         |
| `coverage` | `number`                                             |          |         | >= 0, <= 100 | Percentage of each side the grip spans. |
| `heightMm` | `number`                                             |          |         | >= 0         | Grip height in mm.                      |
| `binDip`   | `boolean`                                            |          |         |              | Dip the bin rim to meet the grip.       |

<!-- generated:end -->

### LidHingeConfig

<!-- schema:LidHingeConfig -->

<!-- generated:start -->

| Field            | Type                                           | Required | Default | Constraint | Notes                       |
| ---------------- | ---------------------------------------------- | -------- | ------- | ---------- | --------------------------- |
| `side`           | `"front"` \| `"back"` \| `"left"` \| `"right"` | yes      |         |            | Which side the hinge is on. |
| `catchMode`      | `"none"` \| `"detent"` \| `"magnets"`          |          |         |            | How the lid is held closed. |
| `fitClearanceMm` | `number`                                       |          |         | >= 0       | Hinge fit clearance in mm.  |

<!-- generated:end -->

### LidSlideConfig

<!-- schema:LidSlideConfig -->

<!-- generated:start -->

| Field         | Type                                           | Required | Default | Constraint | Notes                                                         |
| ------------- | ---------------------------------------------- | -------- | ------- | ---------- | ------------------------------------------------------------- |
| `placement`   | `"recessed"` \| `"flush"`                      | yes      |         |            | Whether the lid sits flush with the rim or recessed below it. |
| `entrySide`   | `"front"` \| `"back"` \| `"left"` \| `"right"` |          |         |            | Which side the lid slides in from.                            |
| `clearanceMm` | `number`                                       |          |         | >= 0       | Fit clearance in mm.                                          |
| `pull`        | `"none"` \| `"notch"` \| `"tab"`               |          |         |            | Pull feature so the lid can be gripped.                       |
| `detent`      | `boolean`                                      |          |         |            | Add a detent that holds the lid closed.                       |

<!-- generated:end -->

## Knife rest

A saddle-topped companion solid, or an integrated rear section, carrying knife
handles at the height the `knifeSlot` cutouts imply. A `companion` rest is
placed in a layout as a **paired bin**: two bins sharing one `pairId`, which
move, stash and delete together.

<!-- schema:KnifeRestConfig -->

<!-- generated:start -->

| Field           | Type                            | Required | Default | Constraint          | Notes                                                                                         |
| --------------- | ------------------------------- | -------- | ------- | ------------------- | --------------------------------------------------------------------------------------------- |
| `enabled`       | `boolean`                       | yes      |         |                     | Generate a handle rest.                                                                       |
| `style`         | `"companion"` \| `"integrated"` |          |         |                     | 'companion' is a separate part placed as a paired bin; 'integrated' builds it into the block. |
| `gapMm`         | `number`                        |          | `21`    | >= 0, <= 200        | Gap in mm between block and rest.                                                             |
| `depthU`        | `number`                        |          |         | >= 0.5, <= 4        | Rest depth in grid units.                                                                     |
| `grooveDepthMm` | `number`                        |          |         | >= 0, <= 15         | Saddle groove depth in mm.                                                                    |
| `color`         | `string`                        |          |         | `^#[0-9a-fA-F]{6}$` | Rest colour.                                                                                  |

<!-- generated:end -->

## Imported meshes

<!-- schema:MeshAsset -->

<!-- generated:start -->

| Field           | Type                                        | Required | Default | Constraint | Notes                                                                                                                     |
| --------------- | ------------------------------------------- | -------- | ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `name`          | `string`                                    | yes      |         |            | Original file name, sanitized with the extension stripped.                                                                |
| `data`          | `string`                                    | yes      |         |            | base64(deflate(quantized mesh)). Opaque.                                                                                  |
| `triangleCount` | `integer`                                   | yes      |         | >= 0       | Triangle count of the decoded mesh.                                                                                       |
| `sizeMm`        | `object`                                    | yes      |         |            | Oriented lay-flat bounding box size in mm.                                                                                |
| `outlines`      | [`MeshOutlinePoint`](#meshoutlinepoint)[][] | yes      |         |            | Top-down silhouette outer rings with holes dropped, simplified. Powers the 2D footprint render without decoding the mesh. |

<!-- generated:end -->

### MeshOutlinePoint

<!-- schema:MeshOutlinePoint -->

<!-- generated:start -->

| Field | Type     | Required | Default | Constraint | Notes    |
| ----- | -------- | -------- | ------- | ---------- | -------- |
| `x`   | `number` | yes      |         |            | X in mm. |
| `y`   | `number` | yes      |         |            | Y in mm. |

<!-- generated:end -->

### ExportMeta

<!-- schema:ExportMeta -->

<!-- generated:start -->

| Field          | Type     | Required | Default | Constraint | Notes                            |
| -------------- | -------- | -------- | ------- | ---------- | -------------------------------- |
| `exportedFrom` | `string` |          |         |            | Origin URL of the exporting app. |
| `exportedAt`   | `string` |          |         |            | ISO 8601 export timestamp.       |

<!-- generated:end -->

## Recipes

### The smallest design that imports

```json
{
  "$schema": "https://gridfinitylayouttool.com/schema/bin-design.schema.json",
  "type": "gridfinity-bin-design",
  "version": "1.0",
  "name": "Minimal bin",
  "params": {
    "width": 2,
    "depth": 2,
    "height": 3,
    "gridUnitMm": 42,
    "heightUnitMm": 7,
    "wallThickness": 1.2,
    "style": "standard",
    "base": { "style": "standard", "stackingLip": true },
    "compartments": { "cols": 1, "rows": 1, "thickness": 1.2, "cells": [0] }
  }
}
```

### A 3x2 compartment grid

`cells` is row-major and must have exactly `cols * rows` entries. Give each cell
its own id for six separate compartments:

```json
"compartments": { "cols": 3, "rows": 2, "thickness": 1.2, "cells": [0, 1, 2, 3, 4, 5] }
```

Repeat an id to merge cells. Here the left column is one tall compartment:

```json
"compartments": { "cols": 3, "rows": 2, "thickness": 1.2, "cells": [0, 1, 2, 0, 3, 4] }
```

### Magnet base

Magnets are turned on by the base `style`, not a separate flag:

```json
"base": { "style": "magnet", "magnetDiameter": 6, "magnetDepth": 2, "stackingLip": true }
```

### Label tabs on the back wall

```json
"label": {
  "enabled": true,
  "mode": "text",
  "support": "bracket",
  "depth": 12,
  "width": 100,
  "alignment": "center",
  "edges": "back",
  "inset": 0
}
```

`depth` is millimetres, `width` is a percentage.

### A ring of holes

An array repeats one cutout. Radial mode places `count` instances on a circle:

```json
{
  "id": "cut-ring",
  "shape": "circle",
  "x": 42,
  "y": 42,
  "width": 6,
  "depth": 6,
  "cutDepth": 10,
  "array": { "mode": "radial", "count": 8, "radius": 20, "startAngle": 0, "rotateToCenter": false }
}
```

Total instances across all arrays are capped at 400.

### An L-shaped bin

The mask is at half-bin resolution, so a 2x2 bin needs a 4x4 mask. This clears
the top-right quadrant:

```json
"cellMask": {
  "cols": 4,
  "rows": 4,
  "cells": [1, 1, 1, 1,
            1, 1, 1, 1,
            1, 1, 0, 0,
            1, 1, 0, 0]
}
```

Remember that a partial mask skips compartments, cutouts, walls, handles,
inserts, scoops and label tabs.
