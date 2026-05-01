/**
 * Shared fixtures for v2 drawer command property tests.
 */

import type { Bin, Layout } from '@/core/types';
import { binId, layerId, categoryId, gridUnits, heightUnits } from '@/core/types';

export function makeBin(idStr: string, x: number, y: number, lid = 'layer_1'): Bin {
  return {
    id: binId(idStr),
    layerId: layerId(lid),
    x: gridUnits(x),
    y: gridUnits(y),
    width: gridUnits(1),
    depth: gridUnits(1),
    height: heightUnits(3),
    category: categoryId('cat_1'),
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
    categories: [{ id: categoryId('cat_1'), name: 'Default', color: '#808080' }],
    layers: [{ id: layerId('layer_1'), name: 'L1', height: heightUnits(3) }],
    bins: [],
    ...overrides,
  };
}
