// @vitest-environment node
/**
 * Margin-seam connector geometry (#2414): the body carries a single tongue on a
 * `marginSeam` wall, the long rail carries the matching groove, and the two mate
 * in world space. Verified on the real BREP solids.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume, translate, intersect } from 'brepjs';
import { isOk } from '@/core/result';
import type { ResolvedBaseplateParams, MarginPiece, BaseplateEdges } from '@/shared/types/bin';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { buildConnectors, buildMarginSeamGroove } from './baseplateConnectors';
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
    connectorNubs: false,
    connectorStyle: 'dovetail',
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
    overTile: false,
    overTileHalfGrid: false,
    overTileHalfGridSolidLeftover: false,
    ...over,
  };
}

describe('margin-seam connector geometry (#2414)', () => {
  it('builds exactly one body tongue on a marginSeam wall, independent of connectorNubs', () => {
    const { nubs, holes } = buildConnectors(
      baseParams({ edges: frontSeamEdges }),
      SOCKET_HEIGHT,
      WIDTH * GU,
      DEPTH * GU,
      0,
      0,
      true
    );
    expect(nubs.length, 'one seam tongue').toBe(1);
    expect(holes.length, 'no grooves on the body').toBe(0);
    expect(vol(nubs[0]), 'tongue has volume').toBeGreaterThan(0);
    nubs.forEach((n) => n.delete());
  });

  it('builds no seam tongue for a marginSeam edge under a non-tongue style', () => {
    // Defensive: splitPlanner never assigns marginSeam for snapClip, but if it
    // did, buildConnectors must not emit a mismatched dovetail tongue.
    const { nubs } = buildConnectors(
      baseParams({ edges: frontSeamEdges, connectorStyle: 'snapClip' }),
      SOCKET_HEIGHT,
      WIDTH * GU,
      DEPTH * GU,
      0,
      0,
      true
    );
    expect(nubs.length).toBe(0);
    nubs.forEach((n) => n.delete());
  });

  it('builds no seam tongue when the wall is a plain exterior edge', () => {
    const exterior: BaseplateEdges = { ...frontSeamEdges, front: 'exterior' };
    const { nubs } = buildConnectors(
      baseParams({ edges: exterior }),
      SOCKET_HEIGHT,
      WIDTH * GU,
      DEPTH * GU,
      0,
      0,
      true
    );
    expect(nubs.length).toBe(0);
    nubs.forEach((n) => n.delete());
  });

  it('cuts a groove into the connected long rail', () => {
    const withConn = generateMargin(baseParams(), frontRail(), true);
    const noConn = generateMargin(baseParams({ detachMarginConnector: false }), frontRail(), true);
    // Both are valid, finite meshes.
    for (const m of [withConn, noConn]) {
      expect(m.vertices.length).toBeGreaterThan(0);
      expect(m.vertices.every((v) => Number.isFinite(v))).toBe(true);
    }
    // The groove carves new faces into the rail's inner wall, so the connected
    // rail's mesh has strictly more geometry than the plain friction-fit rail.
    expect(withConn.vertices.length).toBeGreaterThan(noConn.vertices.length);
  });

  it('leaves short rails friction-fit (no groove)', () => {
    // A short rail (role 'short') must not be grooved even with the connector on.
    const shortRail = frontRail({ id: 'margin-left-1', side: 'left', role: 'short' });
    const conn = generateMargin(baseParams(), shortRail, true);
    const plain = generateMargin(baseParams({ detachMarginConnector: false }), shortRail, true);
    expect(conn.vertices.length).toBe(plain.vertices.length);
  });

  it('a corner segment groove seats the body tongue via seamTongueOffsetMm (#2427)', () => {
    // A long rail's corner-owning end segment extends over the perpendicular
    // padding, so its center is shifted OFF the body wall it joins. Without the
    // offset the groove misses the (grid-centered) tongue entirely; with it, the
    // groove slides back onto the tongue. Model column 0 of a split: the front
    // rail extends left over PL and its center sits −PL/2 from the body center.
    const PL = 20;
    const body = buildConnectors(
      baseParams({ edges: frontSeamEdges }),
      SOCKET_HEIGHT,
      WIDTH * GU,
      DEPTH * GU,
      0,
      0,
      true
    );
    const tongue = body.nubs[0];
    const tongueVol = vol(tongue);

    const railW = WIDTH * GU + PL; // extended over the left padding
    const grooveNoOffset = buildMarginSeamGroove(
      'front',
      railW,
      PF,
      SOCKET_HEIGHT,
      'dovetail',
      0,
      0.4
    );
    const grooveWithOffset = buildMarginSeamGroove(
      'front',
      railW,
      PF,
      SOCKET_HEIGHT,
      'dovetail',
      0,
      0.4,
      PL / 2 // cancels the −PL/2 rail-center shift
    );
    // Rail center world-x = body-center − PL/2 (extended over the left corner).
    const railWorldX = -PL / 2;
    const seat = (groove: typeof grooveNoOffset): number => {
      const world = translate(groove, [railWorldX, -(DEPTH * GU) / 2 - PF / 2, 0]);
      const inter = intersect(tongue, world);
      const overlap = isOk(inter) ? vol(inter.value) : 0;
      if (isOk(inter)) inter.value.delete();
      world.delete();
      return overlap / tongueVol;
    };

    expect(seat(grooveNoOffset), 'un-offset groove misses the tongue').toBeLessThan(0.1);
    expect(seat(grooveWithOffset), 'offset groove seats the tongue').toBeGreaterThan(0.9);

    tongue.delete();
    grooveNoOffset.delete();
    grooveWithOffset.delete();
  });

  it('the body tongue seats inside the rail groove in world space', () => {
    // Body tongue (body frame, centered): front wall at y = -DEPTH*GU/2.
    const { nubs } = buildConnectors(
      baseParams({ edges: frontSeamEdges }),
      SOCKET_HEIGHT,
      WIDTH * GU,
      DEPTH * GU,
      0,
      0,
      true
    );
    const tongue = nubs[0];
    const tongueVol = vol(tongue);

    // Groove cutter in the rail's local frame, then placed at the rail's world
    // offset — the same transform `buildMarginSolid` applies before lifting.
    const groove = buildMarginSeamGroove(
      'front',
      WIDTH * GU,
      PF,
      SOCKET_HEIGHT,
      'dovetail',
      0,
      0.4
    );
    const off = frontRail().worldOffsetMm;
    const grooveWorld = translate(groove, [off.x, off.y, 0]);

    const inter = intersect(tongue, grooveWorld);
    const overlap = isOk(inter) ? vol(inter.value) : 0;
    if (isOk(inter)) inter.value.delete();

    // The tongue must sit almost entirely inside the (clearance-grown) groove.
    expect(overlap / tongueVol, 'tongue seated in groove').toBeGreaterThan(0.9);

    tongue.delete();
    groove.delete();
    grooveWorld.delete();
  });
});
