import { describe, it, expect } from 'vitest';
import type { CellInfo } from './cellDecomposition';
import { keepFootHolesOffFlank, magnetPositionsForCell, socketFootHoles } from './magnetPositions';

const PITCH = 42;
const FULL: CellInfo = { centerX: -21, centerY: 0, widthUnits: 1, depthUnits: 1 };

describe('keepFootHolesOffFlank', () => {
  it('returns the very same coordinates when every hole keeps its wall', () => {
    const spec = magnetPositionsForCell(FULL, 3.25, PITCH, PITCH);
    const kept = keepFootHolesOffFlank(spec, FULL, 3.25, PITCH, PITCH);
    kept.forEach(([x, y], i) => {
      expect(Object.is(x, spec[i][0])).toBe(true);
      expect(Object.is(y, spec[i][1])).toBe(true);
    });
  });

  it('pulls every corner of a foot in by the same amount, around its centre', () => {
    const spec = magnetPositionsForCell(FULL, 5, PITCH, PITCH);
    const kept = keepFootHolesOffFlank(spec, FULL, 5, PITCH, PITCH);
    const rounded = kept.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100]);
    expect(rounded).toEqual([
      [-33.4, -12.4],
      [-8.6, -12.4],
      [-8.6, 12.4],
      [-33.4, 12.4],
    ]);
  });

  it("keeps a half foot's centred hole centred and pulls it in on the full axis", () => {
    const half: CellInfo = { centerX: 21, centerY: 0, widthUnits: 0.5, depthUnits: 1 };
    const kept = keepFootHolesOffFlank([[21, 13]], half, 5, PITCH, PITCH);
    expect(kept[0][0]).toBe(21);
    expect(kept[0][1]).toBeCloseTo(12.4, 9);
  });
});

describe('socketFootHoles with corner-only holes', () => {
  // The half foot of a 1.5x1 bin, on its +X edge.
  const HALF: CellInfo = { centerX: 21, centerY: 0, widthUnits: 0.5, depthUnits: 1 };
  const holesOf = (magnetRadius: number, screwRadius: number, chamfer: boolean) =>
    socketFootHoles(HALF, {
      magnetRadius,
      screwRadius,
      chamfer,
      pitchX: PITCH,
      pitchY: PITCH,
      anchor: undefined,
      cornersOf: { width: 1.5, depth: 1 },
    }).positions;

  it('moves the corner of a screw wider than the chamfered magnet mouth', () => {
    // The 3mm screw bore is the widest mouth: the magnet's chamfer opens to
    // only 2.8mm, inside it. The underside keeps 7.3 - 2.5 - 3 = 1.8mm.
    expect(holesOf(2, 3, true)).toEqual([
      [23.5, -13],
      [23.5, 13],
    ]);
  });

  it('still centres the hole when the chamfered magnet mouth is the widest', () => {
    expect(holesOf(3.25, 1.5, true)).toEqual([
      [21, -13],
      [21, 13],
    ]);
  });
});
