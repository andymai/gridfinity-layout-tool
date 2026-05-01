/**
 * Shared fixtures for v2 library command property tests.
 */

import type { LayoutEntry, LayoutLibrary } from '@/core/types';
import { layoutId } from '@/core/types';

export function makeEntry(idStr: string, name = idStr): LayoutEntry {
  return {
    id: layoutId(idStr),
    name,
    createdAt: 1000,
    modifiedAt: 1000,
    preview: {
      drawerWidth: 6,
      drawerDepth: 4,
      drawerHeight: 7,
      binCount: 0,
      layerCount: 1,
    } as LayoutEntry['preview'],
  };
}

export function makeLibrary(overrides: Partial<LayoutLibrary> = {}): LayoutLibrary {
  return {
    version: '1.0',
    activeLayoutId: layoutId('layout_1'),
    settings: {},
    entries: [makeEntry('layout_1')],
    ...overrides,
  };
}
