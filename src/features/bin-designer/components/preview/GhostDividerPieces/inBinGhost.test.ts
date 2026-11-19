import { describe, expect, it } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { calculateDividerLength, getEffectiveSlotDimensions } from '@/shared/utils/slotMath';
import { dividerFilletSeat } from '@/shared/utils/slottedFillet';
import { inBinGhostGeometry, slotSegments } from './inBinGhost';
import type { InBinGhostInput } from './inBinGhost';

const INNER = 81.1;
const HEIGHT = 30;

function input(over: Partial<InBinGhostInput> = {}): InBinGhostInput {
  return {
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      x: { enabled: true, pitch: 40 },
      y: { enabled: false, pitch: 40 },
    },
    dividerPieces: DEFAULT_BIN_PARAMS.dividerPieces,
    dividerHeight: HEIGHT,
    wallThickness: 1.2,
    innerW: INNER,
    innerD: INNER,
    offsetX: 0,
    offsetY: 0,
    floorZ: 0,
    lipOverhang: 1.4,
    filletSeat: null,
    shape: 'u-shape',
    ...over,
  };
}

/** Every vertex as (x, z), the piece running along X at the cavity centre. */
function points(geometry: ReturnType<typeof inBinGhostGeometry>): [number, number][] {
  if (!geometry) throw new Error('no ghost');
  const pos = geometry.getAttribute('position');
  const out: [number, number][] = [];
  for (let i = 0; i < pos.count; i++) out.push([pos.getX(i), pos.getZ(i)]);
  return out;
}

describe('slotSegments', () => {
  it('splits a span into the gaps between crossing dividers', () => {
    expect(slotSegments([0], 10, 2)).toEqual([
      { center: -3, len: 4 },
      { center: 3, len: 4 },
    ]);
  });
});

describe('inBinGhostGeometry', () => {
  const { thickness, clearance } = DEFAULT_BIN_PARAMS.dividerPieces;
  const { slotDepth } = getEffectiveSlotDimensions(1.2, thickness, clearance);
  const half = calculateDividerLength(INNER, slotDepth, clearance) / 2;

  it('places a square piece without a fillet', () => {
    const list = points(inBinGhostGeometry(input()));
    expect(list.some(([x, z]) => Math.abs(x + half) < 1e-4 && Math.abs(z) < 1e-4)).toBe(true);
  });

  it('rounds both bottom corners of a wall-to-wall piece over a fillet', () => {
    const seat = dividerFilletSeat(2.45, slotDepth, 0.8, clearance);
    const list = points(inBinGhostGeometry(input({ filletSeat: seat })));
    const r = seat?.cornerRadius ?? 0;
    for (const sign of [-1, 1]) {
      const cx = sign * (half - r);
      const outside = list.some(
        ([x, z]) => sign * x > sign * cx && z < r && Math.hypot(x - cx, z - r) > r + 1e-4
      );
      expect(outside).toBe(false);
    }
  });
});
