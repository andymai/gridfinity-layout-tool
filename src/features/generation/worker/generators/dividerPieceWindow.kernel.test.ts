/**
 * Real-kernel checks for the "Interior walls" cutout on REMOVABLE divider
 * pieces. The pieces are separate parts, never in the bin mesh, so the bin
 * scenario suite cannot see them.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { BinParams, WallCutout } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { box, intersect, measureVolume, mesh, unwrap } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildUniqueDividerPieces } from './dividerBuilder';
import { dividerGrooveDepth } from '@/shared/utils/slotMath';

beforeAll(async () => {
  await initBrepjs();
}, 60_000);

const INNER_W = 3 * 42 - 0.5 - 2 * 1.2;
const INNER_D = 2 * 42 - 0.5 - 2 * 1.2;
const WALL_HEIGHT = 6 * 7 - 4.75;

function slotted(interior: Partial<WallCutout> | null): BinParams {
  const walls = DEFAULT_BIN_PARAMS.walls;
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 3,
    depth: 2,
    height: 6,
    style: 'slotted',
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      x: { enabled: true, pitch: 40 },
      y: { enabled: false, pitch: 40 },
    },
    walls: {
      ...walls,
      enabled: interior !== null,
      shape: 'u-shape',
      // Square corners, so the window is a plain rectangle to measure.
      cornerRadiusTop: 0,
      cornerRadiusBottom: 0,
      interior: { ...walls.interior, enabled: true, width: 40, depth: 50, ...interior },
    },
  };
}

interface Measured {
  readonly volume: number;
  /** Highest point of the piece's top edge at its centre, in the flat frame. */
  readonly midTop: number;
  readonly top: number;
}

function maxY(shape: Shape3D): number {
  const m = mesh(shape, { tolerance: 0.05, angularTolerance: 0.3, cache: false });
  let top = -Infinity;
  for (let i = 1; i < m.vertices.length; i += 3) top = Math.max(top, m.vertices[i]);
  return top;
}

function measure(params: BinParams): Measured {
  const pieces = buildUniqueDividerPieces(
    params,
    INNER_W,
    INNER_D,
    WALL_HEIGHT,
    DEFAULT_BIN_PARAMS.base.stackingLip
  );
  expect(pieces).toHaveLength(1);
  const shape: Shape3D = pieces[0].shape;
  const slab = box(2, 500, 500, { at: [0, 0, 0] });
  const middle = unwrap(intersect(shape as ValidSolid, slab));
  try {
    return {
      volume: unwrap(measureVolume(shape)),
      midTop: maxY(middle),
      top: maxY(shape),
    };
  } finally {
    for (const s of [shape, slab, middle]) s.delete();
  }
}

describe('interior wall cutout on removable divider pieces', () => {
  it('cuts the window from the top of each piece, centred on the span in the cavity', () => {
    const params = slotted({});
    const plain = measure(slotted(null));
    const cut = measure(params);

    // The piece stands in a floor groove, and the 50% drop is of the part above it.
    const standing = plain.top * 2 - dividerGrooveDepth(params);
    const depth = standing * 0.5;
    expect(cut.top).toBeCloseTo(plain.top, 3);
    expect(cut.top - cut.midTop, 'no window opens the piece from its top edge').toBeCloseTo(
      depth,
      2
    );

    const window = INNER_W * 0.4 * depth * DEFAULT_BIN_PARAMS.dividerPieces.thickness;
    expect((plain.volume - cut.volume) / window).toBeCloseTo(1, 2);
  });

  it('leaves the piece whole when the interior cutout is off', () => {
    const plain = measure(slotted(null));
    const off = measure(slotted({ enabled: false }));
    expect(off.volume).toBeCloseTo(plain.volume, 6);
  });
});

function measureAll(params: BinParams): { volume: number; count: number } {
  const pieces = buildUniqueDividerPieces(
    params,
    INNER_W,
    INNER_D,
    WALL_HEIGHT,
    DEFAULT_BIN_PARAMS.base.stackingLip
  );
  try {
    let volume = 0;
    for (const piece of pieces) {
      volume += unwrap(measureVolume(piece.shape));
    }
    return { volume, count: pieces.length };
  } finally {
    for (const piece of pieces) piece.shape.delete();
  }
}

describe('every removable piece takes the interior cutout', () => {
  const bothAxes = (crossStyle: 'lap' | 'insert'): Partial<BinParams> => ({
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      x: { enabled: true, pitch: 40 },
      y: { enabled: true, pitch: 40 },
      crossStyle,
    },
    dividerPieces: { ...DEFAULT_BIN_PARAMS.dividerPieces, thickness: 2.4 },
  });
  const authored: Partial<BinParams> = {
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      layout: 'custom',
      customGrid: { cols: 2, rows: 2, cells: [0, 1, 2, 3] },
    },
  };
  const cases: [string, Partial<BinParams>, BinParams['walls']['shape']][] = [
    ['interlocking pieces', bothAxes('lap'), 'u-shape'],
    ['long and short insert pieces', bothAxes('insert'), 'u-shape'],
    ['pieces drawn on a custom grid', authored, 'u-shape'],
    ['a scoop window', {}, 'scoop'],
    ['a funnel window', {}, 'funnel'],
  ];

  it.each(cases)('%s', (_name, overrides, shape) => {
    const withAuto = (p: BinParams): BinParams => ({
      ...p,
      ...overrides,
      walls: { ...p.walls, shape, cornerRadiusTop: null, cornerRadiusBottom: null },
    });
    const plain = measureAll(withAuto(slotted(null)));
    const cut = measureAll(withAuto(slotted({})));
    expect(cut.count).toBe(plain.count);
    expect(cut.count).toBeGreaterThan(0);
    // Every piece loses a window: no piece is skipped, and none is destroyed.
    expect(cut.volume).toBeLessThan(plain.volume - cut.count * 50);
    expect(cut.volume).toBeGreaterThan(plain.volume * 0.5);
  });

  it('builds a patterned piece with a window', () => {
    // The pattern's keep-out holds a solid border round the window, so the
    // piece can weigh more than with the pattern alone; the keep-out itself is
    // pinned in `dividerPiecePatterns.test.ts`.
    const patterned = (p: BinParams): BinParams => ({
      ...p,
      wallPattern: { enabled: true, pattern: 'honeycomb', dividers: true },
    });
    const pattern = measureAll(patterned(slotted(null)));
    const both = measureAll(patterned(slotted({})));
    expect(both.count).toBe(pattern.count);
    expect(both.volume).toBeGreaterThan(0);
    expect(both.volume).not.toBeCloseTo(pattern.volume, 0);
  });
});
