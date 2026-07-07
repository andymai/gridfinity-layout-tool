import { describe, it, expect } from 'vitest';
import { buildBinMarginStrips } from './binMarginStrips';
import type { MarginStripBin } from './binMarginStrips';
import type { StoredBaseplateParams } from '@/core/types';

function baseplate(overrides: Partial<StoredBaseplateParams> = {}): StoredBaseplateParams {
  return {
    magnetHoles: false,
    magnetDiameter: 6,
    magnetDepth: 2,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 0,
    ...overrides,
  };
}

// Bottom-left 1×1 bin, 2 units tall, in a 5×4 drawer. gridUnitMm 42 → 21mm = 0.5u.
function bin(overrides: Partial<MarginStripBin> = {}): MarginStripBin {
  return { id: 'b1', x: 0, y: 0, z: 0, width: 1, depth: 1, height: 2, ...overrides };
}

const DW = 5;
const DD = 4;
const GRID = 42;

describe('buildBinMarginStrips', () => {
  it('returns nothing when the bin does not extend', () => {
    expect(buildBinMarginStrips(bin(), DW, DD, baseplate({ paddingLeft: 21 }), GRID)).toEqual([]);
  });

  it('returns nothing with no baseplate', () => {
    expect(buildBinMarginStrips(bin({ extendToMargin: true }), DW, DD, undefined, GRID)).toEqual(
      []
    );
  });

  it('returns nothing for an interior bin', () => {
    const strips = buildBinMarginStrips(
      bin({ x: 1, y: 1, extendToMargin: true }),
      DW,
      DD,
      baseplate({ paddingLeft: 21 }),
      GRID
    );
    expect(strips).toEqual([]);
  });

  it('builds one strip for a single padded edge', () => {
    const strips = buildBinMarginStrips(
      bin({ extendToMargin: true }),
      DW,
      DD,
      baseplate({ paddingLeft: 21 }),
      GRID
    );
    expect(strips).toHaveLength(1);
    const [s] = strips;
    // left = 21/42 = 0.5u; strip x spans [-0.5, 0.02], y spans [0, 1], full height 2.
    expect(s.size[0]).toBeCloseTo(0.52, 5);
    expect(s.size[1]).toBeCloseTo(1, 5);
    expect(s.size[2]).toBeCloseTo(2, 5);
    expect(s.position[0]).toBeCloseTo(-0.24, 5);
    expect(s.position[2]).toBeCloseTo(1, 5); // z center = z + height/2
  });

  it('builds two strips for a corner bin, side strip spanning the corner', () => {
    const strips = buildBinMarginStrips(
      bin({ extendToMargin: true }),
      DW,
      DD,
      baseplate({ paddingLeft: 21, paddingFront: 42 }), // left 0.5u, front 1u
      GRID
    );
    expect(strips).toHaveLength(2);
    const left = strips.find((s) => s.key.endsWith('-l'));
    const front = strips.find((s) => s.key.endsWith('-f'));
    // Left strip spans the full extended depth (incl. the front corner): y [-1, 1] → size 2.
    expect(left?.size[1]).toBeCloseTo(2, 5);
    // Front strip fills only the bin width: x [0, 1] → size 1.
    expect(front?.size[0]).toBeCloseTo(1, 5);
    expect(front?.size[1]).toBeCloseTo(1.02, 5);
  });

  it('extends the far edges (right/back)', () => {
    const strips = buildBinMarginStrips(
      bin({ x: 4, y: 3, extendToMargin: true }), // top-right corner
      DW,
      DD,
      baseplate({ paddingRight: 21, paddingBack: 21 }),
      GRID
    );
    expect(strips.map((s) => s.key.slice(-2)).sort()).toEqual(['-b', '-r']);
  });
});
