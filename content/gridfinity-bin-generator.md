---
title: Gridfinity Bin Generator — Free Online STL Creator
description: Gridfinity bin generator with visual editor and real-time 3D preview. Set dimensions, add compartments and cutouts, export STL, STEP, or 3MF. Free browser tool.
keywords: gridfinity generator, gridfinity bin generator, gridfinity STL generator, custom gridfinity bins, gridfinity designer, online gridfinity generator
schema: HowTo
breadcrumbs:
  - name: Home
    url: https://gridfinitylayouttool.com/
  - name: Bin Generator
    url: https://gridfinitylayouttool.com/gridfinity-bin-generator
howTo:
  name: How to Generate a Custom Gridfinity Bin
  description: Set dimensions, add features, preview in 3D, and download your custom Gridfinity bin as STL, STEP, or 3MF.
  totalTime: PT5M
  tools:
    - Web browser
  steps:
    - name: Set bin dimensions
      text: Choose width, depth, and height in Gridfinity grid units. Each unit is 42mm wide and 7mm tall.
    - name: Choose base and features
      text: Select a base attachment style (standard, magnet, screw, or flat). Add compartments, wall cutouts, label tabs, or scoop ramps as needed.
    - name: Preview in 3D
      text: The real-time 3D preview updates as you change parameters. Rotate and zoom to inspect your design from every angle.
    - name: Export and print
      text: Download your bin as an STL, STEP, or 3MF file. Open it in your slicer and print.
softwareApplication:
  name: Gridfinity Bin Generator
  description: Parametric Gridfinity bin generator with real-time 3D preview. Set dimensions, add compartments, cutouts, and labels, then export as STL, STEP, or 3MF. Free browser tool.
  applicationCategory: DesignApplication
  applicationSubCategory: 3D Printing Tools
  operatingSystem: Any
  browserRequirements: Requires JavaScript. Requires HTML5.
  offers:
    price: '0'
    priceCurrency: USD
  featureList:
    - Parametric bin dimensions (width, depth, height)
    - STL, STEP, and 3MF file export
    - 6 base attachment styles including magnet and screw
    - Honeycomb wall patterns
    - Configurable compartments with removable dividers
    - Scoop ramps for easy access
    - Per-side wall cutouts
    - Label tabs with bracket or solid support
    - Floor inserts (rectangle, circle, hexagon, slot)
    - Custom cutout editor with pen tool
    - Real-time 3D preview
    - Half-bin mode for 0.5 unit precision
    - Runs in browser, no installation required
faqs:
  - q: What file formats can I export?
    a: The generator exports STL (standard 3D printing format), STEP (for CAD editing), and 3MF (modern format with color and material support). Most slicers accept all three.
  - q: Do I need to install any software?
    a: No. It runs in your browser. Open the page and start — there's nothing to download or install.
  - q: How is this different from OpenSCAD gridfinity generators?
    a: OpenSCAD generators require installing software and editing code to change parameters. This generator runs in your browser with a visual interface and real-time 3D preview. You see changes instantly as you adjust settings.
  - q: Can I create bins with custom cutouts?
    a: Yes. The cutout editor lets you add rectangular, circular, or custom-shaped cutouts to your bins. Use the pen tool to draw complex shapes with bezier curves for tool holders, cable management, or any custom shape.
  - q: Will these bins fit my baseplates?
    a: Yes. They use the standard 42mm grid and socket profile. Compatible with any Gridfinity baseplate from any source.
  - q: Can I save and come back later?
    a: Yes. Designs save to your browser automatically. Name a design and it persists between sessions.
  - q: How big can bins be?
    a: Up to 8×8 grid units (336mm × 336mm). For larger spaces, use the layout planner to arrange multiple bins together.
  - q: Where do I get baseplates?
    a: Use the baseplate generator to create a baseplate sized to your drawer, with optional magnet holes and edge padding. Export as STL, STEP, or 3MF.
navCta:
  label: Open Generator
  href: /designer
---

# Gridfinity Bin Generator

A parametric bin generator that runs in your browser. Set your dimensions, add compartments or cutouts, check the 3D preview, and download an STL, STEP, or 3MF file. Nothing to install. Part of the [Gridfinity Generator](/gridfinity-generator) suite, which also includes the baseplate generator and the layout planner.

[CTA: Start Making a Bin](/designer)

![Gridfinity bin with honeycomb wall pattern and scoop ramp rendered in the bin generator's 3D preview](/images/landing/honeycomb-caddy-bin.png '1200x675')

## How It Works

1. **Set your size.** Pick width, depth, and height in grid units. Need something between standard sizes? Half-bin mode gives you 0.5-unit precision.
2. **Add what you need.** Compartments, wall cutouts, scoop ramps, label tabs — toggle them on and adjust with sliders.
3. **Check the preview.** The 3D view updates instantly as you change settings. Rotate and zoom to see every angle.
4. **Download and print.** Export as STL for your slicer, STEP if you want to edit in CAD, or 3MF for color and material support.

> All processing happens locally. Your designs stay on your device unless you share them.

## Features

**Compartments.** Split a bin into a grid of sections, up to 8×8. Divider walls generate automatically. You can export removable dividers as separate files if you want to reconfigure without reprinting.

**Scoop ramps and wall cutouts.** Scoop ramps make it easier to reach small parts at the bottom. Wall cutouts — U-shaped notches on any side — let you slide things out sideways.

**Label tabs.** A shelf on the back wall holds label strips. Choose bracket or solid support and set the width for each column.

For items that need to stay in place, **floor inserts** cut shaped cavities into the floor — circles for batteries, hexagons for bits, rectangles for components. Set the depth and rotation to match what you're storing.

The **cutout editor** handles unusual shapes. Switch to solid mode, carve from the top, and use the pen tool to draw freeform paths for wrenches, pliers, or anything with an odd profile.

## Base Attachment Options

Choose how the bin connects to your baseplate:

- **Standard** — the default Gridfinity socket
- **Magnet** — embedded cavities for 6mm×2mm magnets
- **Screw** — holes for threaded inserts
- **Magnet & Screw** — both methods for maximum hold
- **Weighted** — heavier base without magnets
- **Flat** — no socket, for use without a baseplate

## Export Formats

| Format   | When to Use It                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------- |
| **STL**  | Send it straight to your slicer. Works with PrusaSlicer, Cura, OrcaSlicer, and everything else. |
| **STEP** | Open in Fusion 360, FreeCAD, or SolidWorks to make further edits before printing.               |
| **3MF**  | Includes color and material metadata. Good for multi-material printers.                         |

## Why This Instead of OpenSCAD?

OpenSCAD gridfinity generators work, but you need to install software and edit code to change a parameter. This runs in your browser with a visual interface. You see the result immediately instead of waiting for a render.

It also exports STEP and 3MF — not just STL — and works on your phone if you need to check something on the go.

## Next Steps

New to Gridfinity? Read [What is Gridfinity?](/what-is-gridfinity) for the basics. Already know what you need? Check the [sizes reference](/gridfinity-sizes) to figure out your dimensions, or jump into the [planning guide](/guide) to lay out a whole drawer.

[CTA: Start Making a Bin](/designer)
