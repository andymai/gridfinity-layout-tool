# Inspiration Layouts Development Guide

This document provides guidelines for creating and maintaining inspiration layouts for the Gridfinity Layout Tool.

## Current Layouts (12 total)

- **Kitchen (3):** Cutlery Drawer, Cooking Utensils, Knife Drawer
- **Workshop (4):** Screw Organizer, Hand Tools, Electronics Bench, Socket Organizer
- **Office (2):** Desk Drawer, Cable Drawer
- **Hobby (3):** 3D Printing Supplies, Craft Supplies, Sewing Kit

## Grid Unit Reference

- **1 grid unit = 42mm**
- Common conversions:
  - 2 units = 84mm
  - 3 units = 126mm
  - 4 units = 168mm
  - 5 units = 210mm
  - 6 units = 252mm
  - 7 units = 294mm
  - 8 units = 336mm
  - 9 units = 378mm
  - 10 units = 420mm

## Bin Evaluation Checklist

For EACH bin in EACH layout, verify:

### 1. Real-World Dimensions
- What is the **actual size in millimeters** of this item?
- Bin size in mm = `width × 42mm` by `depth × 42mm`
- Does the item **physically fit** with clearance for fingers?
- For elongated items: Is the bin's **longest dimension** ≥ item length?

### 2. Shape Appropriateness
- **Square items** (jars, small containers) → square bins
- **Elongated items** (knives, scissors, rulers) → rectangular bins with length along depth
- **Round items** (spools, jars) → bin should fit diameter + ~20mm clearance

### 3. Common Sense Check
- Would a real person store this item this way?
- Is this item commonly stored in this type of drawer?
- Are there better alternatives?

### 4. Label Fit
- Labels render in thumbnails - keep them SHORT (1-2 words ideal)
- Bad: "Rubber Bands" → Good: "Bands"
- Bad: "Phillips Head Screwdrivers" → Good: "Phillips"

### 5. Category Coherence
- Does this item belong in this category?
- Are all items in a category logically related?

## Common Item Dimensions Reference

### Kitchen

| Item | Typical Length | Minimum Bin Depth |
|------|---------------|-------------------|
| Dinner fork | 190-200mm | 5 units (210mm) |
| Dinner knife | 220-240mm | 6 units (252mm) |
| Tablespoon | 180-200mm | 5 units (210mm) |
| Teaspoon | 140-160mm | 4 units (168mm) |
| Chef's knife (with handle) | 320-380mm | 9 units (378mm) |
| Bread knife | 350-400mm | 9-10 units |
| Santoku knife | 280-320mm | 7-8 units |
| Paring knife | 180-220mm | 5-6 units |
| Honing steel | 300-380mm | 8-9 units |
| Serving spoon | 250-350mm | 7-8 units |
| Ladle | 300-400mm | 8-10 units |
| Spatula | 250-350mm | 6-8 units |
| Wooden spoon | 250-350mm | 6-8 units |
| Peeler | 150-180mm | 4-5 units |
| Spice jar diameter | 50-60mm | 2 units (84mm) |

### Office

| Item | Typical Length | Minimum Bin Depth |
|------|---------------|-------------------|
| Pen/pencil | 140-160mm | 4 units (168mm) |
| Marker | 130-150mm | 4 units (168mm) |
| Office scissors | 180-200mm | 5 units (210mm) |
| 6" ruler | 160mm | 4 units (168mm) |
| 12" ruler | 310mm | 8 units (336mm) |
| Letter opener | 180-220mm | 5-6 units |
| #10 envelope | 241mm × 105mm | 6 units × 3 units |
| Stapler | 150-180mm | 4-5 units |
| Tape dispenser | 100-150mm | 3-4 units |

### Workshop

| Item | Typical Length | Minimum Bin Depth |
|------|---------------|-------------------|
| Needle nose pliers | 150-200mm | 5 units (210mm) |
| Diagonal cutters | 120-180mm | 4-5 units |
| Standard screwdriver | 200-250mm | 6 units (252mm) |
| Adjustable wrench 6" | 150mm | 4 units |
| Adjustable wrench 8" | 200mm | 5 units |
| Adjustable wrench 10" | 250mm | 6 units |
| Tape measure (body) | 70-90mm | 2-3 units |
| Allen key set | 80-150mm | 3-4 units |
| Tweezers | 100-150mm | 3-4 units |
| Flush cutters | 100-130mm | 3 units |

### Craft/Hobby

| Item | Typical Length | Minimum Bin Depth |
|------|---------------|-------------------|
| Craft scissors | 180-220mm | 5-6 units |
| Sewing shears | 200-250mm | 5-6 units |
| X-Acto knife | 140-160mm | 4 units |
| Paintbrush | 150-300mm | 4-7 units |
| Pencil/charcoal | 170-190mm | 5 units |
| Thread spool diameter | 50-70mm | 1.5-2 units |
| Glue stick | 80-120mm | 3 units |

## Common Pitfalls

### 1. Serving Utensils Are LONGER Than Regular Cutlery
```
BAD:  Forks 2x5, Serving Spoons 2x3  (serving spoons shorter?!)
GOOD: Forks 2x5, Serving Spoons 2x7  (serving spoons are longer)
```

### 2. Scissors Need Long Bins
```
BAD:  Scissors in 2x2 bin (84mm - way too short!)
GOOD: Scissors in 2x5 bin (210mm - fits 180-200mm scissors)
```

### 3. Screwdrivers Are Longer Than You Think
```
BAD:  Screwdrivers in 3x4 bin (168mm depth)
GOOD: Screwdrivers in 2x6 bin (252mm depth)
```

### 4. Don't Put Long Items in Square Bins
If an item is clearly elongated (knives, scissors, rulers, screwdrivers), it needs a rectangular bin with the long dimension matching the item's length.

### 5. Verify Drawer Depth Is Realistic
- Kitchen drawer: typically 400-500mm deep (10-12 units)
- Desk drawer: typically 300-400mm deep (7-10 units)
- Tool chest drawer: varies widely

## Layout Structure

Each layout is created by a function returning `InspirationLayout`:

```typescript
function createMyLayout(): InspirationLayout {
  const categories = [
    createCategory('Category Name', '#hexcolor'),
    // ...
  ];
  const layer = createLayer('Layer 1', 3); // name, default height

  const bins = [
    // createBin(x, y, width, depth, options)
    createBin(0, 0, 2, 5, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Item Name',
      height: 6, // optional, overrides layer default
    }),
    // ...
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Layout Name',
    drawer: { width: 8, depth: 10, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'unique-slug-id',
    name: 'Layout Name',
    theme: 'kitchen', // kitchen | workshop | office | hobby
    description: 'Detailed description for the preview overlay.',
    shortDescription: 'Brief tagline for the card',
    complexity: 'beginner', // beginner | intermediate | advanced
    tags: ['tag1', 'tag2'],
  });
}
```

## Coordinate System

- Origin (0,0) is **bottom-left** of the drawer
- `x` increases to the right
- `y` increases upward (toward back of drawer)
- `width` is horizontal (left-right)
- `depth` is vertical in top-down view (front-back)

## Adding a New Layout

1. Create the function in `inspirationLayouts.ts`
2. Add it to the `INSPIRATION_LAYOUTS` array export
3. Run `npm run build` to verify no errors
4. Visually inspect the thumbnail in the app
5. Use the evaluation checklist on EVERY bin

## Testing Changes

```bash
npm run build        # Verify TypeScript compiles
npm run test:run     # Run unit tests
npm run dev          # Visual inspection in browser
```
