import { describe, it, expect } from 'vitest';
import { createLayoutFingerprint, isOwnedShare } from './cloudShare';
import { createTestLayout } from '@/test/testUtils';
import { mm, layoutId } from '@/core/types';
import type { LayoutEntry } from '@/core/types';

describe('createLayoutFingerprint', () => {
  it('produces different fingerprints when printBedSize changes', () => {
    const layout1 = createTestLayout({ printBedSize: mm(256) });
    const layout2 = createTestLayout({ printBedSize: mm(180) });
    expect(createLayoutFingerprint(layout1)).not.toBe(createLayoutFingerprint(layout2));
  });

  it('produces different fingerprints when gridUnitMm changes', () => {
    const layout1 = createTestLayout({ gridUnitMm: mm(42) });
    const layout2 = createTestLayout({ gridUnitMm: mm(35) });
    expect(createLayoutFingerprint(layout1)).not.toBe(createLayoutFingerprint(layout2));
  });

  it('produces different fingerprints when heightUnitMm changes', () => {
    const layout1 = createTestLayout({ heightUnitMm: mm(7) });
    const layout2 = createTestLayout({ heightUnitMm: mm(5) });
    expect(createLayoutFingerprint(layout1)).not.toBe(createLayoutFingerprint(layout2));
  });

  it('produces different fingerprints when purpose changes', () => {
    const layout1 = createTestLayout({ purpose: 'workshop' });
    const layout2 = createTestLayout({ purpose: 'electronics' });
    expect(createLayoutFingerprint(layout1)).not.toBe(createLayoutFingerprint(layout2));
  });
});

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
