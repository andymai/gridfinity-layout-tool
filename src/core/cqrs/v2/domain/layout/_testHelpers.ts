/**
 * Shared fixtures for v2 layout-metadata command property tests.
 */

import type { Layout } from '@/core/types';
import { layerId, categoryId, gridUnits, heightUnits } from '@/core/types';

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
