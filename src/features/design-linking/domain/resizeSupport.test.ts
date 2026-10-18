import { describe, it, expect, afterEach } from 'vitest';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { binId, designId, gridUnits, heightUnits } from '@/core/types';
import type { Bin } from '@/core/types';
import { registerLinkedSlantResolver } from '@/shared/utils/placedSlant';
import { resizeBlockedBySupport } from './resizeSupport';

const DESIGN = designId('d1');
const size = (height: number) => ({ width: 2, depth: 1, height });
const BACK = { angleDeg: 45, side: 'back' as const, endSupport: true };

const linked = (id: string, x: number): Bin =>
  createTestBin({
    id: binId(id),
    x: gridUnits(x),
    width: gridUnits(2),
    height: heightUnits(6),
    linkedDesignId: DESIGN,
  });

const layout = createTestLayout({
  drawer: { width: gridUnits(8), depth: gridUnits(8), height: heightUnits(20) },
  bins: [
    linked('resized', 0),
    linked('sibling', 3),
    createTestBin({ id: binId('behind'), x: gridUnits(3), y: gridUnits(2), width: gridUnits(2) }),
  ],
});

afterEach(() => {
  registerLinkedSlantResolver(null);
});

describe('resizeBlockedBySupport', () => {
  it('names a placement whose support the taller design would grow onto a bin', () => {
    registerLinkedSlantResolver(() => ({ config: BACK, width: 2, depth: 1, height: 6 }));
    expect(resizeBlockedBySupport(layout, DESIGN, size(12))).toMatchObject({
      bin: { id: 'sibling' },
      result: { valid: false, reason: 'collision' },
    });
  });

  it('lets a resize through when every support still fits', () => {
    registerLinkedSlantResolver(() => ({ config: BACK, width: 2, depth: 1, height: 6 }));
    expect(resizeBlockedBySupport(layout, DESIGN, size(6))).toBeNull();
    const roomy = { ...layout, bins: layout.bins.filter((b) => b.id !== 'behind') };
    expect(resizeBlockedBySupport(roomy, DESIGN, size(12))).toBeNull();
  });

  it('refuses two supports that would grow into each other', () => {
    registerLinkedSlantResolver(() => ({ width: 2, depth: 1, height: 6 }));
    const facing = createTestLayout({
      drawer: { width: gridUnits(8), depth: gridUnits(8), height: heightUnits(20) },
      bins: [
        linked('resized', 5),
        { ...linked('back', 0), slant: BACK },
        { ...linked('front', 0), y: gridUnits(4), slant: { ...BACK, side: 'front' as const } },
      ],
    });
    expect(resizeBlockedBySupport(facing, DESIGN, size(6))).toBeNull();
    expect(resizeBlockedBySupport(facing, DESIGN, size(12))).toMatchObject({
      result: { valid: false, reason: 'collision' },
    });
  });

  // A 2x1 design placed as 1x2 stands turned, leaning left; resized to 1x2 it
  // stands as designed, leaning back.
  it('follows a placement whose support the new size turns', () => {
    registerLinkedSlantResolver(() => ({ config: BACK, width: 2, depth: 1, height: 6 }));
    const turned = createTestLayout({
      drawer: { width: gridUnits(8), depth: gridUnits(8), height: heightUnits(20) },
      bins: [
        { ...linked('turned', 2), width: gridUnits(1), depth: gridUnits(2) },
        createTestBin({ id: binId('behind'), x: gridUnits(2), y: gridUnits(2) }),
      ],
    });
    expect(resizeBlockedBySupport(turned, DESIGN, { width: 2, depth: 1, height: 6 })).toBeNull();
    expect(resizeBlockedBySupport(turned, DESIGN, { width: 1, depth: 2, height: 6 })).toMatchObject(
      {
        bin: { id: 'turned' },
        result: { valid: false, reason: 'collision', blockingInfo: { binId: 'behind' } },
      }
    );
  });
});
