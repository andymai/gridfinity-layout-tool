import { describe, it, expect } from 'vitest';
import { isOwnedShare } from './cloudShare';
import { layoutId } from '@/core/types';
import type { LayoutEntry } from '@/core/types';

describe('isOwnedShare', () => {
  const entry = (id: string, shareId?: string): LayoutEntry =>
    ({
      id: layoutId(id),
      name: id,
      createdAt: 0,
      modifiedAt: 0,
      preview: { drawerWidth: 1, drawerDepth: 1, drawerHeight: 1, binCount: 0, layerCount: 1 },
      cloudShare: shareId
        ? { id: shareId, deleteToken: 't', sharedAt: 0, permission: 'view' }
        : undefined,
    }) as LayoutEntry;

  it('owns a share whose id is the layout id', () => {
    expect(isOwnedShare([entry('layoutAAAAAA')], 'layoutAAAAAA')).toBe(true);
  });

  it('owns a share a layout re-shared under a fresh id', () => {
    expect(isOwnedShare([entry('staleLayout1', 'freshShare01')], 'freshShare01')).toBe(true);
  });

  it("does not own someone else's share", () => {
    expect(isOwnedShare([entry('staleLayout1', 'freshShare01')], 'otherShare01')).toBe(false);
  });
});
