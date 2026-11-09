// @vitest-environment node
/**
 * A detached-margin plate assembled from the planner's own output (#4921): an
 * 8.5×10 grid in a 366×435 drawer, its half column on the left, padding on the
 * left and back filled with half-grid tiles, both margins detached and joined
 * by puzzle connectors, split into six pieces for a 250×220 bed.
 *
 * Probed on the real meshes: the rails' pockets have to land on the body's grid
 * cells, and every rail has to be cut where its body piece grows a tongue.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { mesh } from 'brepjs';
import type { MeshData } from '@/features/generation/bridge/types';
import type { ResolvedBaseplateParams, MarginPiece } from '@/shared/types/bin';
import type { StoredBaseplateParams } from '@/core/types';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { buildFullParams } from '@/features/baseplate/utils/buildFullParams';
import {
  bodyParamsForDetach,
  computeBaseplateTiling,
  pieceToBaseplateParams,
} from '@/features/baseplate/utils/splitPlanner';
import type { BaseplateTiling } from '@/features/baseplate/types/tiling';
import { initBrepjs, getGenerateBaseplate } from './__kernel-tests__/wasmInit';
import { boundingBox, columnCrossings } from './__kernel-tests__/meshAssertions';
import { buildConnectors } from './baseplateConnectors';
import { computeCellBoundariesMm, computeCellCentersMm } from './cellDecomposition';
import { generateMargin } from './baseplateMargin';
import { PLATE_PROFILE_HEIGHT } from './generatorTypes';

beforeAll(async () => {
  await initBrepjs();
}, 60_000);

const GU = 42;
const BED_W = 250;
const BED_D = 220;

function issueParams(over: Partial<StoredBaseplateParams> = {}): ResolvedBaseplateParams {
  const stored = {
    ...DEFAULT_BASEPLATE_PARAMS,
    paddingLeft: 9,
    paddingRight: 0,
    paddingFront: 0,
    paddingBack: 15,
    overTile: true,
    overTileHalfGrid: true,
    overTileHalfGridSolidLeftover: false,
    detachMargins: true,
    detachMarginConnector: true,
    connectorNubs: true,
    connectorStyle: 'puzzle',
    ...over,
  } as StoredBaseplateParams;
  return buildFullParams(stored, 8.5, 10, GU, 'start', 'end', 0.4);
}

/** Highest surface over a column, or -Infinity where the column is open. */
const topAt = (m: MeshData, x: number, y: number): number => {
  const c = columnCrossings(m, x, y);
  return c.length > 0 ? c[c.length - 1] : -Infinity;
};

/**
 * Pockets sit on the body cells along `xs` (world X): ridges on every cell
 * boundary, open pockets at every cell center. `toLocal` maps world X onto the
 * probed mesh; `y` is a column inside the margin band.
 */
function expectPocketsOnGrid(
  m: MeshData,
  boundaries: readonly number[],
  centers: readonly number[],
  toLocal: (x: number) => number,
  y: number
): void {
  const top = boundingBox(m.vertices).maxZ;
  for (const x of boundaries) {
    expect(topAt(m, toLocal(x) + 0.05, y), `ridge on cell boundary x=${x}`).toBeGreaterThan(
      top - 0.3
    );
  }
  for (const x of centers) {
    expect(topAt(m, toLocal(x) + 0.05, y), `pocket on cell center x=${x}`).toBeLessThan(top - 1);
  }
}

describe('detached rail pockets follow the body grid (#4921)', () => {
  // The half column sits on the left, so cell seams fall on 21mm + n·42mm.
  const boundaries = computeCellBoundariesMm(8.5, GU, 'start');
  const centers = computeCellCentersMm(8.5, GU, 'start');

  it('lines the back rails up with a left half column', () => {
    const params = issueParams();
    const tiling = computeBaseplateTiling(params, BED_W, BED_D);
    const backs = tiling.margins.filter((m) => m.side === 'back');
    expect(backs.length).toBeGreaterThan(0);
    for (const rail of backs) {
      const m = generateMargin(params, rail, true);
      const { x } = rail.worldOffsetMm;
      const inside = (wx: number): boolean => Math.abs(wx - x) < rail.lengthMm / 2 - 1;
      expectPocketsOnGrid(
        m,
        boundaries.filter(inside),
        centers.filter(inside),
        (wx) => wx - x,
        0.13
      );
    }
  });

  it('lines an integral back margin up with a left half column', () => {
    const params = issueParams({ detachMargins: false });
    const plate = getGenerateBaseplate()(params, () => undefined, true);
    // Grid-centred frame: the back margin band is [depth/2, depth/2 + 15].
    const bandY = (10 * GU) / 2 + 7.5 + 0.13;
    expectPocketsOnGrid(plate, boundaries, centers, (wx) => wx, bandY);
  });
});

/** Body generation params per tiling piece, the way the preview and export build them. */
function bodyPieces(
  tiling: BaseplateTiling,
  params: ResolvedBaseplateParams
): Array<{ params: ResolvedBaseplateParams; centerX: number; centerY: number }> {
  const totalW = tiling.totalWidthUnits * GU;
  const totalD = tiling.totalDepthUnits * GU;
  if (!tiling.isSplit) return [{ params: bodyParamsForDetach(params), centerX: 0, centerY: 0 }];
  return tiling.pieces.map((p) => ({
    params: pieceToBaseplateParams(p, params),
    centerX: p.gridOffsetX * GU + (p.widthUnits * GU) / 2 - totalW / 2,
    centerY: p.gridOffsetY * GU + (p.depthUnits * GU) / 2 - totalD / 2,
  }));
}

/** World-space XY centers of the tongues a body grows past its grid edge on `side`. */
function seamTongueCenters(
  tiling: BaseplateTiling,
  params: ResolvedBaseplateParams,
  side: MarginPiece['side']
): Array<{ x: number; y: number }> {
  const halfW = (tiling.totalWidthUnits * GU) / 2;
  const halfD = (tiling.totalDepthUnits * GU) / 2;
  const past = {
    left: (x: number) => x < -halfW,
    right: (x: number) => x > halfW,
    front: (_x: number, y: number) => y < -halfD,
    back: (_x: number, y: number) => y > halfD,
  }[side];
  const out: Array<{ x: number; y: number }> = [];
  for (const body of bodyPieces(tiling, params)) {
    const p = body.params;
    const w = p.width * GU + p.paddingLeft + p.paddingRight;
    const d = p.depth * GU + p.paddingFront + p.paddingBack;
    const { nubs, holes } = buildConnectors(
      p,
      PLATE_PROFILE_HEIGHT,
      w,
      d,
      (p.paddingRight - p.paddingLeft) / 2,
      (p.paddingBack - p.paddingFront) / 2
    );
    holes.forEach((h) => h.delete());
    for (const nub of nubs) {
      const bb = boundingBox(mesh(nub, { tolerance: 0.05, angularTolerance: 10 }).vertices);
      nub.delete();
      const x = body.centerX + (bb.minX + bb.maxX) / 2;
      const y = body.centerY + (bb.minY + bb.maxY) / 2;
      if (past(x, y)) out.push({ x, y });
    }
  }
  return out;
}

describe('every detached side is joined by connectors (#4921)', () => {
  const railAt = (tiling: BaseplateTiling, x: number, y: number): MarginPiece => {
    const rail = tiling.margins.find((m) => {
      const horizontal = m.side === 'front' || m.side === 'back';
      const halfX = (horizontal ? m.lengthMm : m.bandThicknessMm) / 2;
      const halfY = (horizontal ? m.bandThicknessMm : m.lengthMm) / 2;
      return Math.abs(x - m.worldOffsetMm.x) <= halfX && Math.abs(y - m.worldOffsetMm.y) <= halfY;
    });
    if (!rail) throw new Error(`no rail under (${x}, ${y})`);
    return rail;
  };

  it.each([
    ['split into six pieces', BED_W, BED_D],
    ['unsplit', 500, 500],
  ])('cuts every rail where its body piece grows a tongue (%s)', (_label, bedW, bedD) => {
    const params = issueParams();
    const plain = issueParams({ detachMarginConnector: false });
    const tiling = computeBaseplateTiling(params, bedW, bedD);
    const sides = [...new Set(tiling.margins.map((m) => m.side))].sort();
    expect(sides).toEqual(['back', 'left']);

    const meshes = new Map<string, { on: MeshData; off: MeshData }>();
    for (const side of sides) {
      const tongues = seamTongueCenters(tiling, params, side);
      expect(tongues.length, `${side} seam tongues`).toBeGreaterThan(0);
      for (const t of tongues) {
        const rail = railAt(tiling, t.x, t.y);
        let pair = meshes.get(rail.id);
        if (!pair) {
          pair = { on: generateMargin(params, rail, true), off: generateMargin(plain, rail, true) };
          meshes.set(rail.id, pair);
        }
        const lx = t.x - rail.worldOffsetMm.x;
        const ly = t.y - rail.worldOffsetMm.y;
        expect(topAt(pair.off, lx, ly), `${rail.id} is solid there unkeyed`).toBeGreaterThan(0);
        expect(topAt(pair.on, lx, ly), `${rail.id} open for the tongue at y=${t.y}`).toBe(
          -Infinity
        );
      }
    }
  });
});
