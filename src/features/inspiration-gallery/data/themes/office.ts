import type { Layout } from '@/core/types';
import type { InspirationLayout } from '../../types';
import {
  createBin,
  createLayer,
  createCategory,
  buildInspirationLayout,
} from '../../utils/layoutBuilder';

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
    createBin(2, 4, 2, 5, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'Letter Opener',
    }),
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
    createBin(0, 10, 4, 2, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'Tape & Glue',
    }),
    createBin(4, 9, 3, 3, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'Sticky Notes',
    }),
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
    createBin(0, 0, 3, 3, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'USB-C',
      height: 6,
    }),
    createBin(3, 0, 3, 3, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Lightning',
      height: 6,
    }),
    createBin(6, 0, 3, 3, {
      layerId: layer.id,
      categoryId: categories[0].id,
      label: 'Micro USB',
      height: 6,
    }),
    // Power cables
    createBin(0, 3, 4, 3, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Power Cables',
      height: 6,
    }),
    createBin(4, 3, 3, 3, {
      layerId: layer.id,
      categoryId: categories[1].id,
      label: 'Extension',
      height: 6,
    }),
    // Audio/Video
    createBin(7, 3, 2, 3, {
      layerId: layer.id,
      categoryId: categories[2].id,
      label: 'HDMI',
      height: 6,
    }),
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

export const OFFICE_LAYOUTS: InspirationLayout[] = [createCableDrawer(), createDeskDrawer()];
