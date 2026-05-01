/**
 * Shared fixtures for v2 bin command property tests.
 * Internal to cqrs/v2/domain/bin/ — not exported via any barrel.
 */

import type { Bin, Layout } from '@/core/types';
import { binId, layerId, categoryId, gridUnits, heightUnits } from '@/core/types';

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
    layers: [{ id: layerId('layer_1'), name: 'Layer 1', height: heightUnits(3) }],
    bins: [],
    ...overrides,
  };
}

export function makeBin(idStr: string, overrides: Partial<Bin> = {}): Bin {
  return {
    id: binId(idStr),
    layerId: layerId('layer_1'),
    x: gridUnits(0),
    y: gridUnits(0),
    width: gridUnits(1),
    depth: gridUnits(1),
    height: heightUnits(3),
    category: categoryId('cat_1'),
    label: '',
    notes: '',
    ...overrides,
  };
}
