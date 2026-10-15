---
title: Gridfinity Drawer Sizes and Planner
description: Find Gridfinity drawer layouts for common drawer units, or measure any drawer to size the planner and baseplate generator.
keywords: gridfinity drawers, gridfinity drawer sizes, gridfinity drawer organizer, gridfinity ikea, gridfinity ikea drawer, gridfinity tool chest, gridfinity toolbox, gridfinity drawer planner
schema: Article
breadcrumbs:
  - name: Home
    url: https://gridfinitylayouttool.com/
  - name: Drawer Sizes
    url: https://gridfinitylayouttool.com/gridfinity-drawers
navCta:
  label: Open the planner
  href: /
faqs:
  - q: Is my drawer listed?
    a: IKEA Alex 5-drawer, IKEA Alex 9-drawer, IKEA Alex on castors, and Milwaukee Packout 3-drawer tool box are listed. For anything else, measure the drawer and use the calculator.
  - q: How do I measure a drawer for Gridfinity?
    a: Measure the inside width and depth in millimeters, not the front panel. Measure the inside height too if you want to find the tallest bin that fits.
  - q: What happens to the leftover space?
    a: Leftover width and depth become baseplate edge padding. The padding is split evenly, or you can change the padding anchor to put the spare space in one strip.
  - q: Why measure if my drawer is listed?
    a: Drawer units vary. Measure your own drawer to confirm its inside dimensions before planning bins or making a baseplate.
---

# Gridfinity Drawer Sizes

Find the Gridfinity grid for common named drawers, or measure any drawer to size the planner and baseplate generator for it. Choose a listed drawer below or enter your own inside measurements.

## Grid sizes for named drawers

These common drawers have dedicated pages with the details needed to plan a Gridfinity drawer organizer.

| Drawer                              | Grid                             | Page                                                                |
| ----------------------------------- | -------------------------------- | ------------------------------------------------------------------- |
| IKEA Alex 5-drawer (36x70 cm)       | 7 by 12                          | [IKEA Alex Gridfinity guide](/gridfinity-ikea-alex)                 |
| IKEA Alex 9-drawer (36x116 cm)      | 7 by 10                          | [IKEA Alex Gridfinity guide](/gridfinity-ikea-alex)                 |
| IKEA Alex on castors (67x66 cm)     | 10 units deep, measure the width | [IKEA Alex Gridfinity guide](/gridfinity-ikea-alex)                 |
| Milwaukee Packout 3-drawer tool box | 9 by 7                           | [Milwaukee Packout Gridfinity guide](/gridfinity-milwaukee-packout) |

Listed drawers link to their own page, where the measurements and caveats live. Measure the inside of your own drawer anyway, because units vary.

## Drawers and tool chests not listed

Anything not listed should be measured and sized with the calculator here. Husky and Harbor Freight tool chests come in many models with different drawer sizes, so there is no single grid for either brand.

Enter the drawer's inside width, depth, and optional height in millimeters in the calculator below.

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
  <div class="calc__actions">
    <a class="content-cta" href="/" data-drawer-link="planner">Plan this drawer &rarr;</a>
    <a class="calc__secondary" href="/baseplate" data-drawer-link="baseplate">Make its baseplate &rarr;</a>
  </div>
</div>
<script src="/calculator.js" defer></script>

The calculator shows the whole-unit grid, half-grid size, leftover width and depth, and the tallest bin after about 5 mm of baseplate. Select **Plan this drawer** to open the layout planner with a layout sized to those measurements, or **Make its baseplate** to open the baseplate generator at the same size. Without usable measurements, the buttons open the plain tools.

## How a Gridfinity fit works

Gridfinity uses a 42 mm grid and 7 mm height units. The calculator fits as many whole 42 mm units as possible inside the measured width and depth.

Any leftover millimeters become baseplate edge padding. By default, that padding is split evenly between the two sides and between the front and back. Change the padding anchor when you want the bins moved to one side, with the spare space kept in one strip.

The baseplate generator automatically splits the baseplate into pieces that fit your print bed.

Measure the drawer's inside surfaces, not its front panel. Add the inside height when you want the calculator to show how tall a bin can be while allowing about 5 mm for the baseplate. Magnet holes in the baseplate raise bins by about 2.5 mm. That extra height can cost one full height unit, so include it when checking clearance.

## More Gridfinity guides

- [Plan Gridfinity for kitchen drawers](/gridfinity-kitchen-drawer)
- [Plan Gridfinity for tool drawers](/gridfinity-tool-drawer)
- [Use the full Gridfinity calculator and see the math](/gridfinity-calculator)
- [Check Gridfinity dimensions](/gridfinity-sizes)
- [Learn what Gridfinity is](/what-is-gridfinity)
