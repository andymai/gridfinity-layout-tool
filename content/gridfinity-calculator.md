---
title: Gridfinity Calculator — Drawer Size to Grid Units
description: Free Gridfinity calculator. Convert drawer measurements in millimeters to Gridfinity grid units, see leftover space, and find the tallest bin that fits. Includes baseplate and bin size math.
keywords: gridfinity calculator, gridfinity drawer calculator, gridfinity size calculator, gridfinity bin calculator, gridfinity base calculator, gridfinity grid units, gridfinity rechner, 42mm grid calculator
schema: Article
breadcrumbs:
  - name: Home
    url: https://gridfinitylayouttool.com/
  - name: Gridfinity Calculator
    url: https://gridfinitylayouttool.com/gridfinity-calculator
navCta:
  label: Open the Layout Planner
  href: /
softwareApplication:
  name: Gridfinity Calculator
  alternateName:
    - Gridfinity Drawer Calculator
    - Gridfinity Size Calculator
  description: Convert drawer measurements in millimeters to Gridfinity grid units, including half-grid sizes, leftover edge space, and maximum bin height.
  applicationCategory: UtilitiesApplication
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
    - Millimeters to Gridfinity grid units conversion
    - Half-grid (0.5 unit) sizing
    - Leftover edge space per axis
    - Maximum bin height from drawer depth
faqs:
  - q: How do I convert drawer measurements to Gridfinity units?
    a: Divide the drawer's interior width and depth in millimeters by 42 and round down. A 480 mm wide drawer fits 11 grid units (462 mm) with 18 mm left over. The calculator on this page does the math, including half-unit sizes.
  - q: What do I do with the leftover millimeters?
    a: Generate a baseplate with edge padding — the baseplate generator can distribute the leftover space to any side as a solid border, so bins still fill the drawer edge to edge. Half-bin mode can also reclaim space in 21 mm steps.
  - q: How do I calculate Gridfinity bin height?
    a: Bin heights are multiples of 7 mm, called units (a 3U bin is 21 mm of usable wall). To find the tallest bin a drawer can take, subtract about 5 mm for the baseplate from the interior height and divide by 7, rounding down.
  - q: Why 42 mm?
    a: Zack Freedman picked 42 mm as the Gridfinity base unit — big enough for useful bins, small enough for fine-grained layouts, and yes, also the answer to everything. Every Gridfinity bin and baseplate uses multiples of it, which is what makes the whole system interchangeable.
  - q: Does this calculator handle half-size bins?
    a: Yes. Half-grid mode works in 21 mm steps, so a 105 mm space fits a 2.5-unit bin. The calculator shows both the whole-unit and half-unit grid for your measurements.
---

# Gridfinity Calculator

Convert your drawer measurements to Gridfinity grid units. Enter the interior dimensions in millimeters; the calculator shows the grid size, the half-grid size, leftover edge space, and the tallest bin the drawer can take.

<div class="calc" id="gridfinity-calculator">
  <div class="calc__grid">
    <div class="calc__field">
      <label for="calc-width">Drawer width (mm)</label>
      <input type="number" id="calc-width" inputmode="decimal" min="0" placeholder="480">
    </div>
    <div class="calc__field">
      <label for="calc-depth">Drawer depth (mm)</label>
      <input type="number" id="calc-depth" inputmode="decimal" min="0" placeholder="380">
    </div>
    <div class="calc__field">
      <label for="calc-height">Drawer height (mm, optional)</label>
      <input type="number" id="calc-height" inputmode="decimal" min="0" placeholder="70">
    </div>
  </div>
  <div class="calc__results">
    <div class="calc__result">
      <span class="calc__result-value" id="calc-grid">—</span>
      <span class="calc__result-label">Grid (42 mm units)</span>
    </div>
    <div class="calc__result">
      <span class="calc__result-value" id="calc-half">—</span>
      <span class="calc__result-label">Half-grid (21 mm steps)</span>
    </div>
    <div class="calc__result">
      <span class="calc__result-value" id="calc-gap">—</span>
      <span class="calc__result-label">Leftover width / depth</span>
    </div>
  </div>
  <div class="calc__results">
    <div class="calc__result">
      <span class="calc__result-value" id="calc-height-units">—</span>
      <span class="calc__result-label">Tallest bin (after ~5 mm baseplate)</span>
    </div>
  </div>
  <p class="calc__note">Measure the drawer's interior, not the front panel. Grid units round down; the baseplate generator's edge padding absorbs the leftover millimeters.</p>
</div>
<script src="/calculator.js" defer></script>

[CTA: Plan This Drawer in the Layout Tool](/)

## The Math Behind It

Gridfinity is built on two numbers:

| Dimension       | Unit  | Rule                                                                 |
| --------------- | ----- | -------------------------------------------------------------------- |
| Width and depth | 42 mm | Grid units = floor(mm ÷ 42). Half-bin mode works in 21 mm steps.     |
| Height          | 7 mm  | Bin height = units × 7 mm, sitting on a baseplate roughly 5 mm tall. |

**Example:** a 480 × 380 × 70 mm drawer.

- Width: 480 ÷ 42 = 11.4 → **11 units** (462 mm), 18 mm left over
- Depth: 380 ÷ 42 = 9.0 → **9 units** (378 mm), 2 mm left over
- Height: (70 − 5) ÷ 7 = 9.2 → up to **9U bins**

The 18 mm of leftover width becomes edge padding on the [baseplate](/gridfinity-baseplate-generator), or a 0.5-unit column of half-bins if you'd rather store than pad.

## After the Math: Plan the Layout

Numbers tell you the grid; the [layout planner](/) tells you what goes where. Enter the same measurements there and it draws the grid for you — then you drag bins onto it, color-code them by category, preview the drawer in 3D, and export a print list with every bin size and filament estimates.

For the bins themselves, the [bin generator](/gridfinity-bin-generator) builds custom sizes with compartments, label tabs, and shaped cutouts, and the [sizes reference](/gridfinity-sizes) lists standard dimensions if you're downloading pre-made models instead.

[CTA: Open the Layout Planner](/)
