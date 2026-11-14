// @vitest-environment node
/**
 * Margin-seam connector geometry: the body carries a single tongue on a
 * `marginSeam` wall, the long rail carries the matching groove, and the two mate
 * in world space. Verified on the real BREP solids.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { measureVolume, translate, intersect, fuse } from 'brepjs';
import type { Shape3D, ValidSolid } from 'brepjs';
import { isOk } from '@/core/result';
import type { ResolvedBaseplateParams, MarginPiece, BaseplateEdges } from '@/shared/types/bin';
import { TONGUE_PROTRUSION } from '@/shared/constants/connectors';
import { initBrepjs } from './__kernel-tests__/wasmInit';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import {
  buildConnectors,
  buildMarginSeamGroove,
  buildMarginSeamTongue,
  makeMarginSeamTongue,
} from './baseplateConnectors';
import { getPocketTemplate } from './baseplatePockets';
import { computeCellCentersMm } from './cellDecomposition';
import { generateMargin } from './baseplateMargin';
import { PLATE_PROFILE_HEIGHT } from './generatorTypes';

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
    seamConnector: { cellUnits: WIDTH, centerOffsetMm: 0, fractionalEdge: 'end' },
    overTile: false,
    overTileHalfGrid: false,
    overTileHalfGridSolidLeftover: false,
    ...over,
  };
}

/** Cell-center positions along a `units`-wide front seam (one per cell). */
function frontCenters(units: number): number[] {
  const c = computeCellCentersMm(units, GU, 'end');
  return c.length > 0 ? c : [0];
}

/**
 * Fuse all seam grooves for a front rail (one per cell, shifted by
 * `centerOffsetMm`) into the rail's world frame — the same set
 * `buildMarginSolid` carves.
 */
function frontGrooveUnion(rail: MarginPiece): Shape3D {
  const seam = rail.seamConnector!;
  const positions = frontCenters(seam.cellUnits).map((p) => p + seam.centerOffsetMm);
  const railW =
    rail.side === 'front' || rail.side === 'back' ? rail.lengthMm : rail.bandThicknessMm;
  const railD =
    rail.side === 'front' || rail.side === 'back' ? rail.bandThicknessMm : rail.lengthMm;
  let union: Shape3D | null = null;
  for (const pos of positions) {
    const g = buildMarginSeamGroove(
      rail.side,
      railW,
      railD,
      PLATE_PROFILE_HEIGHT,
      'dovetail',
      0,
      0.4,
      pos
    );
    const world = translate(g, [rail.worldOffsetMm.x, rail.worldOffsetMm.y, 0]);
    g.delete();
    union = union ? fuseWorldPiece(union, world) : world;
  }
  if (!union) throw new Error('frontGrooveUnion: no groove positions produced');
  return union;
}

/** Fuse `world` into the running `union`; on fuse failure, drop `world` and keep `union`. */
function fuseWorldPiece(union: Shape3D, world: Shape3D): Shape3D {
  const f = fuse(union as ValidSolid, world as ValidSolid);
  if (isOk(f)) {
    union.delete();
    world.delete();
    return f.value;
  }
  // Keep the running union; drop only the piece that failed to merge.
  world.delete();
  return union;
}

describe('margin-seam connector geometry (#2414)', () => {
  it('builds one body tongue per mating grid cell, independent of connectorNubs', () => {
    const { nubs, holes } = buildConnectors(
      baseParams({ edges: frontSeamEdges }),
      PLATE_PROFILE_HEIGHT,
      WIDTH * GU,
      DEPTH * GU,
      0,
      0
    );
    // A WIDTH-wide seam gets one tongue per cell.
    expect(nubs.length, 'one tongue per cell').toBe(WIDTH);
    expect(holes.length, 'no grooves on the body').toBe(0);
    for (const n of nubs) expect(vol(n), 'tongue has volume').toBeGreaterThan(0);
    nubs.forEach((n) => n.delete());
  });

  it('places a single tongue on a single-cell wall', () => {
    const { nubs } = buildConnectors(
      baseParams({ width: 1, edges: frontSeamEdges }),
      PLATE_PROFILE_HEIGHT,
      1 * GU,
      DEPTH * GU,
      0,
      0
    );
    expect(nubs.length).toBe(1);
    nubs.forEach((n) => n.delete());
  });

  it('builds no seam tongue for a marginSeam edge under a non-tongue style', () => {
    // Defensive: splitPlanner never assigns marginSeam for snapClip, but if it
    // did, buildConnectors must not emit a mismatched dovetail tongue.
    const { nubs } = buildConnectors(
      baseParams({ edges: frontSeamEdges, connectorStyle: 'snapClip' }),
      PLATE_PROFILE_HEIGHT,
      WIDTH * GU,
      DEPTH * GU,
      0,
      0
    );
    expect(nubs.length).toBe(0);
    nubs.forEach((n) => n.delete());
  });

  it('builds no seam tongue when the wall is a plain exterior edge', () => {
    const exterior: BaseplateEdges = { ...frontSeamEdges, front: 'exterior' };
    const { nubs } = buildConnectors(
      baseParams({ edges: exterior }),
      PLATE_PROFILE_HEIGHT,
      WIDTH * GU,
      DEPTH * GU,
      0,
      0
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

  it('cuts a groove into a short rail too (#4921)', () => {
    const shortRail = frontRail({ id: 'margin-left-1', side: 'left', role: 'short' });
    const conn = generateMargin(baseParams(), shortRail, true);
    const plain = generateMargin(baseParams({ detachMarginConnector: false }), shortRail, true);
    expect(conn.vertices.length).toBeGreaterThan(plain.vertices.length);
  });

  it('every body tongue seats in the matching rail groove in world space', () => {
    // Body tongues (body frame): front wall at y = -DEPTH*GU/2, one per boundary.
    const { nubs } = buildConnectors(
      baseParams({ edges: frontSeamEdges }),
      PLATE_PROFILE_HEIGHT,
      WIDTH * GU,
      DEPTH * GU,
      0,
      0
    );
    // The rail carves the same boundary set; every tongue must seat in the union.
    const grooveWorld = frontGrooveUnion(frontRail());
    for (const tongue of nubs) {
      const inter = intersect(tongue, grooveWorld);
      const overlap = isOk(inter) ? vol(inter.value) : 0;
      if (isOk(inter)) inter.value.delete();
      expect(overlap / vol(tongue), 'tongue seated in groove').toBeGreaterThan(0.9);
    }
    nubs.forEach((n) => n.delete());
    grooveWorld.delete();
  });

  it('every tongue still seats on a corner-owning end segment (#2427)', () => {
    // Model column 0 of a split: the front rail extends left over PL to own the
    // corner, so its center sits −PL/2 from the body grid center. The rail's
    // grooves recenter via centerOffsetMm = +PL/2; without it they'd all miss.
    const PL = 20;
    const { nubs } = buildConnectors(
      baseParams({ edges: frontSeamEdges }),
      PLATE_PROFILE_HEIGHT,
      WIDTH * GU,
      DEPTH * GU,
      0,
      0
    );
    const cornerRail = frontRail({
      lengthMm: WIDTH * GU + PL, // extended over the left padding
      worldOffsetMm: { x: -PL / 2, y: -(DEPTH * GU) / 2 - PF / 2 },
      seamConnector: { cellUnits: WIDTH, centerOffsetMm: PL / 2, fractionalEdge: 'end' },
    });
    const offsetGrooves = frontGrooveUnion(cornerRail);
    const misalignedGrooves = frontGrooveUnion(
      frontRail({
        lengthMm: WIDTH * GU + PL,
        worldOffsetMm: { x: -PL / 2, y: -(DEPTH * GU) / 2 - PF / 2 },
        seamConnector: { cellUnits: WIDTH, centerOffsetMm: 0, fractionalEdge: 'end' },
      })
    );

    let seatedOffset = 0;
    let seatedMisaligned = 0;
    for (const tongue of nubs) {
      const tv = vol(tongue);
      const a = intersect(tongue, offsetGrooves);
      if (isOk(a)) {
        if (vol(a.value) / tv > 0.9) seatedOffset++;
        a.value.delete();
      }
      const b = intersect(tongue, misalignedGrooves);
      if (isOk(b)) {
        if (vol(b.value) / tv > 0.9) seatedMisaligned++;
        b.value.delete();
      }
    }
    expect(seatedOffset, 'all tongues seat with the corner offset').toBe(nubs.length);
    expect(seatedMisaligned, 'without the offset the grooves miss').toBe(0);

    nubs.forEach((n) => n.delete());
    offsetGrooves.delete();
    misalignedGrooves.delete();
  });

  it('every tongue seats on a fractional-width wall', () => {
    // A fractional column (e.g. 2.5u → cells [1,1,0.5]) is the one place the
    // body and rail could disagree on cell centers if their fractionalEdge
    // diverged. Both derive from the same 'end' anchor, so all tongues must seat.
    const FW = 2.5;
    const { nubs } = buildConnectors(
      baseParams({ width: FW, fractionalEdgeX: 'end', edges: frontSeamEdges }),
      PLATE_PROFILE_HEIGHT,
      FW * GU,
      DEPTH * GU,
      0,
      0
    );
    expect(nubs.length, 'one tongue per cell incl. the half-cell').toBe(frontCenters(FW).length);
    const grooveWorld = frontGrooveUnion(
      frontRail({
        lengthMm: FW * GU,
        seamConnector: { cellUnits: FW, centerOffsetMm: 0, fractionalEdge: 'end' },
      })
    );
    for (const tongue of nubs) {
      const inter = intersect(tongue, grooveWorld);
      const overlap = isOk(inter) ? vol(inter.value) : 0;
      if (isOk(inter)) inter.value.delete();
      expect(overlap / vol(tongue), 'fractional-cell tongue seated').toBeGreaterThan(0.9);
    }
    nubs.forEach((n) => n.delete());
    grooveWorld.delete();
  });
});

describe('inverted margin seam (#5038)', () => {
  const inverted = (over: Partial<ResolvedBaseplateParams> = {}): ResolvedBaseplateParams =>
    baseParams({ connectorNubs: true, invertDovetails: true, edges: frontSeamEdges, ...over });

  const bodyConnectors = (params: ResolvedBaseplateParams) =>
    buildConnectors(params, PLATE_PROFILE_HEIGHT, WIDTH * GU, DEPTH * GU, 0, 0);

  /** A front-rail tongue at `pos`, moved into the world frame. */
  const worldTongue = (
    params: ResolvedBaseplateParams,
    rail: MarginPiece,
    pos: number
  ): Shape3D => {
    const t = buildMarginSeamTongue(params, rail, rail.lengthMm, PF, PLATE_PROFILE_HEIGHT, pos);
    const world = translate(t, [rail.worldOffsetMm.x, rail.worldOffsetMm.y, 0]);
    t.delete();
    return world;
  };

  it('cuts grooves into the body wall instead of growing tongues', () => {
    const { nubs, holes } = bodyConnectors(inverted());
    expect(nubs.length, 'no tongues on the body').toBe(0);
    expect(holes.length, 'one groove per cell').toBe(WIDTH);
    holes.forEach((h) => h.delete());
  });

  it.each([
    ['paired pieces', { preferIdenticalPieces: true }],
    ['split connectors off', { connectorNubs: false }],
  ])('keeps the body tongues under %s, where the panel hides the toggle', (_, over) => {
    const { nubs, holes } = bodyConnectors(inverted(over));
    expect(nubs.length).toBe(WIDTH);
    expect(holes.length).toBe(0);
    nubs.forEach((n) => n.delete());
  });

  it.each(['dovetail', 'puzzle'] as const)(
    'grows a %s tongue from the rail seam face instead of cutting a groove',
    (connectorStyle) => {
      const rail = frontRail();
      const plain = generateMargin(baseParams({ connectorStyle }), rail, true);
      const inv = generateMargin(inverted({ connectorStyle }), rail, true);
      const seamFace = PF / 2;
      expect(boundingBox(plain.vertices).maxY).toBeCloseTo(seamFace, 2);
      expect(boundingBox(inv.vertices).maxY).toBeGreaterThan(seamFace + TONGUE_PROTRUSION - 0.05);
    }
  );

  it.each(['dovetail', 'puzzle'] as const)(
    'seats every %s rail tongue in a body groove in world space',
    (connectorStyle) => {
      const params = inverted({ connectorStyle });
      const { holes } = bodyConnectors(params);
      let grooves: Shape3D = holes[0];
      for (const h of holes.slice(1)) grooves = fuseWorldPiece(grooves, h);
      const rail = frontRail();
      for (const pos of frontCenters(WIDTH)) {
        const tongue = worldTongue(params, rail, pos);
        const inter = intersect(tongue, grooves);
        const overlap = isOk(inter) ? vol(inter.value) : 0;
        if (isOk(inter)) inter.value.delete();
        expect(overlap / vol(tongue), `tongue at ${pos} seated`).toBeGreaterThan(0.95);
        tongue.delete();
      }
      grooves.delete();
    }
  );

  it('trims the rail tongue out of the body socket where a bin foot seats', () => {
    const params = inverted({ connectorStyle: 'puzzle' });
    const rail = frontRail();
    const pos = frontCenters(WIDTH)[0];
    // Front-row body cell under the first tongue.
    const pocket = getPocketTemplate(GU, GU, true, 0, PLATE_PROFILE_HEIGHT);
    const socket = translate(pocket, [pos, -(DEPTH * GU) / 2 + GU / 2, 0]);
    pocket.delete();
    const toWorld = (s: Shape3D): Shape3D => {
      const w = translate(s, [rail.worldOffsetMm.x, rail.worldOffsetMm.y, 0]);
      s.delete();
      return w;
    };
    const overlapWithSocket = (s: Shape3D): number => {
      const inter = intersect(s, socket);
      const v = isOk(inter) ? vol(inter.value) : 0;
      if (isOk(inter)) inter.value.delete();
      return v;
    };
    const raw = toWorld(
      makeMarginSeamTongue('front', rail.lengthMm, PF, PLATE_PROFILE_HEIGHT, 'puzzle', pos)
    );
    const built = worldTongue(params, rail, pos);
    expect(overlapWithSocket(raw), 'an untrimmed tongue pokes into the socket').toBeGreaterThan(
      0.5
    );
    expect(overlapWithSocket(built), 'the built tongue stays out of it').toBeLessThan(1e-3);
    raw.delete();
    built.delete();
    socket.delete();
  });
});
