---
title: Layout file format
description: 'Edit or write a layout JSON file by hand, avoid the unit and orientation traps, and validate it before import.'
sources:
  - docs/schemas/layout.md
  - docs/schemas/README.md
  - public/schema/layout.schema.json
  - src/core/storage/ShareService.ts
  - src/features/layout-library/components/LayoutManagerModal/ImportView/
  - src/core/constants.ts
---

# Layout file format

A layout file is a JSON text file that holds one planned drawer: the drawer size, the grid, the layers and every bin. It can also carry copies of the saved designs that its bins use. Use this page to edit a layout file by hand, to write one with a script, or to find why an import fails.

The published schema and a short overview are at [gridfinitylayouttool.com/schema](https://gridfinitylayouttool.com/schema).

## Get a layout file

The Layout Tool writes a layout file in two places:

- In the layout manager (<kbd>Ctrl</kbd>+<kbd>O</kbd>, or <kbd>Cmd</kbd>+<kbd>O</kbd> on macOS), click <Ui k="common.download" /> on the row of a layout.
- In the command palette, run <Ui k="commandPalette.downloadLayout" /> to save the layout that is open.

Both files include a copy of each saved design that a bin in the layout uses. <Ui k="layouts.exportAll" /> in the layout manager saves every layout in one archive file.

## Import a layout file

1. Open the layout manager with <kbd>Ctrl</kbd>+<kbd>O</kbd>.
2. Click <Ui k="common.import" />.
3. Drop the file on the drop area, or paste the JSON text into the box below it.
4. Read the summary under <Ui k="layouts.readyToImport" />.
5. Click <Ui k="layouts.importLayout" />.

The import adds a new layout to your library and opens it. The new name ends in "(imported)". Each design in the file goes into your saved designs, and the bins link to those copies. The import gives every layer, category and bin a new ID, so the IDs in a file only need to agree with each other.

<Screenshot id="reference-layout-file-import" alt="The Import view of the layout manager, with a pasted layout and the Ready to import summary." spec="Layout editor. Press Ctrl+O, click Import. Paste the minimal layout from this page into the JSON box so that the Ready to import summary shows the name, drawer size, layers and bins. Crop to the dialog." />

## What the file holds

The file is one JSON object. These are its top-level fields:

| Field             | Required | Unit       | What it holds                                                         |
| ----------------- | -------- | ---------- | --------------------------------------------------------------------- |
| `version`         | Yes      |            | Always `"1.0"`. The importer does not read it.                        |
| `name`            | Yes      |            | The layout name, 1 to 64 characters                                   |
| `drawer`          | Yes      | Grid units | The drawer `width` and `depth`, and its `height` in height units      |
| `gridUnitMm`      | Yes      | mm         | Size of one grid unit, 20 to 60. Standard Gridfinity is 42.           |
| `gridUnitMmY`     | No       | mm         | Grid unit front to back, for a grid that is not square                |
| `heightUnitMm`    | Yes      | mm         | Size of one height unit, 3 to 20. Standard Gridfinity is 7.           |
| `printBedSize`    | No       | mm         | Print bed width, 42 to 3000. The default is 256.                      |
| `printBedDepth`   | No       | mm         | Print bed depth. Leave it out for a square bed.                       |
| `categories`      | Yes      |            | 1 to 20 categories, each with an `id`, a `name` and a `#RRGGBB` color |
| `layers`          | Yes      |            | 1 to 10 layers, bottom layer first                                    |
| `bins`            | Yes      |            | The bins. The list can be empty.                                      |
| `baseplateParams` | No       |            | The baseplate settings of this layout                                 |
| `linkedDesigns`   | No       |            | Copies of the saved designs that the bins use                         |
| `_meta`           | No       |            | Where and when the file was exported. The importer removes it.        |

Each bin has these fields:

| Field             | Required | Unit         | What it holds                                                       |
| ----------------- | -------- | ------------ | ------------------------------------------------------------------- |
| `id`              | Yes      |              | Any text that no other bin in the file uses                         |
| `layerId`         | Yes      |              | The `id` of a layer, or `__staging__` for the stash                 |
| `x`, `y`          | Yes      | Grid units   | Position of the front-left corner, in steps of 0.5                  |
| `width`, `depth`  | Yes      | Grid units   | Size, 0.5 to 50, in steps of 0.5                                    |
| `height`          | Yes      | Height units | Height, 2 or more                                                   |
| `category`        | No       |              | The `id` of a category in the same file                             |
| `label`           | No       |              | Bin label, up to 24 characters                                      |
| `notes`           | No       |              | A note, up to 256 characters                                        |
| `clearanceHeight` | No       | Height units | Empty space above the bin for tall contents                         |
| `linkedDesignId`  | No       |              | The `id` of an entry in `linkedDesigns`                             |
| `locked`          | No       |              | `true` stops changes to the bin size                                |
| `items`           | No       |              | Up to 100 things that the bin holds, each with an `id` and a `name` |

The full field list, with every baseplate and drawer outline field, is in the [layout JSON reference](https://gridfinitylayouttool.com/schema).

## Avoid the traps

These mistakes give a file that imports without an error but shows the wrong drawer.

- **The grid origin is at the bottom left.** `x` grows to the right and `y` grows toward the back of the drawer. A bin at `"y": 0` sits at the front.
- **The first layer is the bottom layer.** The app shows layers from the top down, but the file lists them from the bottom up.
- **Heights are not millimetres.** A bin `height` counts height units of 7 mm, so `"height": 6` is a 42 mm bin.
- **Three units live in one file.** Width, depth and position are grid units. Heights are height units. A field that ends in `Mm` is millimetres.
- **Drawer outline corners are millimetres.** A drawer that is not a rectangle has an `outline` whose corners are in millimetres, not grid units.
- **Half steps are 0.5 only.** A size of `1.5` is correct. A size of `2.25` fails.
- **The stash is not a layer.** A bin with `"layerId": "__staging__"` goes to the stash. Do not add `__staging__` to `layers`.
- **Designs travel only inside the file.** A bin with a `linkedDesignId` and no matching `linkedDesigns` entry loses its design on import.

## A minimal layout

This file holds a drawer 3 grid units wide and 2 deep, with one bin in the front-left corner:

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
  "bins": [
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
  ]
}
```

## Validate a file

Add the `$schema` line from the example above to the top of your file. Most code editors then show completion and mark a wrong field or value while you type. The importer ignores this line.

The schema cannot see how the parts fit together, so the importer applies more rules. The import fails when:

- a bin `category` names no category in the file
- a bin is outside the drawer, is taller than the drawer, or covers another bin on the same layer
- a compartment or cell list in a design does not have one entry for each column and row

Add bins one at a time and import after each change. A collision shows on the second bin of the two, which is often not the bin that you edited.

::: tip
If you work from a copy of the source code, run `pnpm run validate:json path/to/file.json`. It reports schema errors and import errors separately.
:::

## Next steps

- [Bin design file format](./design-file): the JSON file for one bin design.
- [Units and sizes](../concepts/units): how grid units, height units and millimetres relate.
- [Layouts, layers and the stash](../concepts/layouts-layers-stash): what layers and the stash do in the app.
- [Organize your layouts](../layouts/organizing-layouts): export, import and archive layouts in the layout manager.
