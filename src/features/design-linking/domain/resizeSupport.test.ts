import { describe, it, expect, afterEach } from 'vitest';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { binId, designId, gridUnits, heightUnits } from '@/core/types';
import type { Bin } from '@/core/types';
import { registerLinkedSlantResolver } from '@/shared/utils/placedSlant';
import { resizeBlockedBySupport } from './resizeSupport';

const DESIGN = designId('d1');
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
    expect(resizeBlockedBySupport(layout, DESIGN, 12, binId('resized'))).toMatchObject({
      bin: { id: 'sibling' },
      result: { valid: false, reason: 'collision' },
    });
  });

  it('lets a resize through when every support still fits, or none grows', () => {
    registerLinkedSlantResolver(() => ({ config: BACK, width: 2, depth: 1, height: 6 }));
    expect(resizeBlockedBySupport(layout, DESIGN, 6, binId('resized'))).toBeNull();
    expect(resizeBlockedBySupport(layout, DESIGN, 12, binId('sibling'))).toBeNull();
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
    expect(resizeBlockedBySupport(facing, DESIGN, 6, binId('resized'))).toBeNull();
    expect(resizeBlockedBySupport(facing, DESIGN, 12, binId('resized'))).toMatchObject({
      result: { valid: false, reason: 'collision' },
    });
  });
});
