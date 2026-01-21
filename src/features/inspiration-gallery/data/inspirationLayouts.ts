import type { Layout } from '@/core/types';
import type { InspirationLayout, InspirationTheme } from '../types';
import {
  createBin,
  createLayer,
  createCategory,
  buildInspirationLayout,
} from '../utils/layoutBuilder';

// ============================================================
// KITCHEN LAYOUTS (3 layouts)
// ============================================================

function createCutleryDrawer(): InspirationLayout {
  // Standard kitchen cutlery drawer: ~450mm wide x 400mm deep (11x10 units)
  const categories = [
    createCategory('Silverware', '#94a3b8'),
    createCategory('Small', '#38bdf8'),
  ];
  // Height 5 (35mm) for stacked flatware - fits 12-17 pieces per slot
  // (single fork/spoon ~2-3mm thick, households typically have 8-12+ of each)
  const layer = createLayer('Layer 1', 5);

  // Real cutlery dimensions:
  // - Dinner fork: ~200mm, dinner knife: ~230mm, tablespoon: ~200mm → 6 units (252mm)
  // - Teaspoon: ~150mm, dessert fork/spoon: ~170mm → 4 units (168mm)
  const bins = [
    // Main cutlery - 6 units deep for dinner utensils
    createBin(0, 0, 2, 6, { layerId: layer.id, categoryId: categories[0].id, label: 'Forks' }),
    createBin(2, 0, 2, 6, { layerId: layer.id, categoryId: categories[0].id, label: 'Knives' }),
    createBin(4, 0, 2, 6, { layerId: layer.id, categoryId: categories[0].id, label: 'Spoons' }),
    createBin(6, 0, 2, 6, { layerId: layer.id, categoryId: categories[0].id, label: 'Steak' }),
    createBin(8, 0, 3, 6, { layerId: layer.id, categoryId: categories[0].id, label: 'Serving' }),
    // Smaller utensils - 4 units deep
    createBin(0, 6, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Teaspoons' }),
    createBin(2, 6, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Dessert' }),
    createBin(4, 6, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Butter' }),
    createBin(6, 6, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Cocktail' }),
    createBin(8, 6, 3, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Misc' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Cutlery Drawer',
    // Standard 18" (457mm) cabinet drawer: ~420mm usable width, ~400mm depth
    drawer: { width: 11, depth: 10, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'cutlery-drawer',
    name: 'Cutlery Drawer',
    theme: 'kitchen',
    description:
      'Silverware organization with main slots sized for dinner cutlery and smaller slots for teaspoons and dessert pieces.',
    shortDescription: 'Forks, knives, spoons, and dessert cutlery',
    complexity: 'beginner',
    tags: ['kitchen', 'cutlery', 'silverware', 'simple'],
  });
}

function createCookingUtensils(): InspirationLayout {
  // Standard 24" (610mm) cabinet drawer: ~550mm wide x 450mm deep (13x11 units)
  const categories = [
    createCategory('Long Tools', '#4ade80'),
    createCategory('Medium Tools', '#38bdf8'),
    createCategory('Small Tools', '#fbbf24'),
  ];
  // Height 5 (35mm) for spatula/ladle handles that are 25-40mm thick
  const layer = createLayer('Layer 1', 5);

  // Utensils stored across width (wider drawer accommodates long tools)
  // - Ladles/spoons: 300-350mm → 8 units
  // - Spatulas/whisks: 250-300mm → 7 units
  // - Small tools: 150-200mm → 4-5 units
  const bins = [
    // Long tools row - 8 units wide
    createBin(0, 0, 8, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Ladles' }),
    createBin(0, 2, 8, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Wooden Spoons' }),
    // Medium tools row - 7 units wide
    createBin(0, 4, 7, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Spatulas' }),
    createBin(7, 4, 6, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Whisks' }),
    createBin(0, 6, 7, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Tongs' }),
    createBin(7, 6, 6, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Turners' }),
    // Small tools row
    createBin(0, 8, 4, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Peelers' }),
    createBin(4, 8, 4, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Openers' }),
    createBin(8, 0, 5, 4, { layerId: layer.id, categoryId: categories[2].id, label: 'Gadgets' }),
    createBin(8, 8, 5, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Misc' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Cooking Utensils',
    // 24" cabinet drawer
    drawer: { width: 13, depth: 11, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'cooking-utensils',
    name: 'Cooking Utensils',
    theme: 'kitchen',
    description:
      'Long cooking tools stored horizontally, organized by type and size. Fits ladles, spatulas, and tongs.',
    shortDescription: 'Spatulas, ladles, whisks, and tongs',
    complexity: 'beginner',
    tags: ['kitchen', 'utensils', 'cooking'],
  });
}

function createKnifeDrawer(): InspirationLayout {
  // Standard 15" (381mm) cabinet drawer: ~350mm wide x 400mm deep (8x10 units)
  // Knives stored horizontally across width for realistic drawer depth
  const categories = [
    createCategory('Large Knives', '#334155'),
    createCategory('Small Knives', '#64748b'),
    createCategory('Accessories', '#f87171'),
  ];
  const layer = createLayer('Layer 1', 6);

  // Real knife dimensions - stored horizontally across width
  // Most kitchen knives 200-350mm, stored diagonally or with handles overhanging slightly
  // Kitchen shears: 200-250mm → 5 units (210mm)
  const bins = [
    // Large knives - 6 units wide to leave room for shears column
    createBin(0, 0, 6, 2, { layerId: layer.id, categoryId: categories[0].id, label: "Chef's Knife" }),
    createBin(0, 2, 6, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Bread Knife' }),
    createBin(0, 4, 6, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Carving Knife' }),
    // Kitchen shears - 5 units deep (210mm) for 200mm shears
    createBin(6, 0, 2, 5, { layerId: layer.id, categoryId: categories[2].id, label: 'Shears' }),
    // Small accessories
    createBin(6, 5, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Peeler' }),
    // Medium knives
    createBin(0, 6, 4, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Santoku' }),
    createBin(4, 6, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Utility' }),
    // Small knives - bottom row
    createBin(0, 8, 4, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Paring' }),
    createBin(4, 8, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Sharpener' }),
    createBin(6, 7, 2, 3, { layerId: layer.id, categoryId: categories[1].id, label: 'Steak' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Knife Drawer',
    // 15" cabinet drawer
    drawer: { width: 8, depth: 10, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'knife-drawer',
    name: 'Knife Drawer',
    theme: 'kitchen',
    description:
      'Horizontal knife storage with dedicated slots for each knife to protect blades and keep them accessible.',
    shortDescription: 'Safe storage for kitchen knives',
    complexity: 'beginner',
    tags: ['kitchen', 'knives', 'safety', 'labeled'],
  });
}

// ============================================================
// WORKSHOP LAYOUTS (4 layouts) - Screw Organizer, Hand Tools, Electronics Bench, Socket Organizer
// ============================================================

function createScrewOrganizer(): InspirationLayout {
  // IKEA Alex drawer: 297×525mm internal = 7×12 gridfinity units
  const categories = [
    createCategory('Small Screws', '#38bdf8'),
    createCategory('Medium Screws', '#4ade80'),
    createCategory('Large Screws', '#fbbf24'),
    createCategory('Nuts & Washers', '#e2e8f0'),
  ];
  const layer = createLayer('Layer 1', 3);

  const bins = [
    // Rows 1-2: Small screws (1x1 bins) - M2 and M3 sizes
    ...Array.from({ length: 7 }, (_, i) =>
      createBin(i, 0, 1, 1, {
        layerId: layer.id,
        categoryId: categories[0].id,
        label: ['M2x4', 'M2x6', 'M2x8', 'M2x10', 'M3x6', 'M3x8', 'M3x10'][i],
      })
    ),
    ...Array.from({ length: 7 }, (_, i) =>
      createBin(i, 1, 1, 1, {
        layerId: layer.id,
        categoryId: categories[0].id,
        label: ['M3x12', 'M3x16', 'M3x20', 'M4x8', 'M4x10', 'M4x12', 'M4x16'][i],
      })
    ),
    // Rows 3-4: More M4 screws and start of M5
    ...Array.from({ length: 7 }, (_, i) =>
      createBin(i, 2, 1, 1, {
        layerId: layer.id,
        categoryId: categories[0].id,
        label: ['M4x20', 'M4x25', 'M4x30', 'M5x8', 'M5x10', 'M5x12', 'M5x16'][i],
      })
    ),
    // Rows 4-5: Medium screws (1.5x1.5 bins) - M5 longer and M6
    ...Array.from({ length: 4 }, (_, i) =>
      createBin(i * 1.5 + 0.5, 3, 1.5, 1.5, {
        layerId: layer.id,
        categoryId: categories[1].id,
        label: ['M5x20', 'M5x25', 'M5x30', 'M5x40'][i],
      })
    ),
    ...Array.from({ length: 4 }, (_, i) =>
      createBin(i * 1.5 + 0.5, 4.5, 1.5, 1.5, {
        layerId: layer.id,
        categoryId: categories[1].id,
        label: ['M6x10', 'M6x16', 'M6x20', 'M6x25'][i],
      })
    ),
    // Rows 6-8: Large screws (2x2 bins)
    createBin(0, 6, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'M6x30+' }),
    createBin(2, 6, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'M8 Short' }),
    createBin(4, 6, 3, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'M8 Long' }),
    createBin(0, 8, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'M10' }),
    createBin(2, 8, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Wood Screws' }),
    // Rows 9-12: Nuts, washers, and hardware
    createBin(4, 8, 3, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Hex Nuts' }),
    createBin(0, 10, 2, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Washers' }),
    createBin(2, 10, 2, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Lock Nuts' }),
    createBin(4, 10, 2, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Standoffs' }),
    createBin(6, 10, 1, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Misc' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Screw Organizer',
    // Full IKEA Alex drawer dimensions: 297×525mm = 7×12 units
    drawer: { width: 7, depth: 12, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'screw-organizer',
    name: 'Screw Organizer',
    theme: 'workshop',
    description:
      'Metric fastener organization with small bins for M2-M4, medium for M5-M6, and large bins for nuts and washers. Uses half-bin increments.',
    shortDescription: 'Sort screws by size with half-bin divisions',
    complexity: 'intermediate',
    tags: ['workshop', 'screws', 'fasteners', 'half-bins', 'ikea-alex'],
  });
}

function createToolDrawer(): InspirationLayout {
  // Harbor Freight US General 44" tool chest drawer: 568×490mm = 13×11 units
  const categories = [
    createCategory('Pliers', '#f87171'),
    createCategory('Screwdrivers', '#38bdf8'),
    createCategory('Wrenches', '#fbbf24'),
    createCategory('Other', '#e2e8f0'),
  ];
  // Height 5 (35mm) for pliers that are 25-40mm thick when closed
  const layer = createLayer('Layer 1', 5);

  // Real tool dimensions:
  // - Pliers: 150-200mm → 5 units (210mm)
  // - Screwdrivers: 200-300mm → 6-7 units (252-294mm)
  // - Adjustable wrench 8": 200mm, 10": 250mm → 6 units
  // - Combination wrenches: 150-300mm depending on size
  const bins = [
    // Row 1: Pliers section - 5 units deep (210mm) for 150-200mm pliers
    createBin(0, 0, 2, 5, { layerId: layer.id, categoryId: categories[0].id, label: 'Needle Nose' }),
    createBin(2, 0, 2, 5, { layerId: layer.id, categoryId: categories[0].id, label: 'Diagonal Cut' }),
    createBin(4, 0, 2, 5, { layerId: layer.id, categoryId: categories[0].id, label: 'Linesman' }),
    createBin(6, 0, 2, 5, { layerId: layer.id, categoryId: categories[0].id, label: 'Slip Joint' }),
    createBin(8, 0, 2, 5, { layerId: layer.id, categoryId: categories[0].id, label: 'Locking' }),
    createBin(10, 0, 3, 5, { layerId: layer.id, categoryId: categories[0].id, label: 'Channel Lock' }),
    // Row 2: Screwdrivers - 6 units deep (252mm) for standard screwdrivers
    createBin(0, 5, 2, 6, { layerId: layer.id, categoryId: categories[1].id, label: 'Phillips' }),
    createBin(2, 5, 2, 6, { layerId: layer.id, categoryId: categories[1].id, label: 'Flathead' }),
    createBin(4, 5, 2, 6, { layerId: layer.id, categoryId: categories[1].id, label: 'Torx' }),
    createBin(6, 5, 2, 6, { layerId: layer.id, categoryId: categories[1].id, label: 'Hex' }),
    // Wrenches section - right side
    createBin(8, 5, 2, 6, { layerId: layer.id, categoryId: categories[2].id, label: 'Adjustable' }),
    createBin(10, 5, 3, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Allen Keys' }),
    createBin(10, 8, 3, 3, { layerId: layer.id, categoryId: categories[3].id, label: 'Tape/Level' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Hand Tools',
    // Harbor Freight US General 44" tool chest drawer: 568×490mm = 13×11 units
    drawer: { width: 13, depth: 11, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'hand-tools',
    name: 'Hand Tools',
    theme: 'workshop',
    description:
      'Tool chest layout with dedicated sections for pliers, screwdrivers, wrenches, and allen keys. Bins sized for real tool dimensions.',
    shortDescription: 'Pliers, screwdrivers, and wrenches organized',
    complexity: 'beginner',
    tags: ['workshop', 'tools', 'pliers', 'screwdrivers', 'tool-chest'],
  });
}

function createElectronicsBench(): InspirationLayout {
  // IKEA Alex drawer: 297×525mm = 7×12 gridfinity units
  const categories = [
    createCategory('Components', '#38bdf8'),
    createCategory('Tools', '#4ade80'),
    createCategory('Supplies', '#fbbf24'),
  ];
  // Height 6 (42mm) for solder spools (~50-60mm) and wire spools (~40-70mm)
  // Small component bins just won't use full height, which is fine
  const layer = createLayer('Layer 1', 6);

  // Component bins: 1x1 or 2x2 for small parts
  // Tools: Tweezers 100-150mm → 3-4 units, Flush cutters 100-130mm → 3 units
  // Solder/wire spools: 2x2 or 3x3 bins
  const bins = [
    // Top section: Small components (rows 0-3)
    createBin(0, 0, 1, 1, { layerId: layer.id, categoryId: categories[0].id, label: 'R 1K' }),
    createBin(1, 0, 1, 1, { layerId: layer.id, categoryId: categories[0].id, label: 'R 10K' }),
    createBin(2, 0, 1, 1, { layerId: layer.id, categoryId: categories[0].id, label: 'R 100K' }),
    createBin(3, 0, 1, 1, { layerId: layer.id, categoryId: categories[0].id, label: 'R Misc' }),
    createBin(4, 0, 1, 1, { layerId: layer.id, categoryId: categories[0].id, label: 'C 0.1µF' }),
    createBin(5, 0, 1, 1, { layerId: layer.id, categoryId: categories[0].id, label: 'C 10µF' }),
    createBin(6, 0, 1, 1, { layerId: layer.id, categoryId: categories[0].id, label: 'C 100µF' }),
    createBin(0, 1, 1, 1, { layerId: layer.id, categoryId: categories[0].id, label: 'LEDs Red' }),
    createBin(1, 1, 1, 1, { layerId: layer.id, categoryId: categories[0].id, label: 'LEDs Grn' }),
    createBin(2, 1, 1, 1, { layerId: layer.id, categoryId: categories[0].id, label: 'LEDs Blu' }),
    createBin(3, 1, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Transistors' }),
    createBin(5, 1, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'ICs' }),
    createBin(0, 2, 3, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Headers' }),
    // Middle section: Tools (rows 4-7)
    createBin(0, 4, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Tweezers' }),
    createBin(2, 4, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Cutters' }),
    createBin(4, 3, 3, 3, { layerId: layer.id, categoryId: categories[0].id, label: 'Connectors' }),
    createBin(4, 6, 3, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Multimeter' }),
    // Bottom section: Supplies (rows 8-11)
    createBin(0, 8, 2, 4, { layerId: layer.id, categoryId: categories[2].id, label: 'Solder' }),
    createBin(2, 8, 3, 4, { layerId: layer.id, categoryId: categories[2].id, label: 'Wire Spools' }),
    createBin(5, 8, 2, 4, { layerId: layer.id, categoryId: categories[2].id, label: 'Heat Shrink' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Electronics Bench',
    // IKEA Alex drawer: 297×525mm = 7×12 units
    drawer: { width: 7, depth: 12, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'electronics-bench',
    name: 'Electronics Bench',
    theme: 'workshop',
    description:
      'Small bins for resistors, capacitors, and LEDs. Tool slots for tweezers and cutters. Larger bins for wire and solder.',
    shortDescription: 'Components, tools, and supplies',
    complexity: 'intermediate',
    tags: ['workshop', 'electronics', 'soldering', 'components', 'ikea-alex'],
  });
}

function createSocketOrganizer(): InspirationLayout {
  const categories = [
    createCategory('Sockets', '#38bdf8'),
    createCategory('Ratchets', '#f87171'),
    createCategory('Accessories', '#4ade80'),
  ];
  // Height 6 (42mm) for shallow sockets (25-30mm) standing upright
  const layer = createLayer('Layer 1', 6);

  // Simplified socket organizer - group sockets by drive size
  // Most socket sets come with 8-12 sockets per drive size
  // A 3x2 bin (126mm x 84mm) can hold ~6-8 sockets standing upright
  const bins = [
    // Socket bins - grouped by drive size
    createBin(0, 0, 3, 2, { layerId: layer.id, categoryId: categories[0].id, label: '1/4" Metric' }),
    createBin(3, 0, 3, 2, { layerId: layer.id, categoryId: categories[0].id, label: '3/8" Metric' }),
    createBin(0, 2, 3, 2, { layerId: layer.id, categoryId: categories[0].id, label: '3/8" Deep' }),
    createBin(3, 2, 3, 2, { layerId: layer.id, categoryId: categories[0].id, label: '1/2" Metric' }),
    // Ratchets - 6 units deep (252mm) for 200-250mm ratchets
    createBin(0, 4, 2, 6, { layerId: layer.id, categoryId: categories[1].id, label: '1/4" Ratchet' }),
    createBin(2, 4, 2, 6, { layerId: layer.id, categoryId: categories[1].id, label: '3/8" Ratchet' }),
    createBin(4, 4, 2, 6, { layerId: layer.id, categoryId: categories[1].id, label: '1/2" Ratchet' }),
    // Accessories - extensions, adapters
    createBin(6, 0, 2, 4, { layerId: layer.id, categoryId: categories[2].id, label: 'Extensions' }),
    createBin(6, 4, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Adapters' }),
    createBin(6, 7, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Spark Plugs' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Socket Organizer',
    drawer: { width: 8, depth: 10, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'socket-organizer',
    name: 'Socket Organizer',
    theme: 'workshop',
    description:
      'Metric sockets grouped by drive size (1/4", 3/8", 1/2") with dedicated slots for ratchets and extensions.',
    shortDescription: 'Socket sets with ratchets and extensions',
    complexity: 'beginner',
    tags: ['workshop', 'sockets', 'automotive', 'mechanic'],
  });
}

// ============================================================
// OFFICE LAYOUTS (2 layouts)
// ============================================================

function createDeskDrawer(): InspirationLayout {
  // IKEA Alex drawer: 297×525mm = 7×12 gridfinity units
  const categories = [
    createCategory('Writing', '#38bdf8'),
    createCategory('Clips', '#fbbf24'),
    createCategory('Other', '#e2e8f0'),
  ];
  // Height 4 (28mm) for piled pens/pencils (~8mm diameter each, pile of 10+ = 25-30mm)
  const layer = createLayer('Layer 1', 4);

  // Real dimensions:
  // - Pens/pencils: ~150mm → 4 units (168mm)
  // - Markers: ~140mm → 4 units
  // - Office scissors: 180-200mm → 5 units (210mm)
  // - Ruler (15cm): 150mm → 4 units, (30cm): 300mm → 8 units
  // - Stapler: ~150mm → 4 units
  const bins = [
    // Top section: Writing instruments - 4 units deep (168mm) for ~150mm pens/pencils
    createBin(0, 0, 2, 4, { layerId: layer.id, categoryId: categories[0].id, label: 'Pens' }),
    createBin(2, 0, 2, 4, { layerId: layer.id, categoryId: categories[0].id, label: 'Pencils' }),
    createBin(4, 0, 3, 4, { layerId: layer.id, categoryId: categories[0].id, label: 'Markers' }),
    // Middle section: Larger tools - 5 units deep (210mm)
    createBin(0, 4, 2, 5, { layerId: layer.id, categoryId: categories[2].id, label: 'Scissors' }),
    createBin(2, 4, 2, 5, { layerId: layer.id, categoryId: categories[2].id, label: 'Letter Opener' }),
    createBin(4, 4, 3, 4, { layerId: layer.id, categoryId: categories[2].id, label: 'Stapler' }),
    // Small supplies row
    createBin(0, 9, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Clips' }),
    createBin(1, 9, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Pins' }),
    createBin(2, 9, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Bands' }),
    createBin(3, 9, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Staples' }),
    createBin(4, 8, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Tacks' }),
    createBin(5, 8, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Erasers' }),
    createBin(6, 8, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Sharpener' }),
    // Bottom section: Larger items
    createBin(0, 10, 4, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Tape & Glue' }),
    createBin(4, 9, 3, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Sticky Notes' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Desk Drawer',
    // IKEA Alex drawer: 297×525mm = 7×12 units
    drawer: { width: 7, depth: 12, height: 9 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'desk-drawer',
    name: 'Desk Drawer',
    theme: 'office',
    description:
      'Sections for pens, pencils, and markers. Small bins for clips, pins, and rubber bands. Larger slots for scissors and tape.',
    shortDescription: 'Pens, clips, and desk essentials',
    complexity: 'beginner',
    tags: ['office', 'desk', 'pens', 'supplies', 'ikea-alex'],
  });
}

function createCableDrawer(): InspirationLayout {
  const categories = [
    createCategory('USB', '#38bdf8'),
    createCategory('Power', '#fbbf24'),
    createCategory('Audio/Video', '#4ade80'),
    createCategory('Adapters', '#e2e8f0'),
  ];
  const layer = createLayer('Layer 1', 6);

  const bins = [
    // USB cables (various lengths)
    createBin(0, 0, 3, 3, { layerId: layer.id, categoryId: categories[0].id, label: 'USB-C', height: 6 }),
    createBin(3, 0, 3, 3, { layerId: layer.id, categoryId: categories[0].id, label: 'Lightning', height: 6 }),
    createBin(6, 0, 3, 3, { layerId: layer.id, categoryId: categories[0].id, label: 'Micro USB', height: 6 }),
    // Power cables
    createBin(0, 3, 4, 3, { layerId: layer.id, categoryId: categories[1].id, label: 'Power Cables', height: 6 }),
    createBin(4, 3, 3, 3, { layerId: layer.id, categoryId: categories[1].id, label: 'Extension', height: 6 }),
    // Audio/Video
    createBin(7, 3, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'HDMI', height: 6 }),
    // Adapters
    createBin(0, 6, 2, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'USB Hubs' }),
    createBin(2, 6, 2, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Dongles' }),
    createBin(4, 6, 2, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Chargers' }),
    createBin(6, 6, 3, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Adapters' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Cable Drawer',
    drawer: { width: 9, depth: 8, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'cable-drawer',
    name: 'Cable Drawer',
    theme: 'office',
    description:
      'Charging cables organized by type (USB-C, Lightning, Micro). Separate sections for power cables, adapters, and dongles.',
    shortDescription: 'Charging cables, cords, and adapters',
    complexity: 'intermediate',
    tags: ['office', 'cables', 'charging', 'tech'],
  });
}

// ============================================================
// HOBBY LAYOUTS (3 layouts) - 3D Printing, Craft Supplies, Sewing Kit
// ============================================================

function create3DPrintingSupplies(): InspirationLayout {
  // IKEA Alex drawer: 297×525mm = 7×12 gridfinity units
  const categories = [
    createCategory('Filament', '#f87171'),
    createCategory('Hardware', '#38bdf8'),
    createCategory('Tools', '#4ade80'),
    createCategory('Finishing', '#fbbf24'),
  ];
  const layer = createLayer('Layer 1', 6);

  // Based on telemetry: heat_insert, magnet, bearing, filament_sample are most tracked
  const bins = [
    // Filament samples - top section
    createBin(0, 0, 2, 3, { layerId: layer.id, categoryId: categories[0].id, label: 'PLA', height: 6 }),
    createBin(2, 0, 2, 3, { layerId: layer.id, categoryId: categories[0].id, label: 'PETG', height: 6 }),
    createBin(4, 0, 2, 3, { layerId: layer.id, categoryId: categories[0].id, label: 'TPU', height: 6 }),
    createBin(6, 0, 1, 3, { layerId: layer.id, categoryId: categories[0].id, label: 'ABS', height: 6 }),
    // Hardware - most popular per telemetry (heat inserts, magnets, bearings)
    createBin(0, 3, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'M3 Inserts' }),
    createBin(2, 3, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'M4 Inserts' }),
    createBin(4, 3, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'M5 Inserts' }),
    createBin(6, 3, 1, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Misc' }),
    createBin(0, 5, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: '6x3 Magnets' }),
    createBin(2, 5, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: '8x3 Magnets' }),
    createBin(4, 5, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: '608 Bearings' }),
    createBin(6, 5, 1, 2, { layerId: layer.id, categoryId: categories[1].id, label: '625' }),
    // Tools
    createBin(0, 7, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Scrapers' }),
    createBin(2, 7, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Tweezers' }),
    createBin(4, 7, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Nozzles' }),
    // Finishing supplies - glue very popular per telemetry
    createBin(4, 9, 3, 3, { layerId: layer.id, categoryId: categories[3].id, label: 'CA Glue' }),
    createBin(0, 10, 2, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Sandpaper' }),
    createBin(2, 10, 2, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Primer' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: '3D Printing Supplies',
    // IKEA Alex drawer
    drawer: { width: 7, depth: 12, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: '3d-printing-supplies',
    name: '3D Printing Supplies',
    theme: 'hobby',
    description:
      'Heat inserts sorted by size (M3-M5), magnets, 608/625 bearings, and filament samples. Includes nozzles and finishing supplies.',
    shortDescription: 'Heat inserts, magnets, bearings, and filament',
    complexity: 'intermediate',
    tags: ['hobby', '3d-printing', 'filament', 'maker', 'ikea-alex'],
  });
}

function createCraftSupplies(): InspirationLayout {
  const categories = [
    createCategory('Adhesives', '#f87171'),
    createCategory('Cutting', '#38bdf8'),
    createCategory('Misc', '#e2e8f0'),
  ];
  const layer = createLayer('Layer 1', 3);

  const bins = [
    // Adhesives - top row
    createBin(0, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Glue Sticks' }),
    createBin(2, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Super Glue' }),
    createBin(4, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Tape' }),
    // Small items
    createBin(0, 2, 1, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'Pins' }),
    createBin(1, 2, 1, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'Needles' }),
    createBin(2, 2, 1, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'Buttons' }),
    createBin(3, 2, 1, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'Beads' }),
    createBin(4, 2, 2, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'Thimbles' }),
    // Cutting tools - bottom section
    createBin(0, 3, 2, 5, { layerId: layer.id, categoryId: categories[1].id, label: 'Scissors' }),
    createBin(2, 3, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'X-Acto' }),
    createBin(4, 3, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Box Cutter' }),
    createBin(2, 7, 4, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'Ruler' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Craft Supplies',
    drawer: { width: 6, depth: 8, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'craft-supplies',
    name: 'Craft Supplies',
    theme: 'hobby',
    description:
      'Adhesives, cutting tools, and small notions. Dedicated slots sized for scissors, X-Acto knives, and glue bottles.',
    shortDescription: 'Adhesives, cutting tools, and notions',
    complexity: 'intermediate',
    tags: ['hobby', 'craft', 'sewing', 'diy'],
  });
}

function createSewingKit(): InspirationLayout {
  const categories = [
    createCategory('Thread', '#f87171'),
    createCategory('Needles', '#38bdf8'),
    createCategory('Notions', '#4ade80'),
    createCategory('Tools', '#e2e8f0'),
  ];
  // Height 5 (35mm) for standard thread spools (35-40mm diameter)
  const layer = createLayer('Layer 1', 5);

  // Uses half-bins for small sewing notions
  const bins = [
    // Thread spools (small bins in 4x2 grid)
    ...Array.from({ length: 8 }, (_, i) =>
      createBin((i % 4) * 1.5, Math.floor(i / 4) * 1.5, 1.5, 1.5, {
        layerId: layer.id,
        categoryId: categories[0].id,
        label: ['White', 'Black', 'Red', 'Blue', 'Green', 'Yellow', 'Gray', 'Brown'][i],
      })
    ),
    // Tools (sewing shears are ~200mm, need 5-unit depth)
    createBin(6, 0, 2, 5, { layerId: layer.id, categoryId: categories[3].id, label: 'Shears' }),
    // Needles and pins (below thread spools)
    createBin(0, 3, 1.5, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Needles' }),
    createBin(1.5, 3, 1.5, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Pins' }),
    // Notions
    createBin(3, 3, 1.5, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Buttons' }),
    createBin(4.5, 3, 1.5, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Hooks' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Sewing Kit',
    drawer: { width: 8, depth: 5, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'sewing-kit',
    name: 'Sewing Kit',
    theme: 'hobby',
    description:
      'Half-bin compartments for thread spools organized by color. Includes slots for needles, pins, buttons, and shears.',
    shortDescription: 'Thread, needles, and sewing notions',
    complexity: 'advanced',
    tags: ['hobby', 'sewing', 'thread', 'half-bins'],
  });
}

// ============================================================
// PERSONAL LAYOUTS (2 layouts) - Bathroom/Makeup, Nightstand
// ============================================================

function createBathroomMakeup(): InspirationLayout {
  const categories = [
    createCategory('Brushes', '#f472b6'),
    createCategory('Makeup', '#c084fc'),
    createCategory('Small Items', '#94a3b8'),
  ];
  // Height 5 (35mm) for mascara tubes (~15mm diameter) and lipsticks lying flat (~20mm)
  const layer = createLayer('Layer 1', 5);

  // Real dimensions:
  // - Makeup brushes: 150-180mm → 4-5 units
  // - Lipsticks: 70-80mm → 2 units
  // - Mascara/eyeliner: 100-120mm → 3 units
  // - Compact mirrors: 60-80mm diameter → 2 units
  // - Nail polish bottles: 50-60mm tall → 1.5-2 units
  const bins = [
    // Brushes - 5 units deep (210mm) for 150-180mm brushes
    createBin(0, 0, 2, 5, { layerId: layer.id, categoryId: categories[0].id, label: 'Face Brushes' }),
    createBin(2, 0, 2, 5, { layerId: layer.id, categoryId: categories[0].id, label: 'Eye Brushes' }),
    // Mascara/eyeliner - 3 units deep (126mm) for 100-120mm
    createBin(4, 0, 2, 3, { layerId: layer.id, categoryId: categories[1].id, label: 'Mascara' }),
    createBin(4, 3, 2, 3, { layerId: layer.id, categoryId: categories[1].id, label: 'Eyeliner' }),
    // Lipsticks - 2 units deep (84mm) for 70-80mm
    createBin(0, 5, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Lipsticks' }),
    createBin(2, 5, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Lip Gloss' }),
    // Compact items - 2x2 for mirrors, palettes
    createBin(4, 6, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Compacts' }),
    // Small items
    createBin(0, 7, 1, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'Hair Ties' }),
    createBin(1, 7, 1, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'Bobby Pins' }),
    createBin(2, 7, 1, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'Clips' }),
    createBin(3, 7, 1, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'Bands' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Bathroom/Makeup',
    drawer: { width: 6, depth: 8, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'bathroom-makeup',
    name: 'Bathroom/Makeup',
    theme: 'personal',
    description:
      'Tall slots for makeup brushes, small bins for lipsticks and compacts. Includes spots for hair ties and bobby pins.',
    shortDescription: 'Makeup brushes, cosmetics, and accessories',
    complexity: 'beginner',
    tags: ['bathroom', 'makeup', 'cosmetics', 'personal'],
  });
}

function createNightstandDrawer(): InspirationLayout {
  const categories = [
    createCategory('Tech', '#38bdf8'),
    createCategory('Health', '#4ade80'),
    createCategory('Personal', '#94a3b8'),
  ];
  // Height 4 (28mm) for glasses cases (30-40mm thick) and earbuds cases (~25mm)
  const layer = createLayer('Layer 1', 4);

  // Real dimensions for nightstand items:
  // - Phone: ~160mm length → 4 units
  // - Glasses case: 160mm → 4 units depth
  // - Earbuds case: ~60-80mm → 2 units
  // - Lip balm, hand cream tubes: 80-120mm → 2-3 units
  const bins = [
    // Tech items
    createBin(0, 0, 2, 4, { layerId: layer.id, categoryId: categories[0].id, label: 'Phone' }),
    createBin(2, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Earbuds' }),
    createBin(4, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Charger' }),
    // Glasses case - 4 units deep
    createBin(2, 2, 4, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Glasses' }),
    // Health/personal items
    createBin(0, 4, 2, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Meds' }),
    createBin(2, 5, 2, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Vitamins' }),
    createBin(4, 5, 2, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'Lip Balm' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Nightstand Drawer',
    drawer: { width: 6, depth: 6, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'nightstand-drawer',
    name: 'Nightstand Drawer',
    theme: 'personal',
    description:
      'Bedside essentials: phone, earbuds, glasses case, medications, and charger. Shallow layout for typical nightstand drawers.',
    shortDescription: 'Phone, glasses, and bedside essentials',
    complexity: 'beginner',
    tags: ['bedroom', 'nightstand', 'personal', 'simple'],
  });
}

function createBatteryDrawer(): InspirationLayout {
  const categories = [
    createCategory('Common', '#fbbf24'),
    createCategory('Rechargeable', '#4ade80'),
    createCategory('Specialty', '#38bdf8'),
  ];
  // Height 5 (35mm) for C batteries (26mm) and D batteries (34mm) lying flat
  const layer = createLayer('Layer 1', 5);

  // Based on popular gridfinity battery organizers:
  // - AA: 50mm length, 14mm diameter → 1x2 bins work well
  // - AAA: 44mm length, 10mm diameter → 1x2 bins
  // - 9V: 48mm tall, 26x17mm → 1x2 bins
  // - 18650: 65mm length, 18mm diameter → 2x2 bins
  // - Coin cells (CR2032): 20mm diameter → 1x1 bins
  const bins = [
    // Common batteries - AA and AAA
    createBin(0, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'AA' }),
    createBin(2, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'AAA' }),
    createBin(4, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: '9V' }),
    // Rechargeable - 18650s and similar (popular for flashlights, vapes)
    createBin(0, 2, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: '18650' }),
    createBin(2, 2, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: '21700' }),
    createBin(4, 2, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'AA Recharge' }),
    // Specialty - coin cells, watch batteries
    createBin(0, 4, 1, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'CR2032' }),
    createBin(1, 4, 1, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'LR44' }),
    createBin(2, 4, 1, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'CR123' }),
    createBin(3, 4, 1, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'AAAA' }),
    createBin(4, 4, 2, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'C & D' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Battery Drawer',
    drawer: { width: 6, depth: 5, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'battery-drawer',
    name: 'Battery Drawer',
    theme: 'workshop',
    description:
      'Batteries organized by type: AA, AAA, 9V, rechargeable 18650s, and coin cells (CR2032, LR44).',
    shortDescription: 'AA, AAA, 18650, and coin cell batteries',
    complexity: 'beginner',
    tags: ['workshop', 'batteries', 'electronics', 'storage'],
  });
}

function createArtStation(): InspirationLayout {
  const categories = [
    createCategory('Brushes', '#f87171'),
    createCategory('Markers', '#a855f7'),
    createCategory('Supplies', '#fbbf24'),
  ];
  const layer = createLayer('Layer 1', 6);

  // Based on art supply gridfinity research:
  // - Paint brushes: 150-300mm, can fit 100+ in 4x4 space standing
  // - Standard Sharpie: ~140mm, 12mm diameter
  // - Chisel tip markers: fit 16x22mm ellipse
  // - Pencils: ~170-190mm
  const bins = [
    // Brushes - tall bins (6 units = 252mm depth for 150-200mm brushes laying flat)
    createBin(0, 0, 2, 6, { layerId: layer.id, categoryId: categories[0].id, label: 'Fine Brushes', height: 6 }),
    createBin(2, 0, 2, 6, { layerId: layer.id, categoryId: categories[0].id, label: 'Flat Brushes', height: 6 }),
    // Markers and pens - 4 units deep (168mm) for standing
    createBin(4, 0, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Markers', height: 6 }),
    createBin(6, 0, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Pens', height: 6 }),
    // Pencils and charcoal
    createBin(4, 4, 2, 5, { layerId: layer.id, categoryId: categories[1].id, label: 'Pencils', height: 6 }),
    createBin(6, 4, 2, 5, { layerId: layer.id, categoryId: categories[1].id, label: 'Charcoal', height: 6 }),
    // Supplies
    createBin(0, 6, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Erasers' }),
    createBin(2, 6, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Sharpeners' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Art Station',
    drawer: { width: 8, depth: 9, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'art-station',
    name: 'Art Station',
    theme: 'hobby',
    description:
      'Tall bins for brushes and markers stored upright. Separate sections for pencils, charcoal, erasers, and sharpeners.',
    shortDescription: 'Brushes, markers, pencils, and art supplies',
    complexity: 'beginner',
    tags: ['hobby', 'art', 'brushes', 'markers', 'drawing'],
  });
}

function createFirstAidKit(): InspirationLayout {
  const categories = [
    createCategory('Bandages', '#f87171'),
    createCategory('Medications', '#4ade80'),
    createCategory('Tools', '#38bdf8'),
  ];
  // Height 5 (35mm) for small medication bottles lying flat (~30mm diameter)
  const layer = createLayer('Layer 1', 5);

  // First aid supplies:
  // - Band-aids box: ~100x60mm → 3x2
  // - Gauze rolls: ~50mm diameter → 2x2
  // - Medication bottles: ~50-80mm tall → 2 units
  // - Scissors/tweezers: 100-150mm → 3-4 units
  // - Digital thermometer: 120-150mm → 3 units (126mm)
  const bins = [
    // Bandages section
    createBin(0, 0, 3, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Band-Aids' }),
    createBin(3, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Gauze' }),
    createBin(5, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Tape' }),
    createBin(0, 2, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Wraps' }),
    // Medications
    createBin(2, 2, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Pain Relief' }),
    createBin(4, 2, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Allergy' }),
    createBin(6, 2, 1, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Antacid' }),
    // Ointments and tools
    createBin(0, 4, 2, 3, { layerId: layer.id, categoryId: categories[1].id, label: 'Ointments' }),
    createBin(2, 4, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Scissors' }),
    createBin(4, 4, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Tweezers' }),
    createBin(6, 4, 1, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Thermometer' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'First Aid Kit',
    drawer: { width: 7, depth: 7, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'first-aid-kit',
    name: 'First Aid Kit',
    theme: 'personal',
    description:
      'Bandages, gauze, and tape up front. Medications organized by type. Tools section for scissors, tweezers, and thermometer.',
    shortDescription: 'Bandages, medications, and medical supplies',
    complexity: 'beginner',
    tags: ['personal', 'medical', 'first-aid', 'health'],
  });
}

function createJewelryDrawer(): InspirationLayout {
  const categories = [
    createCategory('Rings', '#fbbf24'),
    createCategory('Earrings', '#f472b6'),
    createCategory('Other', '#94a3b8'),
  ];
  const layer = createLayer('Layer 1', 3);

  // Jewelry storage (popular for IKEA Alex drawers):
  // - Rings: small 1x1 bins with dividers
  // - Earrings: shallow compartments
  // - Necklaces: longer bins to prevent tangling
  // - Watches: 2x2 for watch face + band
  const bins = [
    // Rings - small compartments
    createBin(0, 0, 1, 1, { layerId: layer.id, categoryId: categories[0].id, label: 'Rings' }),
    createBin(1, 0, 1, 1, { layerId: layer.id, categoryId: categories[0].id, label: 'Rings' }),
    createBin(2, 0, 1, 1, { layerId: layer.id, categoryId: categories[0].id, label: 'Rings' }),
    createBin(3, 0, 1, 1, { layerId: layer.id, categoryId: categories[0].id, label: 'Rings' }),
    // Earrings
    createBin(0, 1, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Studs' }),
    createBin(2, 1, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Dangles' }),
    // Bracelets and watches
    createBin(4, 0, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Bracelets' }),
    createBin(6, 0, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Watch' }),
    // Necklaces - longer to prevent tangling
    createBin(0, 3, 4, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Necklaces' }),
    createBin(4, 3, 4, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Chains' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Jewelry Drawer',
    drawer: { width: 8, depth: 6, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'jewelry-drawer',
    name: 'Jewelry Drawer',
    theme: 'personal',
    description:
      'Keep jewelry organized and tangle-free. Small compartments for rings, wider bins for earrings, and long trays for necklaces and chains.',
    shortDescription: 'Rings, earrings, necklaces, and watches',
    complexity: 'beginner',
    tags: ['personal', 'jewelry', 'accessories', 'organization'],
  });
}

function createSpiceDrawer(): InspirationLayout {
  // Standard 18" (457mm) cabinet drawer: ~420mm usable width, ~400mm depth = 10×10 units
  const categories = [
    createCategory('Everyday', '#f87171'),
    createCategory('Herbs', '#4ade80'),
    createCategory('Specialty', '#fbbf24'),
  ];
  // Height 7 (49mm) for standard spice jars lying on their side (~45mm diameter)
  const layer = createLayer('Layer 1', 7);

  // Standard spice jar: ~45mm diameter → fits in 1.5×1.5 or 2×2 bins
  // Larger spice containers: ~60-70mm → fits in 2×2 bins
  const bins = [
    // Everyday spices - front row (1.5×1.5 bins for standard jars)
    createBin(0, 0, 1.5, 1.5, { layerId: layer.id, categoryId: categories[0].id, label: 'Salt' }),
    createBin(1.5, 0, 1.5, 1.5, { layerId: layer.id, categoryId: categories[0].id, label: 'Pepper' }),
    createBin(3, 0, 1.5, 1.5, { layerId: layer.id, categoryId: categories[0].id, label: 'Garlic' }),
    createBin(4.5, 0, 1.5, 1.5, { layerId: layer.id, categoryId: categories[0].id, label: 'Onion' }),
    createBin(6, 0, 1.5, 1.5, { layerId: layer.id, categoryId: categories[0].id, label: 'Paprika' }),
    createBin(7.5, 0, 1.5, 1.5, { layerId: layer.id, categoryId: categories[0].id, label: 'Cumin' }),
    createBin(9, 0, 1, 1.5, { layerId: layer.id, categoryId: categories[0].id, label: 'Chili' }),
    // Second row
    createBin(0, 1.5, 1.5, 1.5, { layerId: layer.id, categoryId: categories[0].id, label: 'Oregano' }),
    createBin(1.5, 1.5, 1.5, 1.5, { layerId: layer.id, categoryId: categories[1].id, label: 'Basil' }),
    createBin(3, 1.5, 1.5, 1.5, { layerId: layer.id, categoryId: categories[1].id, label: 'Thyme' }),
    createBin(4.5, 1.5, 1.5, 1.5, { layerId: layer.id, categoryId: categories[1].id, label: 'Rosemary' }),
    createBin(6, 1.5, 1.5, 1.5, { layerId: layer.id, categoryId: categories[1].id, label: 'Parsley' }),
    createBin(7.5, 1.5, 1.5, 1.5, { layerId: layer.id, categoryId: categories[1].id, label: 'Dill' }),
    createBin(9, 1.5, 1, 1.5, { layerId: layer.id, categoryId: categories[1].id, label: 'Bay' }),
    // Third row - specialty spices (2×2 for larger containers)
    createBin(0, 3, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Cinnamon' }),
    createBin(2, 3, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Turmeric' }),
    createBin(4, 3, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Ginger' }),
    createBin(6, 3, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Curry' }),
    createBin(8, 3, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Cayenne' }),
    // Back section - larger bulk containers
    createBin(0, 5, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Italian' }),
    createBin(2, 5, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Taco' }),
    createBin(4, 5, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'BBQ Rub' }),
    createBin(6, 5, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Cajun' }),
    createBin(8, 5, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Chinese 5' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Spice Drawer',
    // 18" cabinet drawer
    drawer: { width: 10, depth: 7, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'spice-drawer',
    name: 'Spice Drawer',
    theme: 'kitchen',
    description:
      'Organize your spices with half-bin precision for standard spice jars. Everyday spices up front, herbs in the middle, specialty blends in the back.',
    shortDescription: 'Spice jars organized by frequency of use',
    complexity: 'intermediate',
    tags: ['kitchen', 'spices', 'cooking', 'half-bins'],
  });
}

function createGarageDrawer(): InspirationLayout {
  // Harbor Freight US General 44" tool chest drawer: 568×490mm = 13×11 units
  // Drawer height ~84mm - sized for small bottles, spray cans, and hardware
  const categories = [
    createCategory('Lubricants', '#38bdf8'),
    createCategory('Consumables', '#4ade80'),
    createCategory('Hardware', '#fbbf24'),
    createCategory('Electrical', '#f87171'),
  ];
  // Height 7 (49mm) for small spray cans lying flat (~45mm diameter)
  const layer = createLayer('Layer 1', 7);

  // Realistic automotive drawer supplies (small containers that fit in shallow drawer):
  // - Small spray cans (3oz WD-40): ~45×90mm → 2x3 bins (84×126mm)
  // - Thread locker bottles: ~25×80mm → 1x2 bins
  // - Electrical tape: ~50mm diameter → 2x2 bins
  // - Drain plugs, fuses, connectors: small hardware → 2x2 or 3x3 bins
  const bins = [
    // Lubricants section - small spray cans and bottles (lying flat, 45mm diameter)
    createBin(0, 0, 2, 3, { layerId: layer.id, categoryId: categories[0].id, label: 'WD-40', height: 7 }),
    createBin(2, 0, 2, 3, { layerId: layer.id, categoryId: categories[0].id, label: 'PB Blaster', height: 7 }),
    createBin(4, 0, 2, 3, { layerId: layer.id, categoryId: categories[0].id, label: 'Silicone', height: 7 }),
    createBin(6, 0, 2, 3, { layerId: layer.id, categoryId: categories[0].id, label: 'Grease', height: 7 }),
    createBin(8, 0, 1, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Blue Loctite' }),
    createBin(9, 0, 1, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Red Loctite' }),
    createBin(10, 0, 1, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Anti-Seize' }),
    createBin(11, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Dielectric' }),
    // Consumables - tapes, gloves, towels
    createBin(0, 3, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Elec Tape' }),
    createBin(2, 3, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Teflon Tape' }),
    createBin(4, 3, 3, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Nitrile Gloves' }),
    createBin(7, 3, 3, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Shop Rags' }),
    createBin(10, 3, 3, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Latex Gloves' }),
    // Hardware - small automotive parts
    createBin(8, 2, 2, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'Crush Washers' }),
    createBin(10, 2, 3, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'Drain Plugs' }),
    createBin(0, 5, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Zip Ties' }),
    createBin(2, 5, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Hose Clamps' }),
    createBin(4, 5, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'O-Rings' }),
    createBin(6, 5, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Cotter Pins' }),
    // Electrical - small components
    createBin(8, 5, 2, 3, { layerId: layer.id, categoryId: categories[3].id, label: 'Fuses' }),
    createBin(10, 5, 2, 3, { layerId: layer.id, categoryId: categories[3].id, label: 'Connectors' }),
    createBin(12, 5, 1, 3, { layerId: layer.id, categoryId: categories[3].id, label: 'Bulbs' }),
    // Bottom row - larger items
    createBin(0, 7, 3, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Gaskets' }),
    createBin(3, 7, 3, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Filters' }),
    createBin(6, 8, 2, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Wire Nuts' }),
    createBin(8, 8, 2, 3, { layerId: layer.id, categoryId: categories[3].id, label: 'Terminals' }),
    createBin(10, 8, 3, 3, { layerId: layer.id, categoryId: categories[3].id, label: 'Wire' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Garage Drawer',
    // Harbor Freight US General 44" tool chest drawer
    drawer: { width: 13, depth: 11, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'garage-drawer',
    name: 'Garage/Automotive',
    theme: 'workshop',
    description:
      'Automotive consumables for a tool chest drawer (13×11 units). Small spray cans, thread lockers, tapes, gloves, and electrical supplies.',
    shortDescription: 'Spray cans, tapes, gloves, and hardware',
    complexity: 'beginner',
    tags: ['workshop', 'garage', 'automotive', 'car', 'tool-chest'],
  });
}

// ============================================================
// NEW LAYOUTS - Filling telemetry gaps
// ============================================================

function createEDCDrawer(): InspirationLayout {
  // Small drawer for everyday carry items: ~295mm × 295mm = 7×7 units
  const categories = [
    createCategory('Daily', '#fbbf24'),
    createCategory('Tech', '#38bdf8'),
    createCategory('Accessories', '#94a3b8'),
  ];
  // Height 4 (28mm) for EDC flashlights (~22mm diameter) and glasses cases
  const layer = createLayer('Layer 1', 4);

  // EDC items based on telemetry gaps: key, coin, flashlight, glasses, watch
  // Real dimensions:
  // - Keys + keychain: 50-80mm → 2 units (84mm)
  // - EDC flashlight (Olight S2R, Fenix): 100-130mm → 3 units (126mm)
  // - Pocket knife closed: 80-110mm → 3 units (126mm)
  // - Glasses case: 160mm → 4 units (168mm)
  // - Watch: 40-45mm diameter → 2 units (84mm)
  // - Earbuds case: 60-80mm → 2 units (84mm)
  const bins = [
    // Front row - quick grab items
    createBin(0, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Keys' }),
    createBin(2, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Coins' }),
    createBin(4, 0, 3, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Pocket Knife' }),
    // Middle row - watch, flashlight, earbuds
    createBin(0, 2, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Watch' }),
    createBin(2, 2, 2, 3, { layerId: layer.id, categoryId: categories[0].id, label: 'Flashlight' }),
    createBin(4, 2, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Earbuds' }),
    createBin(6, 2, 1, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'AirTag' }),
    // Bottom row - glasses and charger
    createBin(0, 5, 4, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Glasses' }),
    createBin(4, 4, 3, 3, { layerId: layer.id, categoryId: categories[1].id, label: 'Charger' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'EDC Drawer',
    drawer: { width: 7, depth: 7, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'edc-drawer',
    name: 'EDC Drawer',
    theme: 'personal',
    description:
      'Everyday carry essentials: keys, wallet, watch, flashlight, pocket knife, and glasses. Quick-access layout for items you grab daily.',
    shortDescription: 'Keys, wallet, watch, and daily essentials',
    complexity: 'beginner',
    tags: ['personal', 'edc', 'keys', 'wallet', 'everyday'],
  });
}

function createDrillBitOrganizer(): InspirationLayout {
  // IKEA Alex drawer: 297×525mm = 7×12 gridfinity units
  const categories = [
    createCategory('Twist Bits', '#38bdf8'),
    createCategory('Specialty', '#4ade80'),
    createCategory('Hole Saws', '#fbbf24'),
  ];
  const layer = createLayer('Layer 1', 6);

  // Drill bit dimensions:
  // - Standard twist bits: 1-13mm, 50-150mm length → 1x4 bins
  // - Forstner bits: 15-50mm diameter, ~90mm length → 2x2 or 3x3 bins
  // - Spade bits: handle ~150mm → 4 units
  // - Hole saws: 20-100mm diameter → 3x3 bins
  const bins = [
    // Twist drill bits - organized by size (small 1x4 bins for individual sizes)
    createBin(0, 0, 1, 4, { layerId: layer.id, categoryId: categories[0].id, label: '1-2mm' }),
    createBin(1, 0, 1, 4, { layerId: layer.id, categoryId: categories[0].id, label: '2.5-3mm' }),
    createBin(2, 0, 1, 4, { layerId: layer.id, categoryId: categories[0].id, label: '3.5-4mm' }),
    createBin(3, 0, 1, 4, { layerId: layer.id, categoryId: categories[0].id, label: '4.5-5mm' }),
    createBin(4, 0, 1, 4, { layerId: layer.id, categoryId: categories[0].id, label: '5.5-6mm' }),
    createBin(5, 0, 1, 4, { layerId: layer.id, categoryId: categories[0].id, label: '6.5-8mm' }),
    createBin(6, 0, 1, 4, { layerId: layer.id, categoryId: categories[0].id, label: '9-13mm' }),
    // Spade bits - longer, need 5 units depth
    createBin(0, 4, 2, 5, { layerId: layer.id, categoryId: categories[1].id, label: 'Spade Small', height: 6 }),
    createBin(2, 4, 2, 5, { layerId: layer.id, categoryId: categories[1].id, label: 'Spade Large', height: 6 }),
    // Forstner bits - 2x2 bins for fat bits
    createBin(4, 4, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Forstner 15-25' }),
    createBin(4, 6, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Forstner 30-50' }),
    // Hole saws - need larger bins for 50-100mm diameter saws
    createBin(0, 9, 3, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Hole Saw S', height: 6 }),
    createBin(3, 9, 3, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Hole Saw L', height: 6 }),
    // Countersinks and step bits - step bits stored flat (75-100mm long)
    createBin(6, 4, 1, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Countersink' }),
    createBin(6, 8, 1, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Step Bits' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Drill Bit Organizer',
    // IKEA Alex drawer
    drawer: { width: 7, depth: 12, height: 12 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'drill-bit-organizer',
    name: 'Drill Bit Organizer',
    theme: 'workshop',
    description:
      'Twist drill bits sorted by size (1-13mm), spade bits, forstner bits, hole saws, and countersinks. Long bins for laying bits flat.',
    shortDescription: 'Twist, spade, forstner, and hole saws',
    complexity: 'intermediate',
    tags: ['workshop', 'drill', 'bits', 'woodworking', 'ikea-alex'],
  });
}

function createMakerStation(): InspirationLayout {
  // IKEA Alex drawer: 297×525mm = 7×12 gridfinity units
  const categories = [
    createCategory('Boards', '#f87171'),
    createCategory('Sensors', '#4ade80'),
    createCategory('Connectivity', '#38bdf8'),
    createCategory('Supplies', '#fbbf24'),
  ];
  // Height 4 (28mm) for Raspberry Pi with heatsink (~25mm) and motor modules
  const layer = createLayer('Layer 1', 4);

  // Maker/Arduino supplies based on telemetry: arduino, sd_card, wire
  // Real dimensions:
  // - Arduino Uno: 69×53mm → 2x2 bins (84×84mm)
  // - Arduino Nano: 45×18mm → 2x1 would suffice, using 2x2 for accessories
  // - ESP32 dev board: 55×28mm → 2x2 bins
  // - Wemos D1 Mini: 34×25mm → 1x2 bins (42×84mm)
  // - Raspberry Pi: 85×56mm → 3x2 bins (126×84mm)
  // - Breadboard (half): 84×55mm → 3x2 bins
  // - Jumper wire bundle: varies → 2x3 bins
  const bins = [
    // Development boards - 2x2 bins for Arduino-sized boards
    createBin(0, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Arduino Uno' }),
    createBin(2, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Arduino Nano' }),
    createBin(4, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'ESP32' }),
    createBin(6, 0, 1, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Wemos D1' }),
    // Raspberry Pi and larger boards
    createBin(0, 2, 3, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Raspberry Pi' }),
    createBin(3, 2, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Pico' }),
    // Sensors - 1x1 bins for small modules
    createBin(5, 2, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'DHT22' }),
    createBin(6, 2, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'PIR' }),
    createBin(5, 3, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Ultrasonic' }),
    createBin(6, 3, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'IR' }),
    // Breadboards and prototyping
    createBin(0, 4, 3, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Breadboard' }),
    createBin(3, 4, 2, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Perf Board' }),
    // Connectivity - SD cards, USB, etc
    createBin(5, 4, 1, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'SD Cards' }),
    createBin(6, 4, 1, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'MicroSD' }),
    createBin(5, 5, 2, 1, { layerId: layer.id, categoryId: categories[2].id, label: 'USB Cables' }),
    // Jumper wires and supplies
    createBin(0, 6, 2, 3, { layerId: layer.id, categoryId: categories[3].id, label: 'M-M Jumpers' }),
    createBin(2, 6, 2, 3, { layerId: layer.id, categoryId: categories[3].id, label: 'M-F Jumpers' }),
    createBin(4, 6, 2, 3, { layerId: layer.id, categoryId: categories[3].id, label: 'F-F Jumpers' }),
    createBin(6, 6, 1, 3, { layerId: layer.id, categoryId: categories[3].id, label: 'Dupont' }),
    // Bottom row - displays and modules
    createBin(0, 9, 2, 3, { layerId: layer.id, categoryId: categories[1].id, label: 'OLED' }),
    createBin(2, 9, 2, 3, { layerId: layer.id, categoryId: categories[1].id, label: 'LCD' }),
    createBin(4, 9, 2, 3, { layerId: layer.id, categoryId: categories[1].id, label: 'Relays' }),
    createBin(6, 9, 1, 3, { layerId: layer.id, categoryId: categories[1].id, label: 'Motors' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Maker Station',
    // IKEA Alex drawer
    drawer: { width: 7, depth: 12, height: 6 },
    printBedSize: 256,
    gridUnitMm: 42,
    heightUnitMm: 7,
    categories,
    layers: [layer],
    bins,
  };

  return buildInspirationLayout(layout, {
    id: 'maker-station',
    name: 'Maker Station',
    theme: 'hobby',
    description:
      'Arduino, ESP32, Wemos D1, Raspberry Pi, and microcontroller organization. Includes slots for sensors, breadboards, jumper wires, and SD cards.',
    shortDescription: 'Arduino, ESP32, Wemos D1, and maker supplies',
    complexity: 'intermediate',
    tags: ['hobby', 'arduino', 'electronics', 'maker', 'raspberry-pi', 'ikea-alex'],
  });
}

// ============================================================
// EXPORT ALL LAYOUTS
// ============================================================

// Ordered by popularity based on telemetry data:
// - Vocabulary tracking shows fasteners, tools, electronics, 3D printing hardware most common
// - Gridfinity core users are makers/3D printing enthusiasts
export const INSPIRATION_LAYOUTS: InspirationLayout[] = [
  // Workshop - most popular (tools, fasteners, electronics domains heavily tracked)
  createScrewOrganizer(),      // Fasteners most tracked in telemetry
  createToolDrawer(),          // Tools domain popular
  createDrillBitOrganizer(),   // NEW: drill_bit tracked, fills gap
  createElectronicsBench(),    // Electronics domain popular
  createBatteryDrawer(),       // Batteries specifically tracked
  createSocketOrganizer(),
  createGarageDrawer(),
  // Hobby - Maker/3D Printing (core gridfinity user base)
  create3DPrintingSupplies(),  // heat_insert/magnet/bearing highly tracked
  createMakerStation(),        // NEW: arduino/microcontroller tracked, fills gap
  // Office (USB cables, pens, clips tracked)
  createCableDrawer(),         // usb_cable tracked
  createDeskDrawer(),
  // Kitchen (common household use)
  createCutleryDrawer(),
  createCookingUtensils(),
  createKnifeDrawer(),
  createSpiceDrawer(),
  // Hobby - Craft (paint, brush, glue tracked)
  createCraftSupplies(),
  createArtStation(),
  createSewingKit(),
  // Personal (key, coin, flashlight, glasses, watch, medication, jewelry tracked)
  createEDCDrawer(),           // NEW: key/coin/flashlight/glasses/watch fills gaps
  createFirstAidKit(),
  createJewelryDrawer(),
  createNightstandDrawer(),
  createBathroomMakeup(),
];

/**
 * Get layouts filtered by theme.
 */
export function getLayoutsByTheme(theme: InspirationTheme | 'all'): InspirationLayout[] {
  if (theme === 'all') return INSPIRATION_LAYOUTS;
  return INSPIRATION_LAYOUTS.filter((l) => l.theme === theme);
}

/**
 * Get a single layout by ID.
 */
export function getLayoutById(id: string): InspirationLayout | undefined {
  return INSPIRATION_LAYOUTS.find((l) => l.id === id);
}
