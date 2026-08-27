import { describe, it, expect } from 'vitest';
import type { Cutout, KnifeSpec } from '@/features/bin-designer/types';
import { knifeSlotOverlayLoops } from './knifeSlotOverlayGeometry';

const KNIFE: KnifeSpec = {
  bladeLengthMm: 190,
  heelHeightMm: 47,
  spineThicknessMm: 2.3,
  handleWidthMm: 30,
  handleHeightMm: 22,
  openEnd: 'end',
};

function knifeSlot(overrides: Partial<Cutout> = {}): Cutout {
  return {
    id: 'k1',
    shape: 'knifeSlot',
    x: 0,
    y: 0,
    width: 200,
    depth: 4,
    cutDepth: 51,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    knife: KNIFE,
    ...overrides,
  };
}

const xs = (loop: readonly (readonly [number, number])[]) => loop.map((p) => p[0]);
const ys = (loop: readonly (readonly [number, number])[]) => loop.map((p) => p[1]);

describe('knifeSlotOverlayLoops', () => {
  it('draws no handle for a non-knife shape', () => {
    expect(knifeSlotOverlayLoops(knifeSlot({ shape: 'slot' }))).toEqual([]);
  });

  it('draws no handle for an enclosed slot', () => {
    const { openEnd: _o, ...enclosed } = KNIFE;
    expect(knifeSlotOverlayLoops(knifeSlot({ knife: enclosed }))).toEqual([]);
  });

  it('draws no handle for an off-axis slot the block cannot let out', () => {
    expect(knifeSlotOverlayLoops(knifeSlot({ rotation: 45 }))).toEqual([]);
  });

  it('draws no handle for a grouped slot, whose breach the builder also skips', () => {
    expect(knifeSlotOverlayLoops(knifeSlot({ groupId: 'g1' }))).toEqual([]);
  });

  it("extends the handle past the open end (+X) with the handle's own width", () => {
    const [loop] = knifeSlotOverlayLoops(knifeSlot());
    // Centre is (100, 2); the +X wall is at x = 100 + 200/2 = 200.
    expect(Math.max(...xs(loop))).toBeGreaterThan(200);
    // Every handle point lies at or past that wall.
    expect(Math.min(...xs(loop))).toBeGreaterThanOrEqual(200 - 1e-6);
    // Its cross-span is the handle width, centred on the slot.
    expect(Math.max(...ys(loop)) - Math.min(...ys(loop))).toBeCloseTo(KNIFE.handleWidthMm, 5);
  });

  it('puts the handle past the start wall (-X) when that end opens', () => {
    const [loop] = knifeSlotOverlayLoops(knifeSlot({ knife: { ...KNIFE, openEnd: 'start' } }));
    expect(Math.min(...xs(loop))).toBeLessThan(0); // past x = 100 - 100 = 0
  });

  it('aims the handle along -Y for a quarter-turn slot', () => {
    const [loop] = knifeSlotOverlayLoops(knifeSlot({ rotation: 90 }));
    // rotation 90 with openEnd 'end' exits the front wall (-Y).
    expect(Math.min(...ys(loop))).toBeLessThan(2 - 200 / 2);
  });
});
