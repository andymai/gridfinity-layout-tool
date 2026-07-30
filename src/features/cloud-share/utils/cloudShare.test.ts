import { describe, it, expect } from 'vitest';
import { createLayoutFingerprint } from './cloudShare';
import { createTestLayout } from '@/test/testUtils';
import { mm } from '@/core/types';

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
