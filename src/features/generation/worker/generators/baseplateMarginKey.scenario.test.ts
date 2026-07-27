// @vitest-environment node
/**
 * Keyed margin-seam geometry (`connectorStyle: 'dovetailKey'`, issue #2866).
 *
 * Under the key style the body↔rail seam is female on BOTH sides and the same
 * seated key that locks the split seams spans it. Verified on the real BREP
 * solids: the body grooves land on cell boundaries, the rail carves the matching
 * set, and the key seated at each junction is fully contained by the two grooves
 * together while genuinely engaging each of them.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume, translate, rotate, intersect, fuse } from 'brepjs';
import type { Shape3D } from 'brepjs';
import { isOk } from '@/core/result';
import type { ResolvedBaseplateParams, MarginPiece, BaseplateEdges } from '@/shared/types/bin';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildConnectors, buildMarginSeamGroove, buildDovetailKey } from './baseplateConnectors';
import { computeCellBoundariesMm } from './cellDecomposition';
import { generateMargin } from './baseplateMargin';
import { SOCKET_HEIGHT } from './generatorTypes';

const vol = (s: Parameters<typeof measureVolume>[0]): number => {
  const r = measureVolume(s);
  if (!isOk(r)) throw new Error('measureVolume failed');
  return r.value;
};

beforeAll(async () => {
  await initBrepjs();
}, 60000);

const WIDTH = 3;
const DEPTH = 2;
const GU = 42;
const PF = 12; // front padding → detached front rail

function baseParams(over: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams {
  return {
    width: WIDTH,
    depth: DEPTH,
    gridUnitMm: GU,
    nozzleSizeMm: 0.4,
    magnetHoles: false,
    magnetDiameter: 6.5,
    magnetDepth: 2.4,
    paddingLeft: 0,
    paddingRight: 0,
    paddingFront: PF,
    paddingBack: 0,
    connectorNubs: true,
    connectorStyle: 'dovetailKey',
    preferIdenticalPieces: false,
    lightweight: false,
    detachMargins: true,
    detachMarginConnector: true,
    ...over,
  } as ResolvedBaseplateParams;
}

const frontSeamEdges: BaseplateEdges = {
  left: 'exterior',
  right: 'exterior',
  front: 'marginSeam',
  back: 'exterior',
};

function frontRail(over: Partial<MarginPiece> = {}): MarginPiece {
  return {
    id: 'margin-front-a',
    side: 'front',
    role: 'long',
    col: 0,
    row: 0,
    lengthMm: WIDTH * GU,
    bandThicknessMm: PF,
    ownedCorners: [],
    worldOffsetMm: { x: 0, y: -(DEPTH * GU) / 2 - PF / 2 },
    seamConnector: { cellUnits: WIDTH, centerOffsetMm: 0, fractionalEdge: 'end' },
    overTile: false,
    overTileHalfGrid: false,
    overTileHalfGridSolidLeftover: false,
    ...over,
  };
}

/**
 * Fuse a list of solids, consuming them; returns null for an empty list.
 *
 * Throws on a failed fuse rather than dropping the part: a silently incomplete
 * union would make the containment assertions below pass against grooves that
 * aren't there, which is exactly the kernel regression this file exists to catch.
 */
function fuseAll(parts: Shape3D[]): Shape3D | null {
  let union: Shape3D | null = null;
  for (const part of parts) {
    if (!union) {
      union = part;
      continue;
    }
    const f = fuse(union, part);
    if (!isOk(f)) {
      union.delete();
      part.delete();
      throw new Error('fuse failed while building the groove union');
    }
    union.delete();
    part.delete();
    union = f.value;
  }
  return union;
}

/** The rail's seam grooves, in the shared body/world frame. */
function railGrooves(rail: MarginPiece): Shape3D[] {
  const seam = rail.seamConnector;
  if (!seam) return [];
  const horizontal = rail.side === 'front' || rail.side === 'back';
  const railW = horizontal ? rail.lengthMm : rail.bandThicknessMm;
  const railD = horizontal ? rail.bandThicknessMm : rail.lengthMm;
  return computeCellBoundariesMm(seam.cellUnits, GU, seam.fractionalEdge)
    .map((b) => b + seam.centerOffsetMm)
    .map((pos) => {
      const local = buildMarginSeamGroove(
        rail.side,
        railW,
        railD,
        SOCKET_HEIGHT,
        'dovetailKey',
        0,
        0.4,
        pos
      );
      const world = translate(local, [rail.worldOffsetMm.x, rail.worldOffsetMm.y, 0]);
      local.delete();
      return world;
    });
}

/**
 * A key seated at a front-seam junction, in the grooves' frame. The stock key is
 * built bottom-at-Z=0 with its long axis on X, so a horizontal (front/back) seam
 * rotates it 90° — the `axis: 'y'` case in `computeSeamJunctions` — and it drops
 * by the slab height to match the grooves' top-at-Z=0 convention.
 */
function seatedKeyAt(xMm: number): Shape3D {
  const stock = buildDovetailKey(SOCKET_HEIGHT, GU);
  const turned = rotate(stock, 90, { axis: [0, 0, 1] });
  stock.delete();
  const placed = translate(turned, [xMm, -(DEPTH * GU) / 2, -SOCKET_HEIGHT]);
  turned.delete();
  return placed;
}

/** Fraction of `part` that lies inside `container`. */
function containedFraction(part: Shape3D, container: Shape3D): number {
  const inter = intersect(part, container);
  if (!isOk(inter)) return 0;
  const fraction = vol(inter.value) / vol(part);
  inter.value.delete();
  return fraction;
}

describe('keyed margin seam (issue #2866)', () => {
  it('makes the body wall female on cell boundaries instead of tonguing it', () => {
    const { nubs, holes } = buildConnectors(
      baseParams({ edges: frontSeamEdges }),
      SOCKET_HEIGHT,
      WIDTH * GU,
      DEPTH * GU,
      0,
      0,
      true
    );
    // A 3-wide wall has 2 interior boundaries — one groove each, no tongues.
    expect(nubs.length, 'no tongue under the key style').toBe(0);
    expect(holes.length, 'one groove per interior cell boundary').toBe(WIDTH - 1);
    for (const h of holes) expect(vol(h), 'groove has volume').toBeGreaterThan(0);
    holes.forEach((h) => h.delete());
    nubs.forEach((n) => n.delete());
  });

  it('leaves a single-cell wall friction-fit on both sides', () => {
    // One cell has no interior boundary, so there is nowhere to seat a key —
    // both halves must stay flat rather than grow a lone unmatched groove.
    const { nubs, holes } = buildConnectors(
      baseParams({ width: 1, edges: frontSeamEdges }),
      SOCKET_HEIGHT,
      1 * GU,
      DEPTH * GU,
      0,
      0,
      true
    );
    expect(nubs.length).toBe(0);
    expect(holes.length).toBe(0);

    const oneCellRail = frontRail({
      lengthMm: GU,
      seamConnector: { cellUnits: 1, centerOffsetMm: 0, fractionalEdge: 'end' },
    });
    const keyed = generateMargin(baseParams({ width: 1 }), oneCellRail, true);
    const plain = generateMargin(
      baseParams({ width: 1, detachMarginConnector: false }),
      oneCellRail,
      true
    );
    expect(keyed.vertices.length, 'rail is ungrooved too').toBe(plain.vertices.length);
  });

  it('cuts grooves into the connected long rail', () => {
    const keyed = generateMargin(baseParams(), frontRail(), true);
    const plain = generateMargin(baseParams({ detachMarginConnector: false }), frontRail(), true);
    for (const m of [keyed, plain]) {
      expect(m.vertices.length).toBeGreaterThan(0);
      expect(m.vertices.every((v) => Number.isFinite(v))).toBe(true);
    }
    expect(keyed.vertices.length).toBeGreaterThan(plain.vertices.length);
  });

  it('leaves short rails friction-fit', () => {
    const shortRail = frontRail({ id: 'margin-left-1', side: 'left', role: 'short' });
    const keyed = generateMargin(baseParams(), shortRail, true);
    const plain = generateMargin(baseParams({ detachMarginConnector: false }), shortRail, true);
    expect(keyed.vertices.length).toBe(plain.vertices.length);
  });

  it('seats a key across each body↔rail junction, engaging both halves', () => {
    const { holes } = buildConnectors(
      baseParams({ edges: frontSeamEdges }),
      SOCKET_HEIGHT,
      WIDTH * GU,
      DEPTH * GU,
      0,
      0,
      true
    );
    const bodyUnion = fuseAll(holes);
    const railUnion = fuseAll(railGrooves(frontRail()));
    if (!bodyUnion || !railUnion) throw new Error('expected grooves on both halves');
    const bothUnionResult = fuse(bodyUnion, railUnion);
    if (!isOk(bothUnionResult)) throw new Error('groove union failed');
    const bothUnion = bothUnionResult.value;

    const junctions = computeCellBoundariesMm(WIDTH, GU, 'end');
    expect(junctions.length).toBe(WIDTH - 1);

    for (const x of junctions) {
      const key = seatedKeyAt(x);
      // Contained by the two grooves together: the cavity is big enough and the
      // halves are aligned, so a hammered key can't foul either piece.
      expect(containedFraction(key, bothUnion), 'key fits the assembled cavity').toBeGreaterThan(
        0.95
      );
      // ...and it really straddles, rather than sitting entirely in one half.
      expect(containedFraction(key, bodyUnion), 'key engages the body').toBeGreaterThan(0.2);
      expect(containedFraction(key, railUnion), 'key engages the rail').toBeGreaterThan(0.2);
      key.delete();
    }

    bodyUnion.delete();
    railUnion.delete();
    bothUnion.delete();
  });

  it('still seats on a corner-owning end segment (#2427)', () => {
    // The front rail extends left over PL to own the corner, so its center sits
    // −PL/2 from the body grid center; centerOffsetMm re-anchors the grooves.
    const PL = 20;
    const { holes } = buildConnectors(
      baseParams({ edges: frontSeamEdges }),
      SOCKET_HEIGHT,
      WIDTH * GU,
      DEPTH * GU,
      0,
      0,
      true
    );
    const bodyUnion = fuseAll(holes);
    if (!bodyUnion) throw new Error('expected body grooves');
    const geometry = {
      lengthMm: WIDTH * GU + PL,
      worldOffsetMm: { x: -PL / 2, y: -(DEPTH * GU) / 2 - PF / 2 },
    };
    const aligned = fuseAll(
      railGrooves(
        frontRail({
          ...geometry,
          seamConnector: { cellUnits: WIDTH, centerOffsetMm: PL / 2, fractionalEdge: 'end' },
        })
      )
    );
    const misaligned = fuseAll(
      railGrooves(
        frontRail({
          ...geometry,
          seamConnector: { cellUnits: WIDTH, centerOffsetMm: 0, fractionalEdge: 'end' },
        })
      )
    );
    if (!aligned || !misaligned) throw new Error('expected rail grooves');

    for (const x of computeCellBoundariesMm(WIDTH, GU, 'end')) {
      const key = seatedKeyAt(x);
      expect(containedFraction(key, aligned), 'rail groove meets the key').toBeGreaterThan(0.2);
      expect(containedFraction(key, misaligned), 'without the offset it misses').toBeLessThan(0.02);
      key.delete();
    }

    bodyUnion.delete();
    aligned.delete();
    misaligned.delete();
  });
});
