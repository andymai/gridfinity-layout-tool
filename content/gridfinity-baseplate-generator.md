---
title: Gridfinity Baseplate Generator — Free Online STL Creator
description: Generate a custom Gridfinity baseplate sized to your drawer — set the grid, add magnet holes and connectors, and it auto-splits to fit your print bed. 3D preview, free STL/STEP/3MF export, no account.
keywords: gridfinity baseplate generator, gridfinity baseplate, custom gridfinity baseplate, gridfinity STL, drawer baseplate, magnet baseplate
schema: HowTo
breadcrumbs:
  - name: Home
    url: https://gridfinitylayouttool.com/
  - name: Baseplate Generator
    url: https://gridfinitylayouttool.com/gridfinity-baseplate-generator
howTo:
  name: How to Generate a Custom Gridfinity Baseplate
  description: Set your grid size, configure features, preview in 3D, and download your custom Gridfinity baseplate as STL, STEP, or 3MF.
  totalTime: PT3M
  tools:
    - Web browser
  steps:
    - name: Set baseplate dimensions
      text: Choose width and depth in Gridfinity grid units, or sync with your existing layout to match your drawer size automatically.
    - name: Configure features
      text: Enable magnet holes for magnetic bin attachment, add connector nubs for half-cell alignment, and set edge padding per side for drawer fit.
    - name: Preview in 3D
      text: The real-time 3D preview updates as you change parameters. Rotate and zoom to inspect your baseplate from every angle.
    - name: Export and print
      text: Download your baseplate as STL, STEP, or 3MF. Large baseplates are automatically split into pieces that fit your print bed.
softwareApplication:
  name: Gridfinity Baseplate Generator
  description: Parametric Gridfinity baseplate generator with real-time 3D preview. Set grid size, add magnet holes and connector nubs, configure edge padding, then export as STL, STEP, or 3MF. Free browser tool.
  applicationCategory: DesignApplication
  applicationSubCategory: 3D Printing Tools
  operatingSystem: Any
  browserRequirements: Requires JavaScript. Requires HTML5.
  offers:
    price: '0'
    priceCurrency: USD
  featureList:
    - Parametric baseplate dimensions synced with layout
    - STL, STEP, and 3MF file export
    - Magnet hole cavities (6mm x 2mm)
    - Half-cell connector nubs
    - Per-side edge padding configuration
    - Fit-to-drawer mode with automatic sizing
    - Automatic split for large baseplates exceeding print bed
    - Real-time 3D preview
    - Runs in browser, no installation required
faqs:
  - q: What file formats can I export baseplates in?
    a: The generator exports STL (standard 3D printing format), STEP (for CAD editing), and 3MF (modern format with color and material support). Most slicers accept all three.
  - q: Can the baseplate include magnet holes?
    a: Yes. Enable magnet holes to add 6mm x 2mm cavities at each grid intersection. These hold standard neodymium magnets so bins snap securely to the baseplate.
  - q: What happens if my baseplate is too large for my print bed?
    a: The generator automatically detects when a baseplate exceeds your print bed size and splits it into printable pieces. You get a ZIP file with all pieces ready to print and assemble.
  - q: Can I fit the baseplate to my exact drawer dimensions?
    a: Yes. Sync the baseplate with your layout to match your drawer size automatically. Use per-side edge padding to fine-tune the fit so the baseplate sits flush in your drawer.
  - q: How is this different from downloading baseplates on Printables or Thangs?
    a: Pre-made baseplates come in fixed sizes. This generator creates a baseplate that matches your exact drawer dimensions, with the features you need. It runs in your browser with a visual interface and real-time 3D preview.
  - q: Will these baseplates work with standard Gridfinity bins?
    a: Yes. They use the standard 42mm grid and socket profile. Compatible with any Gridfinity bin from any source.
navCta:
  label: Open Generator
  href: /baseplate?standalone=1
---

# Gridfinity Baseplate Generator

A parametric baseplate generator that runs in your browser. Set your grid size, configure magnet holes and edge padding, check the 3D preview, and download an STL, STEP, or 3MF file. Nothing to install. Part of the [Gridfinity Generator](/gridfinity-generator) suite, which also includes the bin generator and the layout planner.

[CTA: Start Generating](/baseplate?standalone=1)

![Gridfinity baseplate generator showing an 11 by 9 magnet-hole baseplate in an isometric 3D preview](/images/landing/baseplate-preview.png '1200x675')

## How It Works

1. **Set your size.** Pick width and depth in grid units, or sync with your existing layout to match your drawer automatically.
2. **Configure features.** Enable magnet holes for magnetic attachment, add connector nubs for half-cell alignment, and set edge padding per side.
3. **Check the preview.** The 3D view updates instantly as you change settings. Rotate and zoom to see every angle.
4. **Download and print.** Export as STL for your slicer, STEP if you want to edit in CAD, or 3MF for color and material support. Large baseplates split automatically.

> All processing happens locally. Your designs stay on your device unless you share them.

## Features

**Grid sizing.** Set the baseplate to any width and depth in standard Gridfinity grid units (42mm each). Sync with your layout to automatically match your drawer dimensions.

**Magnet holes.** Add 6mm × 2mm cavities at each grid intersection for standard neodymium magnets. Bins snap securely to the baseplate without sliding.

**Connector nubs.** Half-cell pegs at grid intersections help align bins precisely, especially useful with half-bin mode for 0.5-unit precision.

**Edge padding.** Configure padding on each side independently — left, right, front, and back. Fine-tune the fit so the baseplate sits flush in your drawer with no gaps or interference.

**Automatic split.** Baseplates larger than your print bed are automatically split into printable pieces. Download a ZIP with all pieces ready to print and assemble.

## Export Formats

| Format   | When to Use It                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------- |
| **STL**  | Send it straight to your slicer. Works with PrusaSlicer, Cura, OrcaSlicer, and everything else. |
| **STEP** | Open in Fusion 360, FreeCAD, or SolidWorks to make further edits before printing.               |
| **3MF**  | Includes color and material metadata. Good for multi-material printers.                         |

## Next Steps

Need custom bins to go with your baseplate? Use the [bin generator](/gridfinity-bin-generator) to create bins with compartments, cutouts, and label tabs. Plan your whole drawer with the [layout planner](/), or check the [sizes reference](/gridfinity-sizes) to figure out your dimensions.

[CTA: Start Generating](/baseplate?standalone=1)
