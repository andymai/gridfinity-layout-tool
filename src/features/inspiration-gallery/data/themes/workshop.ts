import type { Layout } from '@/core/types';
import { gridUnits, heightUnits, mm } from '@/core/types';
import type { InspirationLayout } from '../../types';
import {
  createBin,
  createLayer,
  createCategory,
  buildInspirationLayout,
} from '../../utils/layoutBuilder';

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
    createBin(2, 8, 2, 2, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'Wood Screws',
    }),
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
    drawer: { width: gridUnits(7), depth: gridUnits(12), height: heightUnits(6) },
    printBedSize: mm(256),
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
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
    createBin(0, 0, 2, 5, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Needle Nose',
    }),
    createBin(2, 0, 2, 5, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Diagonal Cut',
    }),
    createBin(4, 0, 2, 5, { layerId: layer.id, categoryId: categories[0].id, label: 'Linesman' }),
    createBin(6, 0, 2, 5, { layerId: layer.id, categoryId: categories[0].id, label: 'Slip Joint' }),
    createBin(8, 0, 2, 5, { layerId: layer.id, categoryId: categories[0].id, label: 'Locking' }),
    createBin(10, 0, 3, 5, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Channel Lock',
    }),
    // Row 2: Screwdrivers - 6 units deep (252mm) for standard screwdrivers
    createBin(0, 5, 2, 6, { layerId: layer.id, categoryId: categories[1].id, label: 'Phillips' }),
    createBin(2, 5, 2, 6, { layerId: layer.id, categoryId: categories[1].id, label: 'Flathead' }),
    createBin(4, 5, 2, 6, { layerId: layer.id, categoryId: categories[1].id, label: 'Torx' }),
    createBin(6, 5, 2, 6, { layerId: layer.id, categoryId: categories[1].id, label: 'Hex' }),
    // Wrenches section - right side
    createBin(8, 5, 2, 6, { layerId: layer.id, categoryId: categories[2].id, label: 'Adjustable' }),
    createBin(10, 5, 3, 3, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'Allen Keys',
    }),
    createBin(10, 8, 3, 3, {
      layerId: layer.id,
      categoryId: categories[3].id,
      label: 'Tape/Level',
    }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Hand Tools',
    // Harbor Freight US General 44" tool chest drawer: 568×490mm = 13×11 units
    drawer: { width: gridUnits(13), depth: gridUnits(11), height: heightUnits(6) },
    printBedSize: mm(256),
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
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
    createBin(3, 1, 2, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Transistors',
    }),
    createBin(5, 1, 2, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'ICs' }),
    createBin(0, 2, 3, 2, { layerId: layer.id, categoryId: categories[0].id, label: 'Headers' }),
    // Middle section: Tools (rows 4-7)
    createBin(0, 4, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Tweezers' }),
    createBin(2, 4, 2, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Cutters' }),
    createBin(4, 3, 3, 3, { layerId: layer.id, categoryId: categories[0].id, label: 'Connectors' }),
    createBin(4, 6, 3, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Multimeter' }),
    // Bottom section: Supplies (rows 8-11)
    createBin(0, 8, 2, 4, { layerId: layer.id, categoryId: categories[2].id, label: 'Solder' }),
    createBin(2, 8, 3, 4, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'Wire Spools',
    }),
    createBin(5, 8, 2, 4, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'Heat Shrink',
    }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Electronics Bench',
    // IKEA Alex drawer: 297×525mm = 7×12 units
    drawer: { width: gridUnits(7), depth: gridUnits(12), height: heightUnits(6) },
    printBedSize: mm(256),
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
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
    createBin(0, 0, 3, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: '1/4" Metric',
    }),
    createBin(3, 0, 3, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: '3/8" Metric',
    }),
    createBin(0, 2, 3, 2, { layerId: layer.id, categoryId: categories[0].id, label: '3/8" Deep' }),
    createBin(3, 2, 3, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: '1/2" Metric',
    }),
    // Ratchets - 6 units deep (252mm) for 200-250mm ratchets
    createBin(0, 4, 2, 6, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: '1/4" Ratchet',
    }),
    createBin(2, 4, 2, 6, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: '3/8" Ratchet',
    }),
    createBin(4, 4, 2, 6, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: '1/2" Ratchet',
    }),
    // Accessories - extensions, adapters
    createBin(6, 0, 2, 4, { layerId: layer.id, categoryId: categories[2].id, label: 'Extensions' }),
    createBin(6, 4, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Adapters' }),
    createBin(6, 7, 2, 3, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'Spark Plugs',
    }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Socket Organizer',
    drawer: { width: gridUnits(8), depth: gridUnits(10), height: heightUnits(6) },
    printBedSize: mm(256),
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
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
    tags: ['workshop', 'sockets', 'automotive', 'mechanic'],
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
    createBin(4, 2, 2, 2, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'AA Recharge',
    }),
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
    drawer: { width: gridUnits(6), depth: gridUnits(5), height: heightUnits(6) },
    printBedSize: mm(256),
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
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
    tags: ['workshop', 'batteries', 'electronics', 'storage'],
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
    createBin(0, 0, 2, 3, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'WD-40',
      height: 7,
    }),
    createBin(2, 0, 2, 3, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'PB Blaster',
      height: 7,
    }),
    createBin(4, 0, 2, 3, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Silicone',
      height: 7,
    }),
    createBin(6, 0, 2, 3, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Grease',
      height: 7,
    }),
    createBin(8, 0, 1, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Blue Loctite',
    }),
    createBin(9, 0, 1, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Red Loctite',
    }),
    createBin(10, 0, 1, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Anti-Seize',
    }),
    createBin(11, 0, 2, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Dielectric',
    }),
    // Consumables - tapes, gloves, towels
    createBin(0, 3, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Elec Tape' }),
    createBin(2, 3, 2, 2, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Teflon Tape',
    }),
    createBin(4, 3, 3, 2, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Nitrile Gloves',
    }),
    createBin(7, 3, 3, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Shop Rags' }),
    createBin(10, 3, 3, 2, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Latex Gloves',
    }),
    // Hardware - small automotive parts
    createBin(8, 2, 2, 1, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'Crush Washers',
    }),
    createBin(10, 2, 3, 1, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'Drain Plugs',
    }),
    createBin(0, 5, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'Zip Ties' }),
    createBin(2, 5, 2, 2, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'Hose Clamps',
    }),
    createBin(4, 5, 2, 2, { layerId: layer.id, categoryId: categories[2].id, label: 'O-Rings' }),
    createBin(6, 5, 2, 2, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'Cotter Pins',
    }),
    // Electrical - small components
    createBin(8, 5, 2, 3, { layerId: layer.id, categoryId: categories[3].id, label: 'Fuses' }),
    createBin(10, 5, 2, 3, {
      layerId: layer.id,
      categoryId: categories[3].id,
      label: 'Connectors',
    }),
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
    drawer: { width: gridUnits(13), depth: gridUnits(11), height: heightUnits(12) },
    printBedSize: mm(256),
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
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
    tags: ['workshop', 'garage', 'automotive', 'car', 'tool-chest'],
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
    createBin(0, 4, 2, 5, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Spade Small',
      height: 6,
    }),
    createBin(2, 4, 2, 5, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Spade Large',
      height: 6,
    }),
    // Forstner bits - 2x2 bins for fat bits
    createBin(4, 4, 2, 2, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Forstner 15-25',
    }),
    createBin(4, 6, 2, 2, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Forstner 30-50',
    }),
    // Hole saws - need larger bins for 50-100mm diameter saws
    createBin(0, 9, 3, 3, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'Hole Saw S',
      height: 6,
    }),
    createBin(3, 9, 3, 3, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'Hole Saw L',
      height: 6,
    }),
    // Countersinks and step bits - step bits stored flat (75-100mm long)
    createBin(6, 4, 1, 4, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Countersink',
    }),
    createBin(6, 8, 1, 4, { layerId: layer.id, categoryId: categories[1].id, label: 'Step Bits' }),
  ];

  const layout: Layout = {
    version: '1.0',
    name: 'Drill Bit Organizer',
    // IKEA Alex drawer
    drawer: { width: gridUnits(7), depth: gridUnits(12), height: heightUnits(12) },
    printBedSize: mm(256),
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
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
    tags: ['workshop', 'drill', 'bits', 'woodworking', 'ikea-alex'],
  });
}

export const WORKSHOP_LAYOUTS: InspirationLayout[] = [
  createScrewOrganizer(),
  createToolDrawer(),
  createDrillBitOrganizer(),
  createElectronicsBench(),
  createBatteryDrawer(),
  createSocketOrganizer(),
  createGarageDrawer(),
];
