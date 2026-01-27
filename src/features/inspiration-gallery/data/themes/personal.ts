import type { Layout } from '@/core/types';
import type { InspirationLayout } from '../../types';
import {
  createBin,
  createLayer,
  createCategory,
  buildInspirationLayout,
} from '../../utils/layoutBuilder';

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
    createBin(0, 0, 2, 5, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Face Brushes',
    }),
    createBin(2, 0, 2, 5, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Eye Brushes',
    }),
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
    tags: ['bedroom', 'nightstand', 'personal', 'simple'],
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
    createBin(2, 2, 2, 2, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Pain Relief',
    }),
    createBin(4, 2, 2, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Allergy' }),
    createBin(6, 2, 1, 2, { layerId: layer.id, categoryId: categories[1].id, label: 'Antacid' }),
    // Ointments and tools
    createBin(0, 4, 2, 3, { layerId: layer.id, categoryId: categories[1].id, label: 'Ointments' }),
    createBin(2, 4, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Scissors' }),
    createBin(4, 4, 2, 3, { layerId: layer.id, categoryId: categories[2].id, label: 'Tweezers' }),
    createBin(6, 4, 1, 3, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'Thermometer',
    }),
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
    tags: ['personal', 'jewelry', 'accessories', 'organization'],
  });
}

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
    createBin(4, 0, 3, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Pocket Knife',
    }),
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
    tags: ['personal', 'edc', 'keys', 'wallet', 'everyday'],
  });
}

export const PERSONAL_LAYOUTS: InspirationLayout[] = [
  createBathroomMakeup(),
  createNightstandDrawer(),
  createFirstAidKit(),
  createJewelryDrawer(),
  createEDCDrawer(),
];
