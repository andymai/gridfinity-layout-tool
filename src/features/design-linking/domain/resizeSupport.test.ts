import { describe, it, expect, afterEach } from 'vitest';
import { createTestBin, createTestLayout } from '@/test/testUtils';
import { binId, designId, gridUnits, heightUnits } from '@/core/types';
import type { Bin } from '@/core/types';
import { registerLinkedSlantResolver } from '@/shared/utils/placedSlant';
import { resizeBlockedBySupport, resizeOrder } from './resizeSupport';

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

  // The resized bin already stands at the new size, and the cascade gives it to
  // every unlocked sibling; a locked one keeps its footprint and reserves from it.
  it.each([
    ['refuses', 'an unlocked sibling', false],
    ['allows', 'a locked sibling', true],
  ])('%s a resize by where %s will stand after it', (verdict, _what, locked) => {
    registerLinkedSlantResolver(() => ({ config: BACK, width: 2, depth: 1, height: 6 }));
    const growing = createTestLayout({
      drawer: { width: gridUnits(8), depth: gridUnits(8), height: heightUnits(20) },
      bins: [
        { ...linked('resized', 0), depth: gridUnits(2) },
        { ...linked('sibling', 3), locked },
        createTestBin({
          id: binId('behind'),
          x: gridUnits(3),
          y: gridUnits(2),
          width: gridUnits(2),
        }),
      ],
    });
    const blocked = resizeBlockedBySupport(growing, DESIGN, { width: 2, depth: 2, height: 6 });
    if (verdict === 'allows') expect(blocked).toBeNull();
    else
      expect(blocked).toMatchObject({
        bin: { id: 'sibling' },
        result: { valid: false, reason: 'collision', blockingInfo: { binId: 'behind' } },
      });
  });

  it("allows a resize whose taller support only reaches a sibling's old footprint", () => {
    registerLinkedSlantResolver(() => ({ config: BACK, width: 3, depth: 1, height: 6 }));
    const shrinking = createTestLayout({
      drawer: { width: gridUnits(8), depth: gridUnits(8), height: heightUnits(20) },
      bins: [
        { ...linked('resized', 2), width: gridUnits(1), height: heightUnits(12) },
        { ...linked('sibling', 0), y: gridUnits(2), width: gridUnits(3) },
      ],
    });
    expect(
      resizeBlockedBySupport(shrinking, DESIGN, { width: 1, depth: 1, height: 12 })
    ).toBeNull();
  });

  // One sibling that cannot take the new size stops the whole cascade, so every
  // sibling keeps the footprint its taller support is then checked from.
  it('checks siblings where they stand when the cascade cannot run', () => {
    registerLinkedSlantResolver(() => ({ config: BACK, width: 3, depth: 1, height: 6 }));
    const stuck = createTestLayout({
      drawer: { width: gridUnits(8), depth: gridUnits(8), height: heightUnits(20) },
      bins: [
        {
          ...linked('resized', 0),
          width: gridUnits(1),
          depth: gridUnits(2),
          height: heightUnits(12),
        },
        { ...linked('wide', 3), width: gridUnits(3) },
        { ...linked('edge', 5), y: gridUnits(7), width: gridUnits(3) },
        createTestBin({ id: binId('aside'), x: gridUnits(5), y: gridUnits(2) }),
      ],
    });
    expect(resizeBlockedBySupport(stuck, DESIGN, { width: 1, depth: 2, height: 12 })).toMatchObject(
      {
        bin: { id: 'wide' },
        result: { valid: false, reason: 'collision', blockingInfo: { binId: 'aside' } },
      }
    );
  });

  // Resizing a bin drops the overhang it set for its old footprint, which is
  // what held it upright.
  it('checks a sibling as the resize leaves it, without the overhang that held it upright', () => {
    registerLinkedSlantResolver(() => ({ config: BACK, width: 2, depth: 1, height: 6 }));
    const overhung = createTestLayout({
      drawer: { width: gridUnits(8), depth: gridUnits(8), height: heightUnits(20) },
      bins: [
        { ...linked('resized', 0), depth: gridUnits(2) },
        { ...linked('sibling', 3), overhang: { left: 5, right: 0, front: 0, back: 0 } },
        createTestBin({
          id: binId('behind'),
          x: gridUnits(3),
          y: gridUnits(2),
          width: gridUnits(2),
        }),
      ],
    });
    expect(
      resizeBlockedBySupport(overhung, DESIGN, { width: 2, depth: 2, height: 6 })
    ).toMatchObject({ bin: { id: 'sibling' }, result: { valid: false, reason: 'collision' } });
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

  // Made 1x3, `ahead` stands its support where `behind` is until `behind` narrows.
  it('resizes a placement after the sibling whose cells its support needs', () => {
    registerLinkedSlantResolver(() => ({ config: BACK, width: 1, depth: 3, height: 6 }));
    const ahead = { ...linked('ahead', 1), height: heightUnits(6) };
    const behind = { ...linked('behind', 0), y: gridUnits(3) };
    const row = createTestLayout({
      drawer: { width: gridUnits(8), depth: gridUnits(8), height: heightUnits(20) },
      bins: [ahead, behind],
    });
    const order = resizeOrder([ahead, behind], { width: 1, depth: 3, height: 6 }, row);
    expect(order.map((b) => b.id)).toEqual(['behind', 'ahead']);
  });
});
