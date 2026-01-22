import type { Layout } from '@/core/types';
import type { InspirationLayout } from '../../types';
import {
  createBin,
  createLayer,
  createCategory,
  buildInspirationLayout,
} from '../../utils/layoutBuilder';

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
    createBin(0, 0, 2, 3, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'PLA',
      height: 6,
    }),
    createBin(2, 0, 2, 3, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'PETG',
      height: 6,
    }),
    createBin(4, 0, 2, 3, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'TPU',
      height: 6,
    }),
    createBin(6, 0, 1, 3, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'ABS',
      height: 6,
    }),
    // Hardware - most popular per telemetry (heat inserts, magnets, bearings)
    createBin(0, 3, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'M3 Inserts' }),
    createBin(2, 3, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'M4 Inserts' }),
    createBin(4, 3, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'M5 Inserts' }),
    createBin(6, 3, 1, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Misc' }),
    createBin(0, 5, 2, 2, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: '6x3 Magnets',
    }),
    createBin(2, 5, 2, 2, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: '8x3 Magnets',
    }),
    createBin(4, 5, 2, 2, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: '608 Bearings',
    }),
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
  // - Arduino Nano: 45×18mm → 2x2 would suffice, using 2x2 for accessories
  // - ESP32 dev board: 55×28mm → 2x2 bins
  // - Wemos D1 Mini: 34×25mm → 1x2 bins (42×84mm)
  // - Raspberry Pi: 85×56mm → 3x2 bins (126×84mm)
  // - Breadboard (half): 84×55mm → 3x2 bins
  // - Jumper wire bundle: varies → 2x3 bins
  const bins = [
    // Development boards - 2x2 bins for Arduino-sized boards
    createBin(0, 0, 2, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Arduino Uno',
    }),
    createBin(2, 0, 2, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Arduino Nano',
    }),
    createBin(4, 0, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'ESP32' }),
    createBin(6, 0, 1, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Wemos D1' }),
    // Raspberry Pi and larger boards
    createBin(0, 2, 3, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Raspberry Pi',
    }),
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
    createBin(0, 6, 2, 3, {
      layerId: layer.id,
      categoryId: categories[3].id,
      label: 'M-M Jumpers',
    }),
    createBin(2, 6, 2, 3, {
      layerId: layer.id,
      categoryId: categories[3].id,
      label: 'M-F Jumpers',
    }),
    createBin(4, 6, 2, 3, {
      layerId: layer.id,
      categoryId: categories[3].id,
      label: 'F-F Jumpers',
    }),
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

function createCraftSupplies(): InspirationLayout {
  const categories = [
    createCategory('Adhesives', '#f87171'),
    createCategory('Cutting', '#38bdf8'),
    createCategory('Misc', '#e2e8f0'),
  ];
  const layer = createLayer('Layer 1', 3);

  const bins = [
    // Adhesives - top row
    createBin(0, 0, 2, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Glue Sticks',
    }),
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
    createBin(0, 0, 2, 6, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Fine Brushes',
      height: 6,
    }),
    createBin(2, 0, 2, 6, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Flat Brushes',
      height: 6,
    }),
    // Markers and pens - 4 units deep (168mm) for standing
    createBin(4, 0, 2, 4, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Markers',
      height: 6,
    }),
    createBin(6, 0, 2, 4, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Pens',
      height: 6,
    }),
    // Pencils and charcoal
    createBin(4, 4, 2, 5, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Pencils',
      height: 6,
    }),
    createBin(6, 4, 2, 5, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Charcoal',
      height: 6,
    }),
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

export const HOBBY_LAYOUTS: InspirationLayout[] = [
  create3DPrintingSupplies(),
  createMakerStation(),
  createCraftSupplies(),
  createArtStation(),
  createSewingKit(),
];
