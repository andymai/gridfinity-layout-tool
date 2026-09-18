// @vitest-environment node
/**
 * Removable divider pieces give up the lid's seating band.
 *
 * A watertight full-height piece and a notched one both pass every bounding-box,
 * triangle-count and watertight check, so the collision with a seated lid is
 * only visible by slicing a piece across the band and reading where its material
 * stops. A capping lid takes the corner at the wall ends; a sliding plate takes
 * the whole top.
 *
 *   pnpm run test:run src/features/generation/worker/generators/dividerLidKeepout.scenario
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getKernelName } from './__kernel-tests__/wasmInit';
import { buildUniqueDividerPieces } from './dividerBuilder';
import { labelShelfKeepoutMm } from '@/shared/utils/lidInteriorRelief';
import {
  calculateDividerPieceHeight,
  dividerSeatZ,
  dividerGrooveDepth,
} from '@/shared/utils/slotMath';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_LID_SLIDE_CONFIG } from '@/features/bin-designer/types/lid';
import type { BinParams } from '@/shared/types/bin';

/** Just the fields these probes read off a brepjs mesh. */
interface PieceMesh {
  readonly vertices: ArrayLike<number>;
  readonly indices: ArrayLike<number>;
}

/** Volume of a closed indexed mesh (sum of origin tetrahedra). */
function solidVolume({ vertices, indices }: PieceMesh): number {
  let v = 0;
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    v +=
      (vertices[a] * (vertices[b + 1] * vertices[c + 2] - vertices[b + 2] * vertices[c + 1]) -
        vertices[a + 1] * (vertices[b] * vertices[c + 2] - vertices[b + 2] * vertices[c]) +
        vertices[a + 2] * (vertices[b] * vertices[c + 1] - vertices[b + 1] * vertices[c])) /
      6;
  }
  return Math.abs(v);
}

const INNER_W = 160;
const INNER_D = 120;
const HEIGHT_UNITS = 4;
const WALL_HEIGHT = HEIGHT_UNITS * DEFAULT_BIN_PARAMS.heightUnitMm;

function slottedParams(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    style: 'slotted',
    height: HEIGHT_UNITS,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      x: { enabled: true, pitch: 40 },
      y: { enabled: false, pitch: 40 },
    },
    lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: false, relieveInterior: true },
    ...overrides,
  };
}

/** A capping lid: claims a ring at the wall. */
function withLid(params: BinParams): BinParams {
  return { ...params, lid: { ...params.lid, enabled: true, relieveInterior: true } };
}

/** A sliding lid: its plate sweeps the whole opening. */
function withSlideLid(params: BinParams): BinParams {
  return {
    ...params,
    lid: {
      ...params.lid,
      enabled: true,
      relieveInterior: true,
      attachment: 'slide',
      slide: { ...DEFAULT_LID_SLIDE_CONFIG },
    },
  };
}

/** A custom-grid (authored) slotted bin — 2x1 is one full wall-to-wall divider. */
function authoredParams(): BinParams {
  return slottedParams({
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      layout: 'custom',
      customGrid: { cols: 2, rows: 1, cells: [0, 1] },
    },
  });
}

async function firstPieceMesh(params: BinParams): Promise<PieceMesh> {
  const { mesh } = await import('brepjs');
  const pieces = buildUniqueDividerPieces(params, INNER_W, INNER_D, WALL_HEIGHT, true);
  try {
    expect(pieces.length).toBeGreaterThan(0);
    const m = mesh(pieces[0].shape, { tolerance: 0.01, angularTolerance: 5, cache: false });
    return { vertices: m.vertices, indices: m.triangles };
  } finally {
    for (const p of pieces) p.shape.delete();
  }
}

async function totalPieceVolume(params: BinParams): Promise<number> {
  const { mesh } = await import('brepjs');
  const pieces = buildUniqueDividerPieces(params, INNER_W, INNER_D, WALL_HEIGHT, true);
  try {
    return pieces.reduce((sum, p) => {
      const m = mesh(p.shape, { tolerance: 0.01, angularTolerance: 5, cache: false });
      return sum + solidVolume({ vertices: m.vertices, indices: m.triangles });
    }, 0);
  } finally {
    for (const p of pieces) p.shape.delete();
  }
}

/** [minX, maxX] the solid reaches on the plane Y = y. Slices triangle edges,
 *  because the piece is a prism whose vertices only sit on its end caps. */
function sectionXSpanAtY({ vertices, indices }: PieceMesh, y: number): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  const edge = (a: number, b: number): void => {
    const ya = vertices[a + 1];
    const yb = vertices[b + 1];
    if (ya === yb || y < Math.min(ya, yb) || y > Math.max(ya, yb)) return;
    const t = (y - ya) / (yb - ya);
    const x = vertices[a] + t * (vertices[b] - vertices[a]);
    lo = Math.min(lo, x);
    hi = Math.max(hi, x);
  };
  for (let i = 0; i < indices.length; i += 3) {
    const a = indices[i] * 3;
    const b = indices[i + 1] * 3;
    const c = indices[i + 2] * 3;
    edge(a, b);
    edge(b, c);
    edge(c, a);
  }
  return [lo, hi];
}

/** Local Y of the piece's top edge — the installed interior ceiling. The piece
 *  is built centred on Y, so this is half its height. */
function pieceHalfHeight(params: BinParams): number {
  const seatZ = dividerSeatZ(params.wallThickness, dividerGrooveDepth(params));
  return calculateDividerPieceHeight(params.dividerPieces, WALL_HEIGHT, true, seatZ) / 2;
}

beforeAll(async () => {
  await initBrepjs();
}, 120_000);

describe(`removable divider lid keep-out on ${getKernelName()}`, () => {
  it('cuts the top corners back from the walls when a lid seats over the bin', async () => {
    const params = withLid(slottedParams());
    // The band the lid claims below the ceiling — a real, positive relief.
    expect(labelShelfKeepoutMm(params)).toBeGreaterThan(1);

    const mesh = await firstPieceMesh(params);
    const halfH = pieceHalfHeight(params);
    const [midLo, midHi] = sectionXSpanAtY(mesh, 0);
    // Inside the keep-out band, a hair below the top edge.
    const [topLo, topHi] = sectionXSpanAtY(mesh, halfH - 0.3);

    const midWidth = midHi - midLo;
    const topWidth = topHi - topLo;
    // The band is notched off BOTH ends, so the top slice is materially shorter
    // than the mid slice and stops well short of where the full run ends.
    expect(midWidth - topWidth).toBeGreaterThan(4);
    expect(topHi).toBeLessThan(midHi - 2);
    expect(topLo).toBeGreaterThan(midLo + 2);
  });

  it('leaves the piece full-height when no lid seats over it', async () => {
    const mesh = await firstPieceMesh(slottedParams());
    const halfH = pieceHalfHeight(slottedParams());
    const [midLo, midHi] = sectionXSpanAtY(mesh, 0);
    const [topLo, topHi] = sectionXSpanAtY(mesh, halfH - 0.3);

    // Same run at the top as in the middle: the top corners are untouched.
    expect(Math.abs(midHi - topHi)).toBeLessThan(0.5);
    expect(Math.abs(midLo - topLo)).toBeLessThan(0.5);
  });

  it('removes only the corner band — a capping lid never costs more than the ends', async () => {
    const both = {
      ...slottedParams(),
      slotConfig: {
        ...slottedParams().slotConfig,
        x: { enabled: true, pitch: 40 },
        y: { enabled: true, pitch: 40 },
      },
    } satisfies BinParams;
    const relieved = await totalPieceVolume(withLid(both));
    const full = await totalPieceVolume(both);
    // A capping lid costs some material (the wall-end corners) but a small
    // fraction of the whole — a band at the ends, not a shortened piece.
    expect(relieved).toBeLessThan(full);
    expect(relieved).toBeGreaterThan(full * 0.8);
  });

  it('relieves the whole top span under a sliding lid, not just the ends', async () => {
    const params = withSlideLid(slottedParams());
    // A sliding plate claims a deeper band than a capping lid.
    expect(labelShelfKeepoutMm(params)).toBeGreaterThan(
      labelShelfKeepoutMm(withLid(slottedParams()))
    );

    const mesh = await firstPieceMesh(params);
    const halfH = pieceHalfHeight(params);
    // Inside the band: nothing survives, at the ends OR the middle.
    const [topLo, topHi] = sectionXSpanAtY(mesh, halfH - 0.3);
    expect(Number.isFinite(topHi) && topHi >= topLo).toBe(false);
    // Below the band the piece is still a full-width wall.
    const [midLo, midHi] = sectionXSpanAtY(mesh, 0);
    expect(midHi - midLo).toBeGreaterThan(4);
  });

  it('relieves authored (custom-grid) pieces at the wall under a lid', async () => {
    const params = withLid(authoredParams());
    expect(labelShelfKeepoutMm(params)).toBeGreaterThan(1);

    const mesh = await firstPieceMesh(params);
    const halfH = pieceHalfHeight(params);
    const [midLo, midHi] = sectionXSpanAtY(mesh, 0);
    const [topLo, topHi] = sectionXSpanAtY(mesh, halfH - 0.3);
    // Same end relief the parametric path gets.
    expect(midHi - midLo - (topHi - topLo)).toBeGreaterThan(4);
    expect(topHi).toBeLessThan(midHi - 2);
    expect(topLo).toBeGreaterThan(midLo + 2);
  });
});
