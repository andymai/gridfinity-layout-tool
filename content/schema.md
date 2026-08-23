---
title: 'Gridfinity File Formats: Layout and Bin Design JSON'
description: The JSON formats behind Gridfinity Layout Tool exports, with published schemas you can validate against and edit by hand or with an AI assistant.
keywords: gridfinity json schema, gridfinity layout file format, gridfinity bin design json, edit gridfinity layout file, gridfinity file format, json schema gridfinity
schema: Article
breadcrumbs:
  - name: Home
    url: https://gridfinitylayouttool.com/
  - name: File Formats
    url: https://gridfinitylayouttool.com/schema
navCta:
  label: Open the Layout Planner
  href: /
faqs:
  - q: Can I edit a Gridfinity layout file by hand?
    a: 'Yes. Export Layout produces plain JSON, and the published schema describes every field. Add a $schema key pointing at the schema URL and most editors will offer completion and flag mistakes as you type.'
  - q: What is the difference between a layout file and a bin design file?
    a: "A layout file describes a whole drawer (its grid, layers, and the bins placed in it). A bin design file describes one bin's geometry: its compartments, cutouts, label tabs, and lid. A layout can carry copies of the designs its bins use, so it stays complete when you share it."
  - q: Why does my hand-edited file fail to import?
    a: "Usually a rule the schema cannot express. A bin has to fit inside the drawer and its layer without overlapping another bin, a bin's category has to name a category that exists in the same file, and a compartment grid's cell list has to be exactly cols multiplied by rows."
  - q: Are the units millimetres or grid units?
    a: 'Both, depending on the field. Widths, depths, and positions are in grid units, one unit being 42mm by default. Heights are in height units of 7mm. Any field whose name ends in Mm is millimetres. Custom drawer outlines are the exception worth remembering: their vertices are in millimetres.'
  - q: Can an AI assistant write these files?
    a: 'That is what the schemas are for. Point it at the schema URL and the reference documentation, and have it check its work before importing.'
---

# Gridfinity File Formats

Everything you make here is yours as a plain file. Two of those files are JSON,
and both are documented well enough to write by hand, or to hand to an AI
assistant.

## The two formats

**Layout JSON** comes from Export Layout. It describes one drawer: its size, the
grid it sits on, the layers stacked inside it, and every bin placed on them. It
can also carry copies of the bin designs those bins use, so a layout you send
someone arrives complete rather than pointing at designs they do not have.

**Bin design JSON** comes from Export design in the bin designer. It describes a
single bin: its compartments, cutouts, label tabs, wall patterns, colours, and
its lid if it has one.

## Published schemas

Both formats have a JSON Schema you can validate against:

- `https://gridfinitylayouttool.com/schema/layout.schema.json`
- `https://gridfinitylayouttool.com/schema/bin-design.schema.json`

Add a `$schema` key at the top of a file pointing at the matching URL, and most
editors will give you completion, inline documentation, and red squiggles on
mistakes while you type. The app ignores the key, so adding it costs nothing.

## Full reference

The complete field-by-field reference lives with the source code:

- [Layout JSON reference](https://github.com/andymai/gridfinity-layout-tool/blob/main/docs/schemas/layout.md)
- [Bin design JSON reference](https://github.com/andymai/gridfinity-layout-tool/blob/main/docs/schemas/bin-design.md)
- [Traps and validation guide](https://github.com/andymai/gridfinity-layout-tool/blob/main/docs/schemas/README.md)
- [Worked examples](https://github.com/andymai/gridfinity-layout-tool/tree/main/docs/schemas/examples)

## A minimal layout

A drawer three units wide and two deep, with one bin in the corner:

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

## Three things that catch people out

**The origin is the bottom-left corner.** `x` grows to the right and `y` grows
**up**, the way a graph works rather than the way a screen does. A bin at
`"y": 0` sits at the front of the drawer.

**The first layer is the bottom one.** The app shows layers top-down, but the
file always lists them bottom-first.

**Heights are not millimetres.** A bin's `height` counts 7mm height units, so
`"height": 6` is a 42mm-tall bin. Only fields ending in `Mm` are millimetres.

## Validating before you import

A file can be perfectly well-formed and still not import, because some rules
depend on how the pieces fit together rather than on any single value. A bin has
to fit inside the drawer and its layer without landing on another bin. A bin's
`category` has to name a category defined in the same file. A compartment grid's
cell list has to be exactly `cols` multiplied by `rows`.

If you are working from a clone of the source, the validator checks both layers
at once:

```
pnpm run validate:json path/to/file.json
```

It reports schema problems and import problems separately, so you can tell a
malformed field from a bin that simply does not fit.
