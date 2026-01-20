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
  const categories = [
    createCategory('Silverware', '#94a3b8'),
    createCategory('Small', '#38bdf8'),
  ];
  const layer = createLayer('Layer 1', 3);

  // Real cutlery dimensions:
  // - Dinner fork: ~200mm, dinner knife: ~230mm, tablespoon: ~200mm
  // - Teaspoon: ~150mm, dessert fork/spoon: ~170mm
  // Using 6 units depth (252mm) to fit dinner knives
  const bins = [
    // Main cutlery - 6 units deep (252mm) for dinner knives at ~230mm
    createBin(0, 0, 2, 6, { layerId: layer.id, categoryId: categories[0].id, label: 'Forks' }),
    createBin(2, 0, 2, 6, { layerId: layer.id, categoryId: categories[0].id, label: 'Knives' }),
    createBin(4, 0, 2, 6, { layerId: layer.id, categoryId: categories[0].id, label: 'Spoons' }),
    createBin(6, 0, 2, 6, { layerId: layer.id, categoryId: categories[0].id, label: 'Steak Knives' }),
    // Smaller utensils - 4 units (168mm) for teaspoons ~150mm
    createBin(0, 6, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Teaspoons' }),
    createBin(2, 6, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Dessert Forks' }),
    createBin(4, 6, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Dessert Spoons' }),
    createBin(6, 6, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Butter Knives' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Cutlery Drawer',
    drawer: { width: 8, depth: 10, height: 6 },
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
      'Classic silverware organization with dedicated slots for dinner and dessert cutlery. Main slots sized for full-length dinner knives (230mm), smaller slots for teaspoons and dessert pieces.',
    shortDescription: 'Forks, knives, spoons, and dessert cutlery',
    complexity: 'beginner',
    tags: ['kitchen', 'cutlery', 'silverware', 'simple'],
  });
}

function createCookingUtensils(): InspirationLayout {
  const categories = [
    createCategory('Long Tools', '#4ade80'),
    createCategory('Medium Tools', '#38bdf8'),
    createCategory('Small Tools', '#fbbf24'),
  ];
  const layer = createLayer('Layer 1', 3);

  // Bins hold MULTIPLE items of same type
  // - Ladles/spoons: 300-350mm → 8 units (336mm)
  // - Spatulas/whisks/tongs: 250-300mm → 7 units (294mm)
  // - Peelers/openers: 150-200mm → 5 units (210mm)
  const bins = [
    // Long tools - 8 units deep for ladles, serving spoons
    createBin(0, 0, 2, 8, { layerId: layer.id, categoryId: categories[0].id, label: 'Ladles' }),
    createBin(2, 0, 2, 8, { layerId: layer.id, categoryId: categories[0].id, label: 'Spoons' }),
    // Medium tools - 7 units deep for spatulas, whisks, tongs
    createBin(4, 0, 2, 7, { layerId: layer.id, categoryId: categories[1].id, label: 'Spatulas' }),
    createBin(6, 0, 2, 7, { layerId: layer.id, categoryId: categories[1].id, label: 'Whisks' }),
    createBin(4, 7, 4, 7, { layerId: layer.id, categoryId: categories[1].id, label: 'Tongs' }),
    // Small tools - 6 units deep for peelers, gadgets
    createBin(0, 8, 2, 6, { layerId: layer.id, categoryId: categories[2].id, label: 'Peelers' }),
    createBin(2, 8, 2, 6, { layerId: layer.id, categoryId: categories[2].id, label: 'Gadgets' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Cooking Utensils',
    drawer: { width: 8, depth: 14, height: 6 },
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
      'Organize cooking tools by size: long tools (ladles, serving spoons), medium tools (spatulas, whisks, tongs), and small gadgets (peelers, openers).',
    shortDescription: 'Spatulas, ladles, whisks, and tongs',
    complexity: 'beginner',
    tags: ['kitchen', 'utensils', 'cooking'],
  });
}

function createKnifeDrawer(): InspirationLayout {
  const categories = [
    createCategory('Knives', '#334155'),
    createCategory('Accessories', '#f87171'),
  ];
  const layer = createLayer('Layer 1', 6);

  // Real knife dimensions (with handle):
  // - Chef's knife: 320-380mm, Bread knife: 350-400mm
  // - Santoku: 280-320mm, Utility: 230-280mm
  // - Paring: 180-220mm, Honing steel: 300-380mm
  const bins = [
    // Large knives - 9 units (378mm) for chef's and bread knives
    createBin(0, 0, 2, 9, { layerId: layer.id, categoryId: categories[0].id, label: "Chef's Knife", height: 6 }),
    createBin(2, 0, 2, 9, { layerId: layer.id, categoryId: categories[0].id, label: 'Bread Knife', height: 6 }),
    // Honing steel - also needs 9 units (most are 300-350mm)
    createBin(4, 0, 2, 9, { layerId: layer.id, categoryId: categories[0].id, label: 'Honing Steel', height: 6 }),
    // Medium knives - 7 units (294mm) for santoku/utility
    createBin(6, 0, 2, 7, { layerId: layer.id, categoryId: categories[0].id, label: 'Santoku', height: 6 }),
    // Paring knives - 5 units (210mm)
    createBin(6, 7, 2, 5, { layerId: layer.id, categoryId: categories[0].id, label: 'Paring' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Knife Drawer',
    drawer: { width: 8, depth: 12, height: 12 },
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
      'Safe storage for kitchen knives with dedicated slots for each blade. Deep bins protect knife edges and keep them organized by size.',
    shortDescription: 'Safe storage for kitchen knives',
    complexity: 'intermediate',
    tags: ['kitchen', 'knives', 'safety', 'labeled'],
  });
}

// ============================================================
// WORKSHOP LAYOUTS (4 layouts) - Screw Organizer, Hand Tools, Electronics Bench, Socket Organizer
// ============================================================

function createScrewOrganizer(): InspirationLayout {
  const categories = [
    createCategory('Small Screws', '#38bdf8'),
    createCategory('Medium Screws', '#4ade80'),
    createCategory('Large Screws', '#fbbf24'),
    createCategory('Nuts & Washers', '#e2e8f0'),
  ];
  const layer = createLayer('Layer 1', 3);

  const bins = [
    // Row 1: Small screws (1x1 bins) - Based on telemetry showing 1x1x3 is most popular
    ...Array.from({ length: 6 }, (_, i) =>
      createBin(i, 0, 1, 1, {
        layerId: layer.id,
        categoryId: categories[0].id,
        label: ['M2x4', 'M2x6', 'M3x6', 'M3x8', 'M3x10', 'M3x12'][i],
      })
    ),
    // Row 2: Medium screws
    ...Array.from({ length: 4 }, (_, i) =>
      createBin(i * 1.5, 1, 1.5, 1.5, {
        layerId: layer.id,
        categoryId: categories[1].id,
        label: ['M4x10', 'M4x16', 'M5x10', 'M5x16'][i],
      })
    ),
    // Row 3-4: Large screws and nuts
    createBin(0, 2.5, 2, 2.5, { layerId: layer.id, categoryId: categories[2].id, label: 'M6 Screws' }),
    createBin(2, 2.5, 2, 2.5, { layerId: layer.id, categoryId: categories[2].id, label: 'M8 Screws' }),
    createBin(4, 2.5, 2, 2.5, { layerId: layer.id, categoryId: categories[3].id, label: 'Nuts' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Screw Organizer',
    drawer: { width: 6, depth: 5, height: 6 },
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
      'Sort screws by size with a mix of small and medium bins. Uses half-bin increments for flexible sizing. Color-coded categories make finding the right fastener quick.',
    shortDescription: 'Sort screws by size with half-bin divisions',
    complexity: 'intermediate',
    tags: ['workshop', 'screws', 'fasteners', 'half-bins'],
  });
}

function createToolDrawer(): InspirationLayout {
  const categories = [
    createCategory('Pliers', '#f87171'),
    createCategory('Screwdrivers', '#38bdf8'),
    createCategory('Wrenches', '#fbbf24'),
    createCategory('Other', '#e2e8f0'),
  ];
  const layer = createLayer('Layer 1', 3);

  // Real tool dimensions:
  // - Pliers: 150-200mm
  // - Screwdrivers: 200-300mm (need 6+ units = 252mm+)
  // - Adjustable wrench 8": 200mm, 10": 250mm
  // - Allen key sets: vary, typically 100-150mm
  const bins = [
    // Pliers - 5 units (210mm) for 150-200mm pliers
    createBin(0, 0, 2, 5, { layerId: layer.id, categoryId: categories[0].id, label: 'Needle Nose' }),
    createBin(2, 0, 2, 5, { layerId: layer.id, categoryId: categories[0].id, label: 'Diagonal Cutters' }),
    createBin(4, 0, 2, 5, { layerId: layer.id, categoryId: categories[0].id, label: 'Linesman' }),
    // Screwdrivers - 6 units (252mm) for standard 200-250mm screwdrivers
    createBin(0, 5, 2, 6, { layerId: layer.id, categoryId: categories[1].id, label: 'Phillips' }),
    createBin(2, 5, 2, 6, { layerId: layer.id, categoryId: categories[1].id, label: 'Flathead' }),
    createBin(4, 5, 2, 6, { layerId: layer.id, categoryId: categories[1].id, label: 'Torx' }),
    // Wrenches - 6 units (252mm) for 8-10" adjustable wrenches
    createBin(6, 0, 2, 6, { layerId: layer.id, categoryId: categories[2].id, label: 'Adjustable' }),
    // Allen keys - 4 units (168mm) for typical sets
    createBin(6, 6, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Allen Keys' }),
    // Tape measure - compact, fits in small bin
    createBin(6, 9, 2, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Tape Measure' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Hand Tools',
    drawer: { width: 8, depth: 11, height: 6 },
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
      'Organize essential hand tools with dedicated sections for pliers, screwdrivers, and wrenches. The layout uses color coding to quickly identify tool types.',
    shortDescription: 'Pliers, screwdrivers, and wrenches organized',
    complexity: 'beginner',
    tags: ['workshop', 'tools', 'pliers', 'screwdrivers'],
  });
}

function createElectronicsBench(): InspirationLayout {
  const categories = [
    createCategory('Components', '#38bdf8'),
    createCategory('Tools', '#4ade80'),
    createCategory('Supplies', '#fbbf24'),
  ];
  const layer = createLayer('Layer 1', 3);

  // Tweezers: 100-150mm → 3 units (126mm) minimum
  // Flush cutters: 100-130mm → 3 units (126mm) minimum
  const bins = [
    // Small components - top rows
    createBin(0, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Resistors' }),
    createBin(2, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Capacitors' }),
    createBin(4, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'LEDs' }),
    createBin(6, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Transistors' }),
    createBin(0, 2, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Headers' }),
    createBin(2, 2, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Connectors' }),
    // Tools - 3 units deep for 100-150mm tools
    createBin(4, 2, 2, 3, { layerId: layer.id, categoryId: categories[1].id, label: 'Tweezers' }),
    createBin(6, 2, 2, 3, { layerId: layer.id, categoryId: categories[1].id, label: 'Cutters' }),
    // Supplies - bottom section (shifted down 1 unit)
    createBin(0, 4, 2, 5, { layerId: layer.id, categoryId: categories[2].id, label: 'Solder' }),
    createBin(2, 5, 3, 4, { layerId: layer.id, categoryId: categories[2].id, label: 'Wire Spools' }),
    createBin(5, 5, 3, 4, { layerId: layer.id, categoryId: categories[2].id, label: 'Shrink Tubing' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Electronics Bench',
    drawer: { width: 8, depth: 9, height: 6 },
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
      'Electronics workstation with component storage, tools, and supplies. Small bins for resistors, capacitors, and LEDs; larger bins for wire and solder.',
    shortDescription: 'Components, tools, and supplies',
    complexity: 'intermediate',
    tags: ['workshop', 'electronics', 'soldering', 'components'],
  });
}

function createSocketOrganizer(): InspirationLayout {
  const categories = [
    createCategory('Sockets', '#38bdf8'),
    createCategory('Ratchets', '#f87171'),
    createCategory('Accessories', '#4ade80'),
  ];
  const layer = createLayer('Layer 1', 3);

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
      'Practical socket set organization with grouped bins for metric sockets by drive size. Includes dedicated slots for ratchets and accessories.',
    shortDescription: 'Socket sets with ratchets and extensions',
    complexity: 'beginner',
    tags: ['workshop', 'sockets', 'automotive', 'mechanic'],
  });
}

// ============================================================
// OFFICE LAYOUTS (2 layouts)
// ============================================================

function createDeskDrawer(): InspirationLayout {
  const categories = [
    createCategory('Writing', '#38bdf8'),
    createCategory('Clips', '#fbbf24'),
    createCategory('Other', '#e2e8f0'),
  ];
  const layer = createLayer('Layer 1', 3);

  // Real dimensions:
  // - Pens/pencils: ~150mm, Markers: ~140mm
  // - Office scissors: 180-200mm (need 5 units = 210mm)
  // - Letter opener: ~200mm
  const bins = [
    // Writing instruments - 4 units (168mm) for ~150mm pens/pencils
    createBin(0, 0, 2, 4, { layerId: layer.id, categoryId: categories[0].id, label: 'Pens', height: 6 }),
    createBin(2, 0, 2, 4, { layerId: layer.id, categoryId: categories[0].id, label: 'Pencils', height: 6 }),
    createBin(4, 0, 2, 4, { layerId: layer.id, categoryId: categories[0].id, label: 'Markers', height: 6 }),
    // Scissors - 5 units (210mm) for 180-200mm scissors
    createBin(6, 0, 2, 5, { layerId: layer.id, categoryId: categories[2].id, label: 'Scissors' }),
    // Small items in a row
    createBin(0, 4, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Clips' }),
    createBin(1, 4, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Pins' }),
    createBin(2, 4, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Bands' }),
    createBin(3, 4, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Staples' }),
    createBin(4, 4, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Tacks' }),
    createBin(5, 4, 1, 1, { layerId: layer.id, categoryId: categories[1].id, label: 'Eraser' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Desk Drawer',
    drawer: { width: 8, depth: 5, height: 9 },
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
      'Classic desk drawer organization with sections for writing instruments, small office supplies, and everyday tools.',
    shortDescription: 'Pens, clips, and desk essentials',
    complexity: 'beginner',
    tags: ['office', 'desk', 'pens', 'supplies'],
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
      'Tame the cable chaos! Organize charging cables, power cords, and adapters by type. Deep bins keep cables coiled and tangle-free.',
    shortDescription: 'Charging cables, cords, and adapters',
    complexity: 'intermediate',
    tags: ['office', 'cables', 'charging', 'tech'],
  });
}

// ============================================================
// HOBBY LAYOUTS (3 layouts) - 3D Printing, Craft Supplies, Sewing Kit
// ============================================================

function create3DPrintingSupplies(): InspirationLayout {
  const categories = [
    createCategory('Filament', '#f87171'),
    createCategory('Hardware', '#38bdf8'),
    createCategory('Tools', '#4ade80'),
    createCategory('Glue & Finish', '#fbbf24'),
  ];
  const layer = createLayer('Layer 1', 6);

  // Based on telemetry: filament samples popular, glue/magnets common
  const bins = [
    // Filament samples (2x4 based on telemetry)
    createBin(0, 0, 2, 4, { layerId: layer.id, categoryId: categories[0].id, label: 'PLA Samples', height: 6 }),
    createBin(2, 0, 2, 4, { layerId: layer.id, categoryId: categories[0].id, label: 'PETG Samples', height: 6 }),
    createBin(4, 0, 2, 4, { layerId: layer.id, categoryId: categories[0].id, label: 'TPU Samples', height: 6 }),
    // Hardware (heat inserts popular per telemetry)
    createBin(0, 4, 3, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Heat Inserts', height: 6 }),
    createBin(3, 4, 3, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Magnets', height: 6 }),
    // Tools
    createBin(6, 0, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Scrapers' }),
    createBin(6, 3, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Tweezers' }),
    // Glue (very popular per telemetry)
    createBin(0, 6, 4, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Glue', height: 6 }),
    createBin(4, 6, 4, 2, { layerId: layer.id, categoryId: categories[3].id, label: 'Sandpaper' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: '3D Printing Supplies',
    drawer: { width: 8, depth: 8, height: 12 },
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
      'Organize your 3D printing accessories: filament samples, heat inserts, magnets, and finishing supplies. Based on what real makers actually store!',
    shortDescription: 'Filament samples, heat inserts, and finishing',
    complexity: 'intermediate',
    tags: ['hobby', '3d-printing', 'filament', 'maker'],
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
      'Craft organization with adhesives, cutting tools, and small notions. Dedicated slots for scissors, X-Acto knives, and glue.',
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
  const layer = createLayer('Layer 1', 3);

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
      'Complete sewing organization with half-bin sized compartments for thread spools and notions. Color-coded thread storage makes finding the right color easy.',
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
  const layer = createLayer('Layer 1', 3);

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
      'Organize makeup and bathroom essentials with dedicated slots for brushes, lipsticks, and small accessories. Bins sized for real cosmetics dimensions.',
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
  const layer = createLayer('Layer 1', 3);

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
      'Keep bedside essentials organized with spots for phone, glasses, medications, and personal items. Shallow layout fits typical nightstand drawers.',
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
  const layer = createLayer('Layer 1', 3);

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
      'Keep all your batteries organized by type. Dedicated bins for common AA/AAA, rechargeable 18650s, and specialty coin cells. Based on popular gridfinity battery organizers.',
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
      'Artist workstation with tall bins for brushes, markers, and pencils. Taller height (12 units) accommodates standing art supplies.',
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
  const layer = createLayer('Layer 1', 3);

  // First aid supplies:
  // - Band-aids box: ~100x60mm → 3x2
  // - Gauze rolls: ~50mm diameter → 2x2
  // - Medication bottles: ~50-80mm tall → 2 units
  // - Scissors/tweezers: 100-150mm → 3-4 units
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
    createBin(4, 4, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Tweezers' }),
    createBin(6, 4, 1, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Thermometer' }),
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
      'Organize medical supplies with dedicated sections for bandages, medications, and tools. Keep everything visible and accessible for emergencies.',
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

// ============================================================
// EXPORT ALL LAYOUTS
// ============================================================

export const INSPIRATION_LAYOUTS: InspirationLayout[] = [
  // Kitchen (3)
  createCutleryDrawer(),
  createCookingUtensils(),
  createKnifeDrawer(),
  // Workshop (5)
  createScrewOrganizer(),
  createToolDrawer(),
  createElectronicsBench(),
  createSocketOrganizer(),
  createBatteryDrawer(),
  // Office (2)
  createDeskDrawer(),
  createCableDrawer(),
  // Hobby (4)
  create3DPrintingSupplies(),
  createCraftSupplies(),
  createSewingKit(),
  createArtStation(),
  // Personal (5)
  createBathroomMakeup(),
  createNightstandDrawer(),
  createFirstAidKit(),
  createJewelryDrawer(),
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
