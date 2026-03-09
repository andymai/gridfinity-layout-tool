import type { Layout } from '@/core/types';
import { gridUnits, heightUnits, mm } from '@/core/types';
import type { InspirationLayout } from '../../types';
import {
  createBin,
  createLayer,
  createCategory,
  buildInspirationLayout,
} from '../../utils/layoutBuilder';

function createCutleryDrawer(): InspirationLayout {
  // Standard kitchen cutlery drawer: ~450mm wide x 400mm deep (11x10 units)
  const categories = [createCategory('Silverware', '#94a3b8'), createCategory('Small', '#38bdf8')];
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
    drawer: { width: gridUnits(11), depth: gridUnits(10), height: heightUnits(6) },
    printBedSize: mm(256),
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
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
    createBin(0, 2, 8, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Wooden Spoons',
    }),
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
    drawer: { width: gridUnits(13), depth: gridUnits(11), height: heightUnits(6) },
    printBedSize: mm(256),
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
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
    createBin(0, 0, 6, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: "Chef's Knife",
    }),
    createBin(0, 2, 6, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Bread Knife',
    }),
    createBin(0, 4, 6, 2, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Carving Knife',
    }),
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
    drawer: { width: gridUnits(8), depth: gridUnits(10), height: heightUnits(12) },
    printBedSize: mm(256),
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
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
    tags: ['kitchen', 'knives', 'safety', 'labeled'],
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
    createBin(1.5, 0, 1.5, 1.5, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Pepper',
    }),
    createBin(3, 0, 1.5, 1.5, { layerId: layer.id, categoryId: categories[0].id, label: 'Garlic' }),
    createBin(4.5, 0, 1.5, 1.5, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Onion',
    }),
    createBin(6, 0, 1.5, 1.5, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Paprika',
    }),
    createBin(7.5, 0, 1.5, 1.5, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Cumin',
    }),
    createBin(9, 0, 1, 1.5, { layerId: layer.id, categoryId: categories[0].id, label: 'Chili' }),
    // Second row
    createBin(0, 1.5, 1.5, 1.5, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Oregano',
    }),
    createBin(1.5, 1.5, 1.5, 1.5, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Basil',
    }),
    createBin(3, 1.5, 1.5, 1.5, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Thyme',
    }),
    createBin(4.5, 1.5, 1.5, 1.5, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Rosemary',
    }),
    createBin(6, 1.5, 1.5, 1.5, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Parsley',
    }),
    createBin(7.5, 1.5, 1.5, 1.5, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Dill',
    }),
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
    drawer: { width: gridUnits(10), depth: gridUnits(7), height: heightUnits(6) },
    printBedSize: mm(256),
    gridUnitMm: mm(42),
    heightUnitMm: mm(7),
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
    tags: ['kitchen', 'spices', 'cooking', 'half-bins'],
  });
}

export const KITCHEN_LAYOUTS: InspirationLayout[] = [
  createCutleryDrawer(),
  createCookingUtensils(),
  createKnifeDrawer(),
  createSpiceDrawer(),
];
