import { describe, it, expect } from 'vitest';
import type { MagnetAnchor } from '@/core/types';
import { DESIGNER_CONSTRAINTS } from '@/shared/constants/bin';
import { outerCornerHoleFilter } from './cornerHoles';
import { forEachCell } from './cellDecomposition';
import {
  cellHostsAttachmentHoles,
  cornerHoleCandidates,
  magnetPositionsForCell,
} from './magnetPositions';

const PITCH = 42;
const RADIUS = 3.1;

function binHoles(
  width: number,
  depth: number,
  skip: (col: number, row: number) => boolean = () => false
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  forEachCell(
    width,
    depth,
    (cell) => {
      const col = Math.floor((cell.centerX + (width * PITCH) / 2) / PITCH);
      const row = Math.floor((cell.centerY + (depth * PITCH) / 2) / PITCH);
      if (skip(col, row)) return;
      if (!cellHostsAttachmentHoles(cell, RADIUS, PITCH, PITCH)) return;
      out.push(...magnetPositionsForCell(cell, RADIUS, PITCH, PITCH));
    },
    { gridUnitMm: PITCH }
  );
  return out;
}

function corners(holes: Array<[number, number]>): Array<[number, number]> {
  const keep = outerCornerHoleFilter(holes);
  return holes.filter(keep).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

describe('outerCornerHoleFilter', () => {
  it('keeps the four outermost holes of a rectangular bin', () => {
    const holes = binHoles(3, 2);
    expect(holes).toHaveLength(24);
    expect(corners(holes)).toEqual([
      [-55, -34],
      [-55, 34],
      [55, -34],
      [55, 34],
    ]);
  });

  it('keeps all four holes of a 1x1 bin', () => {
    const holes = binHoles(1, 1);
    expect(corners(holes)).toHaveLength(4);
  });

  it('keeps the five convex corners of an L-shaped bin', () => {
    const holes = binHoles(2, 2, (col, row) => col === 1 && row === 1);
    expect(holes).toHaveLength(12);
    expect(corners(holes)).toEqual([
      [-34, -34],
      [-34, 34],
      [-8, 34],
      [34, -34],
      [34, -8],
    ]);
  });

  it('keeps the two end holes of a strip whose holes line up', () => {
    const holes: Array<[number, number]> = [
      [0, -42],
      [0, -16],
      [0, 16],
      [0, 42],
    ];
    expect(corners(holes)).toEqual([
      [0, -42],
      [0, 42],
    ]);
  });

  it('keeps a single hole and a pair unchanged', () => {
    expect(corners([[1, 2]])).toEqual([[1, 2]]);
    expect(
      corners([
        [0, 0],
        [5, 0],
      ])
    ).toEqual([
      [0, 0],
      [5, 0],
    ]);
  });

  it('keeps the outer corners of a half-unit bin', () => {
    const holes = binHoles(1.5, 1.5);
    const kept = corners(holes);
    expect(kept).toHaveLength(4);
    const xs = holes.map(([x]) => x);
    const ys = holes.map(([, y]) => y);
    for (const [x, y] of kept) {
      expect([Math.min(...xs), Math.max(...xs)]).toContain(x);
      expect([Math.min(...ys), Math.max(...ys)]).toContain(y);
    }
  });

  it('treats a duplicated hole as one site', () => {
    const holes = binHoles(2, 1);
    expect(corners([...holes, ...holes])).toHaveLength(8);
    expect(holes.filter(outerCornerHoleFilter([...holes, ...holes]))).toHaveLength(4);
  });
});

describe('cornerHoleCandidates', () => {
  interface Options {
    readonly pitch?: number;
    readonly anchor?: MagnetAnchor;
    readonly edgeX?: 'start' | 'end';
    readonly radius?: number;
    readonly chamfer?: boolean;
  }

  function cornerSites(width: number, depth: number, opts: Options = {}): string[] {
    const pitch = opts.pitch ?? PITCH;
    const radius = opts.radius ?? RADIUS;
    const chamfer = opts.chamfer ?? false;
    const holes: Array<[number, number]> = [];
    forEachCell(
      width,
      depth,
      (cell) => {
        if (!cellHostsAttachmentHoles(cell, radius, pitch, pitch)) return;
        holes.push(
          ...cornerHoleCandidates(cell, radius, pitch, pitch, opts.anchor, width, depth, chamfer)
        );
      },
      { gridUnitMm: pitch, fractionalEdgeX: opts.edgeX }
    );
    return corners(holes).map(([x, y]) => `${x},${y}`);
  }

  it('keeps every corner of a 1.5x1 bin 8mm from its edge', () => {
    expect(cornerSites(1.5, 1)).toEqual(['-23.5,-13', '-23.5,13', '23.5,-13', '23.5,13']);
  });

  it('keeps every corner of a 2.5x2.5 bin 8mm from its edge', () => {
    expect(cornerSites(2.5, 2.5)).toEqual(['-44.5,-44.5', '-44.5,44.5', '44.5,-44.5', '44.5,44.5']);
  });

  it('mirrors the corners when the half foot leads', () => {
    expect(cornerSites(1.5, 1, { edgeX: 'start' })).toEqual(cornerSites(1.5, 1));
  });

  it('centres the hole of a bin only half a unit wide', () => {
    expect(cornerSites(0.5, 1)).toEqual(['0,-13', '0,13']);
  });

  it('follows the full foot inset on a wider grid and under either anchor', () => {
    // 'edge' holds 8mm from the cell edge at any pitch; 'center' holds 13mm
    // from the cell centre, which is 12mm from the edge of a 50mm cell.
    expect(cornerSites(1.5, 1, { pitch: 50 })).toEqual([
      '-29.5,-17',
      '-29.5,17',
      '29.5,-17',
      '29.5,17',
    ]);
    expect(cornerSites(1.5, 1, { pitch: 50, anchor: 'center' })).toEqual([
      '-25.5,-13',
      '-25.5,13',
      '25.5,-13',
      '25.5,13',
    ]);
  });

  it('leaves a full cell, and a cell inside the bin, on their own holes', () => {
    const full = { widthUnits: 1, depthUnits: 1, centerX: -10.5, centerY: 0 };
    expect(cornerHoleCandidates(full, RADIUS, PITCH, PITCH, undefined, 1.5, 1, false)).toEqual(
      magnetPositionsForCell(full, RADIUS, PITCH, PITCH)
    );
    const inner = { widthUnits: 0.5, depthUnits: 1, centerX: 0, centerY: 0 };
    expect(cornerHoleCandidates(inner, RADIUS, PITCH, PITCH, undefined, 1.5, 1, false)).toEqual(
      magnetPositionsForCell(inner, RADIUS, PITCH, PITCH)
    );
  });

  describe("when a borrowed hole would not keep its wall to the foot's underside", () => {
    // The half foot's underside ends 3.2mm inside its cell, so a hole 8mm from
    // the bin's edge leaves 4.8mm minus its mouth radius there.
    const LARGEST_RADIUS = DESIGNER_CONSTRAINTS.MAX_MAGNET_DIAMETER / 2;
    const CENTRED = ['-23.5,-13', '-23.5,13', '21,-13', '21,13'];

    it('keeps the centred hole of the largest magnet', () => {
      expect(cornerSites(1.5, 1, { radius: LARGEST_RADIUS })).toEqual(CENTRED);
      const halfFoot = { widthUnits: 0.5, depthUnits: 1, centerX: 21, centerY: 0 };
      expect(
        cornerHoleCandidates(halfFoot, LARGEST_RADIUS, PITCH, PITCH, undefined, 1.5, 1, false)
      ).toEqual(magnetPositionsForCell(halfFoot, LARGEST_RADIUS, PITCH, PITCH));
    });

    it('keeps the centred hole when the chamfer widens its mouth', () => {
      expect(cornerSites(1.5, 1)).not.toEqual(CENTRED);
      expect(cornerSites(1.5, 1, { chamfer: true })).toEqual(CENTRED);
    });

    it('keeps the centred hole of a half foot on the leading edge', () => {
      expect(cornerSites(1.5, 1, { radius: LARGEST_RADIUS, edgeX: 'start' })).toEqual([
        '-21,-13',
        '-21,13',
        '23.5,-13',
        '23.5,13',
      ]);
    });

    it('keeps the centred hole of a half-unit corner foot', () => {
      expect(cornerSites(2.5, 2.5, { radius: LARGEST_RADIUS })).toEqual([
        '-44.5,-44.5',
        '-44.5,42',
        '42,-44.5',
        '42,42',
      ]);
    });
  });
});
