---
title: 'Gridfinity Cutout Generator: Shaped Cavities for Any Tool'
description: Cut a cavity shaped like the thing you are storing. Draw it, pick a shape, or import an STL and imprint it. Export STL, STEP, or 3MF.
keywords: gridfinity cutout generator, gridfinity custom cutout, gridfinity tool cutout, gridfinity cutout maker, tool cutout generator, gridfinity shadow board, gridfinity mesh imprint, gridfinity stl cutout
schema: HowTo
breadcrumbs:
  - name: Home
    url: https://gridfinitylayouttool.com/
  - name: Cutout Generator
    url: https://gridfinitylayouttool.com/gridfinity-cutout-generator
navCta:
  label: Open the Cutout Editor
  href: /designer
howTo:
  name: How to Generate a Gridfinity Cutout
  description: Carve a shaped cavity into a Gridfinity bin so a tool sits in its own recess, then export it for printing.
  totalTime: PT5M
  tools:
    - Web browser
  steps:
    - name: Start from a solid bin
      text: Set the bin's width, depth, and height in grid units, then switch the interior to solid so there is material to carve into.
    - name: Add a cutout
      text: Pick a rectangle, circle, slot, or polygon, or draw a freeform path with the pen tool. Position it on the bin floor and set its depth.
    - name: Imprint an STL instead
      text: Import an STL of the object and the generator imprints its outline into the floor, so the cavity matches the real part rather than an approximation of it.
    - name: Export and print
      text: Download the bin as STL, STEP, or 3MF and slice it. Cutouts print without supports when they are carved from the top.
softwareApplication:
  name: Gridfinity Cutout Generator
  alternateName:
    - Gridfinity Custom Cutout Generator
    - Gridfinity Tool Cutout Generator
  description: Carve shaped cavities into Gridfinity bins. Rectangle, circle, slot, polygon, freeform pen paths, and imprints from an imported STL. Exports STL, STEP, and 3MF.
  applicationCategory: DesignApplication
  applicationSubCategory: 3D Printing Tools
  operatingSystem: Any
  browserRequirements: Requires JavaScript. Requires HTML5.
  permissions: none
  isAccessibleForFree: true
  offers:
    price: '0'
    priceCurrency: USD
    availability: https://schema.org/InStock
  featureList:
    - Rectangle, circle, slot, and polygon cutouts
    - Freeform pen tool with bezier curves
    - Mesh imprint from an imported STL
    - Per-side wall cutouts
    - Adjustable cavity depth and entry chamfer
    - Colored cavity floors for shadow-board contrast
    - STL, STEP, and 3MF export
faqs:
  - q: What is a Gridfinity cutout?
    a: A cavity carved into a bin's material in the shape of what you are storing, so the item sits in its own recess instead of loose in an open bin. It is the Gridfinity version of a shadow board — good for wrenches, bits, sockets, and anything that should stay put and stay findable.
  - q: Can I make a cutout in the shape of a specific tool?
    a: Yes, two ways. Draw the outline with the pen tool, which supports bezier curves for shapes that are not made of straight lines, or import an STL of the object and let the generator imprint its outline into the floor.
  - q: What shapes can a cutout be?
    a: Rectangle, circle, slot, and polygon as presets, a freeform path drawn with the pen tool, or a mesh imprinted from an imported STL. Each one takes its own depth, position, and rotation.
  - q: What file types can I import for a cutout?
    a: STL. Files up to 50 MB are accepted and a design can carry up to 8 imported meshes. The file is repaired, laid flat, and simplified in the browser before it becomes a cavity.
  - q: Does importing an STL add a Gridfinity base to my model?
    a: No, and this is the common mix-up. An imported STL becomes the shape of a cavity carved into a bin, not a model that gets a Gridfinity foot attached. If you want an existing model to sit on a baseplate, the bin is the part that provides the base.
  - q: Do cutouts need supports when printing?
    a: Not when they are carved down from the top of a solid bin, which is how the editor works. The cavity is open at the top, so there is nothing to bridge.
  - q: Can I make the cutout floor a different color?
    a: Yes. A cavity can take its own color on the floor, or on the floor and interior walls, which gives you the dark backing that makes a shadow board readable at a glance. It needs a multi-material printer or a filament change to show up in the print.
  - q: Will a bin with cutouts still fit a standard baseplate?
    a: Yes. Cutouts only remove material from the interior. The 42mm footprint and the base profile are untouched, so the bin fits any Gridfinity baseplate.
---

# Gridfinity Cutout Generator

Carve a cavity shaped like the thing you are storing, so it sits in its own recess instead of rattling around an open bin. Draw the outline, pick a preset shape, or import an STL of the object and let the generator imprint it.

[CTA: Open the Cutout Editor](/designer)

![Gridfinity bin with a custom pen-tool cutout carved into a solid interior](/images/landing/honeycomb-caddy-bin.png '1200x675')

## How It Works

1. **Start solid.** Set the bin size in grid units, then switch the interior to solid so there is material to cut into. An ordinary hollow bin has nothing to carve.
2. **Add the cutout.** Choose a shape, place it on the floor, and set how deep it goes. Depth is what decides whether a socket sits flush or stands proud.
3. **Refine the fit.** Rotate it, nudge it, and add an entry chamfer so the part drops in without catching on the edge.
4. **Export.** STL for the slicer, STEP if you want to keep editing in CAD, 3MF for color and material data.

## Cutout Shapes

**Rectangle, circle, and slot** cover most parts: batteries, drill bits, allen keys, USB drives. Set the size in millimeters and the depth separately, so a shallow tray and a deep socket well come from the same control.

**Polygon** suits anything with flat faces — hex bits, nuts, a hex-shafted driver.

**The pen tool** is for the rest. Draw the silhouette point by point with bezier curves between them, which is what an adjustable wrench, a pair of pliers, or a scissor handle actually needs. Straight-line approximations of curved tools look wrong and hold the part loosely.

**A mesh imprint** takes the guesswork out entirely: import an STL of the object and the outline comes from the model rather than from your tracing.

## Imprinting an STL

Import a model and the generator repairs it, lays it flat, and simplifies it in the browser, then shows you an orientation step so you can rotate it before committing. The result is a cavity in that outline.

Files up to 50 MB are accepted, and one design can carry up to 8 imported meshes — enough for a full driver set in a single bin.

Worth being clear about a common mix-up: this makes an imported model into a **hole**, not into a Gridfinity-compatible part. If you have an STL you want sitting on a baseplate, the bin is what provides the base and the profile; the model goes in the cavity.

## Wall Cutouts Are a Different Thing

A wall cutout is a notch in the side of a bin, not a recess in its floor — a U-shaped gap so a long screwdriver or a wooden spoon can overhang the end, or a scoop so you can sweep small parts out with a thumb. They are configured per side and can be combined with floor cutouts in the same bin.

## Repeating One Cutout

Sets are the common case: twelve socket wells, a row of drill bits, a ring of screwdriver slots. Draw one, open **Repeat**, and pick a grid, a staggered grid, or a ring. Spacing and counts are clamped to the bin, so an arrangement cannot run off the edge or leave walls too thin to print.

The copies are derived rather than pasted, which is the part that matters. Resize the original and all of them resize with it, so tuning a socket well to fit is one edit instead of twelve. Flatten it back to independent cutouts at any point if you need to move one on its own.

If you have already duplicated a shape by hand into a regular arrangement, select the copies and the editor offers to fold them into a single repeat, telling you first how far anything will move.

## Shadow Boards

Give a cavity its own color, on the floor or on the floor and interior walls, and you get the dark backing that makes a missing tool obvious from across the room. It needs a multi-material printer or a mid-print filament change to appear in the print, but the file carries the assignment either way.

## Next Steps

The cutout editor lives in the [bin designer](/designer). For the surrounding features — compartments, label tabs, base styles — see the [bin generator guide](/gridfinity-bin-generator), and for a whole drawer planned around cut-to-shape bins, the [tool drawer walkthrough](/gridfinity-tool-drawer). Sizes and depths are in the [sizes reference](/gridfinity-sizes).

[CTA: Open the Cutout Editor](/designer)
