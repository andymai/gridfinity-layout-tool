# Layout JSON reference

The document produced by **Export Layout**: one drawer, its grid, its layers,
its bins, and optionally the bin designs those bins point at.

- Schema: `https://gridfinitylayouttool.com/schema/layout.schema.json`
- Examples: [layout-minimal.json](examples/layout-minimal.json), [layout-full.json](examples/layout-full.json)
- Validate: `pnpm run validate:json path/to/file.json`

Read [README.md](README.md) first. The traps there apply to this format and
produce files that are valid and wrong.

Every field the schema defines is listed below.

## Document root

The layout object spread flat, plus an export envelope. `_meta` is a provenance
stamp deleted on import; `linkedDesigns` is written only by "export with
designs".

<!-- schema:root:layout.schema.json -->

<!-- generated:start -->

| Field               | Type                                  | Required | Default  | Constraint                | Notes                                                                                                                                                                                                                                          |
| ------------------- | ------------------------------------- | -------- | -------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `$schema`           | `string`                              |          |          |                           | Optional pointer to this schema. Ignored by the importer; present only so editors offer completion.                                                                                                                                            |
| `version`           | `"1.0"`                               | yes      |          |                           | Document format version. Always "1.0". The importer never branches on it; backward compatibility is handled by field-level defaulting instead.                                                                                                 |
| `name`              | `string`                              | yes      |          | length >= 1, length <= 64 | Layout name shown in the library.                                                                                                                                                                                                              |
| `drawer`            | [`Drawer`](#drawer)                   | yes      |          |                           |                                                                                                                                                                                                                                                |
| `printBedSize`      | `number`                              |          | `256`    | >= 42, <= 3000            | Print bed width in mm. Used to decide when a baseplate must be split.                                                                                                                                                                          |
| `printBedDepth`     | `number`                              |          |          | >= 42, <= 3000            | Print bed depth in mm. Absent means the bed is square and equals printBedSize.                                                                                                                                                                 |
| `gridUnitMm`        | `number`                              | yes      | `42`     | >= 20, <= 60              | Millimetres per grid unit along X. Standard Gridfinity is 42.                                                                                                                                                                                  |
| `gridUnitMmY`       | `number`                              |          |          | >= 20, <= 60              | Millimetres per grid unit along Y, for a non-square grid. Omit for a square grid: omitting keeps square layouts byte-identical, and consumers resolve it as gridUnitMmY ?? gridUnitMm.                                                         |
| `heightUnitMm`      | `number`                              | yes      | `7`      | >= 3, <= 20               | Millimetres per height unit. Standard Gridfinity is 7.                                                                                                                                                                                         |
| `magnetAnchor`      | `"edge"` \| `"center"`                |          | `"edge"` |                           | Where magnet holes anchor in each cell. 'edge' holds a constant 8mm from the cell edge (the true Gridfinity corner). 'center' is the legacy fixed 13mm from cell centre. Identical at a 42mm grid; only observable above it.                   |
| `categories`        | [`Category`](#category)[]             | yes      |          | items >= 1, items <= 20   | Colour categories. Every Bin.category must name an id from this list.                                                                                                                                                                          |
| `layers`            | [`Layer`](#layer)[]                   | yes      |          | items >= 1, items <= 10   | Vertical layers, index 0 = BOTTOM. The UI displays them reversed; the file is always bottom-first.                                                                                                                                             |
| `bins`              | [`Bin`](#bin)[]                       | yes      |          |                           | Placed bins. May be empty.                                                                                                                                                                                                                     |
| `purpose`           | `string`                              |          |          |                           | Free-text drawer purpose, e.g. "workshop". Descriptive only.                                                                                                                                                                                   |
| `baseplateParams`   | [`BaseplateParams`](#baseplateparams) |          |          |                           |                                                                                                                                                                                                                                                |
| `activeBaseplateId` | `string` \| `null`                    |          |          |                           | Pointer to the active baseplate library design. null means a detached inline draft.                                                                                                                                                            |
| `linkedDesigns`     | [`LinkedDesign`](#linkeddesign)[]     |          |          |                           | Bin designs travelling with this layout, written by "export with designs". Each entry's id is matched against Bin.linkedDesignId. Omit when no bin carries a linkedDesignId; a layout exported without these arrives with dangling references. |
| `_meta`             | [`ExportMeta`](#exportmeta)           |          |          |                           |                                                                                                                                                                                                                                                |

<!-- generated:end -->

## Drawer

The drawer envelope, in grid units. `height` is in height **units**, not mm,
and must be at least the sum of the layer heights.

<!-- schema:Drawer -->

<a id="drawer"></a>

<!-- generated:start -->

| Field             | Type                                    | Required | Default | Constraint              | Notes                                                                                                                                                                                                                                                                       |
| ----------------- | --------------------------------------- | -------- | ------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`           | `number`                                | yes      |         | >= 0.5, <= 50, step 0.5 | Drawer width in grid units. 0.5 increments allowed (half-bin mode).                                                                                                                                                                                                         |
| `depth`           | `number`                                | yes      |         | >= 0.5, <= 50, step 0.5 | Drawer depth in grid units. 0.5 increments allowed.                                                                                                                                                                                                                         |
| `height`          | `number`                                | yes      |         | >= 1                    | Drawer height in HEIGHT units, not mm. Must be at least the sum of layer heights.                                                                                                                                                                                           |
| `fractionalEdgeX` | `"start"` \| `"end"`                    |          | `"end"` |                         | Which side carries the half-unit column when width is fractional. 'start' = left, 'end' = right.                                                                                                                                                                            |
| `fractionalEdgeY` | `"start"` \| `"end"`                    |          | `"end"` |                         | Which side carries the half-unit row when depth is fractional. 'start' = front/bottom, 'end' = back/top.                                                                                                                                                                    |
| `outline`         | [`DrawerOutline`](#draweroutline)       |          |         |                         |                                                                                                                                                                                                                                                                             |
| `gridShiftX`      | `number`                                |          |         |                         | Manual grid shift in mm along X inside a custom perimeter, composed on top of automatic lattice registration. Only meaningful with outline present. Consumers clamp to plus or minus half the grid pitch, since a larger shift is just a different whole-cell registration. |
| `gridShiftY`      | `number`                                |          |         |                         | Manual grid shift in mm along Y. Same clamping as gridShiftX.                                                                                                                                                                                                               |
| `measuredMm`      | [`MeasuredDrawerMm`](#measureddrawermm) |          |         |                         |                                                                                                                                                                                                                                                                             |

<!-- generated:end -->

### MeasuredDrawerMm

Your tape-measure reading of the physical drawer. Never consulted for geometry:
the grid dimensions stay authoritative. It exists so the fit slack stays visible
after you commit, and so the baseplate panel can pre-fill padding from it.

<!-- schema:MeasuredDrawerMm -->

<a id="measureddrawermm"></a>

<!-- generated:start -->

| Field    | Type     | Required | Default | Constraint    | Notes                         |
| -------- | -------- | -------- | ------- | ------------- | ----------------------------- |
| `width`  | `number` | yes      |         | >= 1, <= 5000 | Measured inside width in mm.  |
| `depth`  | `number` | yes      |         | >= 1, <= 5000 | Measured inside depth in mm.  |
| `height` | `number` |          |         | >= 1, <= 5000 | Measured inside height in mm. |

<!-- generated:end -->

## Layer

`layers[0]` is the **bottom** layer. The UI reverses them for display.

<!-- schema:Layer -->

<a id="layer"></a>

<!-- generated:start -->

| Field    | Type     | Required | Default | Constraint   | Notes                                                                             |
| -------- | -------- | -------- | ------- | ------------ | --------------------------------------------------------------------------------- |
| `id`     | `string` | yes      |         | length >= 1  | Unique id, referenced by Bin.layerId. Regenerated on import.                      |
| `name`   | `string` | yes      |         | length <= 24 | Display name.                                                                     |
| `height` | `number` | yes      |         | >= 2         | Layer height in height units. 1u is socket base only, so 2 is the minimum usable. |

<!-- generated:end -->

## Category

Every bin's `category` must name an `id` from this array. The schema cannot
check that; the importer can.

<!-- schema:Category -->

<a id="category"></a>

<!-- generated:start -->

| Field   | Type     | Required | Default | Constraint          | Notes                                                                                         |
| ------- | -------- | -------- | ------- | ------------------- | --------------------------------------------------------------------------------------------- |
| `id`    | `string` | yes      |         | length >= 1         | Unique id. Regenerated on import, so it only has to be internally consistent within the file. |
| `name`  | `string` | yes      |         | length <= 24        | Display name. Must be unique case-insensitively.                                              |
| `color` | `string` | yes      |         | `^#[0-9a-fA-F]{6}$` | Hex colour, #RRGGBB.                                                                          |

<!-- generated:end -->

## Bin

Coordinates are grid units with the origin at the **bottom-left**: `x` grows
right, `y` grows up. A bin at `y: 0` sits at the front of the drawer.

Set `layerId` to the literal `__staging__` to park a bin in the off-grid stash
instead of placing it on the grid.

<!-- schema:Bin -->

<a id="bin"></a>

<!-- generated:start -->

| Field              | Type                                             | Required | Default | Constraint           | Notes                                                                                                                                                                                      |
| ------------------ | ------------------------------------------------ | -------- | ------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`               | `string`                                         | yes      |         | length >= 1          | Unique id. Regenerated on import.                                                                                                                                                          |
| `layerId`          | `string`                                         | yes      |         | length >= 1          | Owning layer id, or the literal "**staging**" to park the bin in the off-grid stash instead of on the grid.                                                                                |
| `x`                | `number`                                         | yes      |         | >= 0, step 0.5       | Left edge in grid units, 0-based, measured from the LEFT.                                                                                                                                  |
| `y`                | `number`                                         | yes      |         | >= 0, step 0.5       | Bottom edge in grid units, 0-based, measured from the BOTTOM.                                                                                                                              |
| `width`            | `number`                                         | yes      |         | > 0, <= 50, step 0.5 | Width in grid units. 0.5 increments allowed.                                                                                                                                               |
| `depth`            | `number`                                         | yes      |         | > 0, <= 50, step 0.5 | Depth in grid units. 0.5 increments allowed.                                                                                                                                               |
| `height`           | `number`                                         | yes      |         | >= 2                 | Height in height units. Must be at least the owning layer's height and must fit the space to the drawer top. The schema cannot check that; the importer does.                              |
| `clearanceHeight`  | `number`                                         |          |         | >= 0                 | Extra blocked space above the bin in height units, for contents taller than the bin.                                                                                                       |
| `category`         | `string`                                         |          |         | length >= 1          | Category id. The exporter always writes one, and it MUST match an id in the categories array; a dangling reference fails import. Omitted is tolerated and backfills to an empty id.        |
| `label`            | `string`                                         |          |         | length <= 24         | Short bin label. The exporter always writes one; omitted backfills to an empty string.                                                                                                     |
| `notes`            | `string`                                         |          |         | length <= 256        | Longer note. The exporter always writes one; omitted backfills to an empty string.                                                                                                         |
| `customProperties` | [`CustomProperties`](#customproperties)          |          |         |                      |                                                                                                                                                                                            |
| `linkedDesignId`   | `string`                                         |          |         |                      | Id of a saved bin design. Should match a linkedDesigns[].id in the same file, otherwise the reference dangles after import.                                                                |
| `extendToMargin`   | `boolean`                                        |          | `false` |                      | Let this bin's walls extend into the baseplate's drawer-fit margin on every drawer edge it abuts. A flag, not a distance: the per-side reach is derived live from baseplateParams padding. |
| `marginTaper`      | [`MarginTaper`](#margintaper)                    |          |         |                      |                                                                                                                                                                                            |
| `overhang`         | [`OverhangConfig`](bin-design.md#overhangconfig) |          |         |                      |                                                                                                                                                                                            |
| `locked`           | `boolean`                                        |          | `false` |                      | Freeze size. While true, width/depth/height edits are rejected and automatic resizes skip this bin. Position and descriptive fields stay editable.                                         |
| `pairId`           | `string`                                         |          |         |                      | Groups a two-piece design (knife block plus handle rest) so both move, stash and delete together. An orphaned pairId is dropped on import.                                                 |
| `pairRole`         | `"block"` \| `"rest"`                            |          |         |                      | Which piece of the pair this bin is.                                                                                                                                                       |

<!-- generated:end -->

### CustomProperties

<!-- schema:CustomProperties indexed -->

<a id="customproperties"></a>

A map of user metadata with no fixed keys, so there is nothing to enumerate.
Keys and values are strings, bounded by `validateCustomProperties` in
`src/shared/utils/validationProperties.ts`.

### MarginTaper

Angles a drawer-margin bin's outer wall outward over `bandHeight`, so the bin
reaches into a drawer's curved sides while its base still sits flat. Requires
`extendToMargin`.

<!-- schema:MarginTaper -->

<a id="margintaper"></a>

<!-- generated:start -->

| Field        | Type                      | Required | Default | Constraint   | Notes                                                                                                     |
| ------------ | ------------------------- | -------- | ------- | ------------ | --------------------------------------------------------------------------------------------------------- |
| `profile`    | `"chamfer"` \| `"fillet"` | yes      |         |              | Cross-section shape of the taper.                                                                         |
| `bandHeight` | `number`                  | yes      |         | >= 0, <= 350 | How far up the wall the taper rises, in mm.                                                               |
| `enabled`    | `boolean`                 |          |         |              | Absent means enabled is inferred from any non-zero side.                                                  |
| `flare`      | `number`                  |          |         | >= 0, <= 42  | Extra width in mm at the rim beyond the padding. The only authored width; applied on every abutting edge. |

<!-- generated:end -->

### OverhangConfig

Defined in the bin design schema, because the same shape is both an authored
design parameter and a per-placement override. See
[bin-design.md](bin-design.md#overhangconfig).

## Custom perimeters

A drawer that is not a rectangle carries `drawer.outline`: **one** closed
counter-clockwise loop, implicitly closed from the last vertex back to the
first. Do not repeat the first vertex at the end. Interior holes cannot be
expressed, since it is a single loop.

Outline vertices are in drawer-local **millimetres**, not grid units, spanning
`[0, width * gridUnitMm]` by `[0, depth * gridUnitMm]`. This is the one place
the format mixes unit systems, and it is the most common way to get an outline
silently wrong.

The loop must be simple (non-self-intersecting), lie inside the grid extent, and
enclose at least one grid cell.

<!-- schema:DrawerOutline -->

<a id="draweroutline"></a>

<!-- generated:start -->

| Field       | Type                                    | Required | Default | Constraint | Notes                                                              |
| ----------- | --------------------------------------- | -------- | ------- | ---------- | ------------------------------------------------------------------ |
| `vertices`  | [`OutlineVertex`](#outlinevertex)[]     | yes      |         | items >= 3 | Counter-clockwise loop. Do not repeat the first vertex at the end. |
| `authoring` | [`OutlineAuthoring`](#outlineauthoring) |          |         |            |                                                                    |

<!-- generated:end -->

### OutlineVertex

<!-- schema:OutlineVertex -->

<a id="outlinevertex"></a>

<!-- generated:start -->

| Field   | Type     | Required | Default | Constraint  | Notes                                                                                                                                                                             |
| ------- | -------- | -------- | ------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x`     | `number` | yes      |         |             | X in mm from the grid's bottom-left.                                                                                                                                              |
| `y`     | `number` | yes      |         |             | Y in mm from the grid's bottom-left.                                                                                                                                              |
| `bulge` | `number` |          |         | >= -1, <= 1 | Arc bulge for the segment from this vertex to the next, DXF LWPOLYLINE convention tan(sweep/4). 0 or absent is a straight line. Magnitude at most 1, capping arcs at 180 degrees. |

<!-- generated:end -->

### OutlineAuthoring

A round-trip hint recording which editor drew the outline, so it can reopen in
the same mode. Never trusted for geometry, and sanitized server-side.

<!-- schema:OutlineAuthoring -->

<a id="outlineauthoring"></a>

<!-- generated:start -->

| Field     | Type                                             | Required | Default | Constraint | Notes                                        |
| --------- | ------------------------------------------------ | -------- | ------- | ---------- | -------------------------------------------- |
| `kind`    | `"cells"` \| `"corners"` \| `"trace"` \| `"pen"` | yes      |         |            | Authoring surface that produced the outline. |
| `corners` | [`CornerCutParams`](#cornercutparams)            |          |         |            |                                              |

<!-- generated:end -->

### CornerCutParams

<!-- schema:CornerCutParams -->

<a id="cornercutparams"></a>

<!-- generated:start -->

| Field | Type                      | Required | Default | Constraint | Notes |
| ----- | ------------------------- | -------- | ------- | ---------- | ----- |
| `tl`  | [`CornerCut`](#cornercut) |          |         |            |       |
| `tr`  | [`CornerCut`](#cornercut) |          |         |            |       |
| `bl`  | [`CornerCut`](#cornercut) |          |         |            |       |
| `br`  | [`CornerCut`](#cornercut) |          |         |            |       |

<!-- generated:end -->

`CornerCut` is a discriminated union on `kind` with no fixed property set:
`{"kind": "none"}`, `{"kind": "chamfer", "size": n}`,
`{"kind": "radius", "r": n}`, or `{"kind": "notch", "w": n, "d": n}`.
Dimensions in mm.

<!-- schema:CornerCut indexed -->

<a id="cornercut"></a>

Defined in `src/core/types/drawerOutline.ts`.

## Baseplate

Per-layout baseplate configuration. The four `padding*` values are the
drawer-fit margin in mm on each side, and several other fields only mean
anything in combination with them.

<!-- schema:BaseplateParams -->

<a id="baseplateparams"></a>

<!-- generated:start -->

| Field                           | Type                                                                                                | Required | Default      | Constraint              | Notes                                                                                                                                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | -------- | ------------ | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `magnetHoles`                   | `boolean`                                                                                           | yes      |              |                         | Cut magnet holes in the plate.                                                                                                                                                                                                               |
| `magnetDiameter`                | `number`                                                                                            | yes      |              | >= 4, <= 10             | Magnet hole diameter in mm.                                                                                                                                                                                                                  |
| `magnetDepth`                   | `number`                                                                                            | yes      |              | >= 1, <= 4              | Magnet hole depth in mm.                                                                                                                                                                                                                     |
| `paddingLeft`                   | `number`                                                                                            | yes      |              | >= 0                    | Drawer-fit margin on -X in mm.                                                                                                                                                                                                               |
| `paddingRight`                  | `number`                                                                                            | yes      |              | >= 0                    | Drawer-fit margin on +X in mm.                                                                                                                                                                                                               |
| `paddingFront`                  | `number`                                                                                            | yes      |              | >= 0                    | Drawer-fit margin on -Y in mm.                                                                                                                                                                                                               |
| `paddingBack`                   | `number`                                                                                            | yes      |              | >= 0                    | Drawer-fit margin on +Y in mm.                                                                                                                                                                                                               |
| `paddingAnchor`                 | `"tl"` \| `"tc"` \| `"tr"` \| `"ml"` \| `"c"` \| `"mr"` \| `"bl"` \| `"bc"` \| `"br"` \| `"custom"` |          |              |                         | Nine-point padding distribution anchor. First letter is vertical (t/m/b), second horizontal (l/c/r). 'custom' means per-side edited with no anchor.                                                                                          |
| `overTile`                      | `boolean`                                                                                           |          | `false`      |                         | Fill the drawer-fit padding with functional grid (a clipped tile per axis) instead of solid plastic. A sub-threshold sliver falls back to solid.                                                                                             |
| `overTileHalfGrid`              | `boolean`                                                                                           |          | `false`      |                         | Pack true 0.5-unit half-sockets into each margin before falling back to a clipped tile. Only meaningful when overTile is true.                                                                                                               |
| `overTileHalfGridSolidLeftover` | `boolean`                                                                                           |          | `false`      |                         | Leave the sub-half-unit remainder solid instead of making it a clipped pocket. Only meaningful when overTileHalfGrid is true.                                                                                                                |
| `wholeCellsOnly`                | `boolean`                                                                                           |          | `false`      |                         | Fit a custom perimeter by whole cells only, dropping any cell the outline crosses. Only meaningful with drawer.outline.                                                                                                                      |
| `connectorNubs`                 | `boolean`                                                                                           |          | `false`      |                         | Enable registration connectors on split-piece join edges.                                                                                                                                                                                    |
| `lightweight`                   | `boolean`                                                                                           |          | `true`       |                         | Remove centre floor material, keeping only magnet pads.                                                                                                                                                                                      |
| `solidFloor`                    | `boolean`                                                                                           |          | `false`      |                         | Leave a solid floor under every socket instead of cutting pockets through. Adds solidFloorThickness below the 5mm socket; pocket depth is unchanged.                                                                                         |
| `solidFloorThickness`           | `number`                                                                                            |          | `0.8`        | >= 0.4, <= 5            | Thickness in mm of the solid floor. Only meaningful when solidFloor is true.                                                                                                                                                                 |
| `syncWithLayout`                | `boolean`                                                                                           |          | `true`       |                         | Derive grid dimensions from the drawer. When false, baseplateWidth and baseplateDepth are used.                                                                                                                                              |
| `baseplateWidth`                | `number`                                                                                            |          |              | >= 0.5, <= 50, step 0.5 | Custom grid width in units. Used only when syncWithLayout is false.                                                                                                                                                                          |
| `baseplateDepth`                | `number`                                                                                            |          |              | >= 0.5, <= 50, step 0.5 | Custom grid depth in units. Used only when syncWithLayout is false.                                                                                                                                                                          |
| `invertDovetails`               | `boolean`                                                                                           |          | `false`      |                         | Swap the tongue/groove convention on all join edges.                                                                                                                                                                                         |
| `preferIdenticalPieces`         | `boolean`                                                                                           |          | `false`      |                         | Optimise for fewer unique part designs at the cost of more total parts. Produces twice the connector features per boundary and may add one or two pieces.                                                                                    |
| `connectorStyle`                | `"dovetail"` \| `"puzzle"` \| `"dovetailKey"` \| `"snapClip"`                                       |          | `"dovetail"` |                         | Connector geometry on join edges. 'dovetail' is a near-flat slip fit; 'puzzle' is a locking jigsaw tab; 'dovetailKey' and 'snapClip' cut female features on both sides and ship a separate part. Only meaningful when connectorNubs is true. |
| `connectorSlotsAllEdges`        | `boolean`                                                                                           |          | `false`      |                         | Also cut seam slots on exterior edges so each piece keys into any other plate. Only valid for the both-female styles with connectorNubs on; padded exterior edges are skipped.                                                               |
| `connectorFitOffset`            | `number`                                                                                            |          |              |                         | Fit offset in mm added to per-side connector groove clearance. Positive is looser. Clamped so effective clearance never goes negative.                                                                                                       |
| `cornerRadius`                  | `number`                                                                                            |          | `2.5`        | >= 0                    | Uniform outer corner radius in mm. Gridfinity spec is 2.5.                                                                                                                                                                                   |
| `cornerRadii`                   | [`CornerRadii`](#cornerradii)                                                                       |          |              |                         |                                                                                                                                                                                                                                              |
| `fractionalEdgeX`               | `"start"` \| `"end"`                                                                                |          | `"end"`      |                         | Which edge carries the half-unit column when baseplateWidth is fractional and syncWithLayout is false.                                                                                                                                       |
| `fractionalEdgeY`               | `"start"` \| `"end"`                                                                                |          | `"end"`      |                         | Which edge carries the half-unit row when baseplateDepth is fractional and syncWithLayout is false.                                                                                                                                          |
| `detachMargins`                 | `boolean`                                                                                           |          | `false`      |                         | Detach drawer-fit padding into separate printable rail pieces so a bad margin does not scrap the whole plate.                                                                                                                                |
| `detachMarginConnector`         | `boolean`                                                                                           |          | `false`      |                         | Add a connector at each body-to-long-rail seam. Short rails and corners stay friction-fit. Only meaningful when detachMargins is true.                                                                                                       |
| `stackPrint`                    | [`StackPrintParams`](#stackprintparams)                                                             |          |              |                         |                                                                                                                                                                                                                                              |
| `splitOverride`                 | [`SplitOverride`](#splitoverride)                                                                   |          |              |                         |                                                                                                                                                                                                                                              |
| `screwHoles`                    | [`ScrewHoleParams`](#screwholeparams)                                                               |          |              |                         |                                                                                                                                                                                                                                              |

<!-- generated:end -->

### CornerRadii

<!-- schema:CornerRadii -->

<a id="cornerradii"></a>

<!-- generated:start -->

| Field | Type     | Required | Default | Constraint | Notes                     |
| ----- | -------- | -------- | ------- | ---------- | ------------------------- |
| `tl`  | `number` | yes      |         | >= 0       | Back-left radius in mm.   |
| `tr`  | `number` | yes      |         | >= 0       | Back-right radius in mm.  |
| `bl`  | `number` | yes      |         | >= 0       | Front-left radius in mm.  |
| `br`  | `number` | yes      |         | >= 0       | Front-right radius in mm. |

<!-- generated:end -->

### StackPrintParams

<!-- schema:StackPrintParams -->

<a id="stackprintparams"></a>

<!-- generated:start -->

| Field     | Type      | Required | Default | Constraint   | Notes                                                                         |
| --------- | --------- | -------- | ------- | ------------ | ----------------------------------------------------------------------------- |
| `enabled` | `boolean` | yes      |         |              | Enable stack printing.                                                        |
| `gapMm`   | `number`  | yes      | `0.2`   | >= 0.1, <= 1 | Air gap between stacked copies in mm. One print layer, about 0.2, is typical. |
| `copies`  | `integer` |          | `1`     | >= 1, <= 20  | How many copies of the whole layout to print.                                 |

<!-- generated:end -->

### SplitOverride

`cols` must sum to the plate width and `rows` to its depth. When they do not,
the override is dropped and the automatic plan is used instead, silently.

<!-- schema:SplitOverride -->

<a id="splitoverride"></a>

<!-- generated:start -->

| Field  | Type       | Required | Default | Constraint | Notes                                                      |
| ------ | ---------- | -------- | ------- | ---------- | ---------------------------------------------------------- |
| `cols` | `number`[] | yes      |         |            | Chunk widths in grid units, left to right, in print order. |
| `rows` | `number`[] | yes      |         |            | Chunk depths in grid units, front to back, in print order. |

<!-- generated:end -->

### ScrewHoleParams

<!-- schema:ScrewHoleParams -->

<a id="screwholeparams"></a>

<!-- generated:start -->

| Field              | Type                               | Required | Default | Constraint  | Notes                                                                                               |
| ------------------ | ---------------------------------- | -------- | ------- | ----------- | --------------------------------------------------------------------------------------------------- |
| `enabled`          | `boolean`                          | yes      |         |             | Cut screw holes.                                                                                    |
| `diameter`         | `number`                           |          |         | >= 2, <= 8  | Screw shaft hole diameter in mm.                                                                    |
| `headStyle`        | `"countersink"` \| `"counterbore"` |          |         |             | Head recess style.                                                                                  |
| `headDiameter`     | `number`                           |          |         | >= 3, <= 16 | Head recess diameter in mm. Absent uses the style default (8 for countersink, 5.5 for counterbore). |
| `counterboreDepth` | `number`                           |          |         | >= 0, <= 6  | Counterbore depth in mm. Only meaningful for headStyle 'counterbore'.                               |
| `screwsPerPiece`   | `integer`                          |          |         | >= 1, <= 8  | How many screw holes each split piece gets.                                                         |

<!-- generated:end -->

## Embedded designs

`linkedDesigns` carries the bin designs referenced by `bin.linkedDesignId`, so
a layout keeps its geometry when it travels. Ids are remapped on import exactly
like layer and category ids.

### LinkedDesign

<!-- schema:LinkedDesign -->

<a id="linkeddesign"></a>

<!-- generated:start -->

| Field    | Type                                   | Required | Default | Constraint  | Notes                                          |
| -------- | -------------------------------------- | -------- | ------- | ----------- | ---------------------------------------------- |
| `id`     | `string`                               | yes      |         | length >= 1 | Design id, matched against Bin.linkedDesignId. |
| `name`   | `string`                               | yes      |         |             | Design name.                                   |
| `params` | [`BinParams`](bin-design.md#binparams) | yes      |         |             |                                                |

<!-- generated:end -->

`params` is a full bin parameter set. See [bin-design.md](bin-design.md).

### ExportMeta

<!-- schema:ExportMeta -->

<a id="exportmeta"></a>

<!-- generated:start -->

| Field          | Type     | Required | Default | Constraint | Notes                            |
| -------------- | -------- | -------- | ------- | ---------- | -------------------------------- |
| `exportedFrom` | `string` |          |         |            | Origin URL of the exporting app. |
| `exportedAt`   | `string` |          |         |            | ISO 8601 export timestamp.       |

<!-- generated:end -->

## Recipes

### A drawer from scratch

Start from the smallest thing that imports, then grow it.

```json
{
  "$schema": "https://gridfinitylayouttool.com/schema/layout.schema.json",
  "version": "1.0",
  "name": "Minimal drawer",
  "drawer": { "width": 3, "depth": 2, "height": 6 },
  "printBedSize": 256,
  "gridUnitMm": 42,
  "heightUnitMm": 7,
  "categories": [{ "id": "cat-general", "name": "General", "color": "#3b82f6" }],
  "layers": [{ "id": "layer-base", "name": "Base", "height": 6 }],
  "bins": []
}
```

Then add bins one at a time, validating after each. Order matters less than
running `validate:json` often: a collision is reported against the second bin
involved, not the one you just wrote.

### Place a bin

```json
{
  "id": "bin-screws",
  "layerId": "layer-base",
  "x": 0,
  "y": 0,
  "width": 2,
  "depth": 2,
  "height": 6,
  "category": "cat-general",
  "label": "Screws",
  "notes": ""
}
```

`label` and `notes` are required but may be empty strings. `height` must be at
least the layer's height and must not exceed the space to the drawer top.

### Stash a bin off-grid

Set `layerId` to `__staging__`. Coordinates are kept but do not place it, and it
is exempt from collision checks:

```json
{
  "id": "bin-spare",
  "layerId": "__staging__",
  "x": 0,
  "y": 0,
  "width": 1,
  "depth": 1,
  "height": 4,
  "category": "cat-general",
  "label": "Spare",
  "notes": ""
}
```

### Cut a corner off the drawer

A 4x3 drawer at 42mm is 168mm x 126mm. To remove the back-right cell, walk the
boundary counter-clockwise from the bottom-left:

```json
"outline": {
  "vertices": [
    { "x": 0, "y": 0 },
    { "x": 168, "y": 0 },
    { "x": 168, "y": 84 },
    { "x": 126, "y": 84 },
    { "x": 126, "y": 126 },
    { "x": 0, "y": 126 }
  ],
  "authoring": { "kind": "cells" }
}
```

For a curved side, give a vertex a `bulge`: the DXF convention `tan(sweep / 4)`,
so a quarter-circle is `0.4142`. Positive sweeps counter-clockwise, bowing the
arc away from the interior on this loop.

### Attach a design to a bin

Give the bin a `linkedDesignId` and add the matching entry to `linkedDesigns`:

```json
"bins": [{ "id": "bin-1", "linkedDesignId": "design-tray", "...": "..." }],
"linkedDesigns": [
  { "id": "design-tray", "name": "Divided tray", "params": { "...": "..." } }
]
```

Without the `linkedDesigns` entry the reference dangles and the bin renders with
default geometry after import.

### Half-grid widths

Dimensions step by 0.5. A 1.5-wide bin is legal; 2.25 is not. Which side carries
the half unit is set by `fractionalEdgeX` and `fractionalEdgeY` on the drawer.
