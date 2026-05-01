/**
 * Shared fixtures for v2 category command property tests.
 */

import type { Bin, Category, Layout } from '@/core/types';
import { binId, layerId, categoryId, gridUnits, heightUnits } from '@/core/types';

export function makeCategory(idStr: string, name = idStr, color = '#808080'): Category {
  return { id: categoryId(idStr), name, color };
}

export function makeBin(idStr: string, catId: string): Bin {
  return {
    id: binId(idStr),
    layerId: layerId('layer_1'),
    x: gridUnits(0),
    y: gridUnits(0),
    width: gridUnits(1),
    depth: gridUnits(1),
    height: heightUnits(3),
    category: categoryId(catId),
    label: '',
    notes: '',
  };
}

export function makeLayout(overrides: Partial<Layout> = {}): Layout {
  return {
    version: '1.0',
    name: 'Test',
    drawer: {
      width: gridUnits(6),
      depth: gridUnits(4),
      height: heightUnits(7),
    },
    printBedSize: 256 as Layout['printBedSize'],
    gridUnitMm: 42 as Layout['gridUnitMm'],
    heightUnitMm: 7 as Layout['heightUnitMm'],
    categories: [makeCategory('cat_1', 'Default')],
    layers: [{ id: layerId('layer_1'), name: 'L1', height: heightUnits(3) }],
    bins: [],
    ...overrides,
  };
}
