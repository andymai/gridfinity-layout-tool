import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { boundingBox, columnCrossings } from '../__kernel-tests__/meshAssertions';
import type { MeshData } from '@/features/generation/bridge/types';

const SOLID_BASE = { ...DEFAULT_BIN_PARAMS.base, solid: true };

/** 2x1 interior at the default wall (84 − 0.5 − 2.4 by 42 − 0.5 − 2.4). */
const INNER_W = 81.1;
const INNER_D = 39.1;

/**
 * 2x1x4 solid block with one 30×20 pocket, 21mm of fill between its right
 * edge and the +X wall, centred front to back. Pocket floor sits 10mm down.
 */
function block(extra: Partial<Cutout> = {}): Partial<BinParams> {
  return {
    style: 'solid',
    width: 2,
    depth: 1,
    height: 4,
    base: SOLID_BASE,
    cutouts: [
      makeCutout({
        shape: 'rectangle',
        x: 30,
        y: (INNER_D - 20) / 2,
        width: 30,
        depth: 20,
        cutDepth: 10,
        cornerRadius: 2,
        ...extra,
      }),
    ],
  };
}

/**
 * The Corner Index Block example (`data/examples/indexBlock.ts`), restated here
 * because a generator scenario cannot import a feature's data. Body arm exits
 * right, tongue exits front; the two meet at the square's corner.
 */
function cornerIndexBlock(): Partial<BinParams> {
  const inner = 81.1;
  const inset = 14;
  const body = 38.7;
  const tongue = 26;
  return {
    style: 'solid',
    width: 2,
    depth: 2,
    height: 3,
    base: SOLID_BASE,
    cutouts: [
      makeCutout({
        id: 'body',
        shape: 'rectangle',
        x: inset,
        y: inner - inset - body,
        width: inner - inset,
        depth: body,
        cutDepth: 6,
        cornerRadius: 1,
        openSides: ['right'],
      }),
      makeCutout({
        id: 'tongue',
        shape: 'rectangle',
        x: inset,
        y: 0,
        width: tongue,
        depth: inner - inset,
        cutDepth: 6,
        cornerRadius: 1,
        openSides: ['front'],
      }),
    ],
  };
}

/** Highest surface over a column: the last crossing is the wall or lip top. */
function columnTopZ(mesh: MeshData, x: number, y: number): number {
  const crossings = columnCrossings(mesh, x, y);
  return crossings.length > 0 ? crossings[crossings.length - 1] : Number.NEGATIVE_INFINITY;
}

function scanTops(
  mesh: MeshData,
  axis: 'x' | 'y',
  fixed: number,
  from: number,
  to: number,
  step: number
): { at: number; top: number }[] {
  const out: { at: number; top: number }[] = [];
  for (let p = from; p <= to; p += step) {
    out.push({
      at: p,
      top: axis === 'y' ? columnTopZ(mesh, fixed, p) : columnTopZ(mesh, p, fixed),
    });
  }
  return out;
}

/** The +X wall, scanned just inside its outer face, must be whole. */
function expectWallIntact(mesh: MeshData): void {
  const bb = boundingBox(mesh.vertices);
  for (const { top } of scanTops(mesh, 'y', bb.maxX - 0.6, -15, 15, 0.5)) {
    expect(top).toBeGreaterThan(bb.maxZ - 1.5);
  }
}

/** Deeper than the stacking lip, so a lowered wall top is a breach and not a lip cut. */
const BREACH_DROP_MM = 8;

/**
 * A breach reads as wall tops dropped to the pocket floor inside the opening's
 * span and left whole beside it — and never cut into the base socket.
 */
function expectBreach(
  mesh: MeshData,
  axis: 'x' | 'y',
  fixed: number,
  lo: number,
  hi: number
): void {
  const bb = boundingBox(mesh.vertices);
  const tops = scanTops(mesh, axis, fixed, lo - 6, hi + 6, 0.5);
  for (const { at, top } of tops) {
    if (at > lo + 0.5 && at < hi - 0.5) {
      expect(top, `breached at ${at}`).toBeLessThan(bb.maxZ - BREACH_DROP_MM);
      expect(top, `socket intact at ${at}`).toBeGreaterThan(3.5);
    } else if (at < lo - 1 || at > hi + 1) {
      expect(top, `wall whole at ${at}`).toBeGreaterThan(bb.maxZ - 1.5);
    }
  }
}

export const openSides: ScenarioCase[] = [
  defineScenario('open sides', '2x1x4 solid with an enclosed pocket', { params: block() }),
  defineScenario('open sides', '2x1x4 pocket open right breaches the +X wall and lip', {
    params: block({ openSides: ['right'] }),
    compareWith: {
      params: block(),
      assert: (open, enclosed) => {
        expectWallIntact(enclosed);
        const bb = boundingBox(open.vertices);
        expectBreach(open, 'y', bb.maxX - 0.6, -10, 10);
        // The fill between the pocket and the wall goes too: the channel is
        // the pocket's floor carried out through the wall, not a window.
        const floor = columnTopZ(open, 60 - INNER_W / 2 - 5, 0);
        expect(columnTopZ(open, bb.maxX - 6, 0)).toBeCloseTo(floor, 1);
      },
    },
  }),
  defineScenario('open sides', '2x1x4 pocket rotated 90° opens through the front wall', {
    params: block({ rotation: 90, openSides: ['front'] }),
    customAssert: (result) => {
      const bb = boundingBox(result.vertices);
      // Rotated a quarter turn the 30-wide pocket spans 20 along X, centred
      // where its unrotated centre was (x = 45 in the interior frame).
      const cx = 45 - INNER_W / 2;
      expectBreach(result, 'x', bb.minY + 0.6, cx - 10, cx + 10);
    },
  }),
  defineScenario('open sides', '2x1x4 pocket open on two adjacent walls breaches both', {
    params: block({ openSides: ['right', 'front'] }),
    customAssert: (result) => {
      const bb = boundingBox(result.vertices);
      expectBreach(result, 'y', bb.maxX - 0.6, -10, 10);
      const cx = 45 - INNER_W / 2;
      expectBreach(result, 'x', bb.minY + 0.6, cx - 15, cx + 15);
    },
  }),
  defineScenario('open sides', '2x1x4 open pocket drops the scoop on the opened edge only', {
    params: block({ openSides: ['right'], scoopRadiusW: 6, scoopRadiusD: 6 }),
    compareWith: {
      params: block({ scoopRadiusW: 6, scoopRadiusD: 6 }),
      assert: (open, enclosed) => {
        const rightEdge = 60 - INNER_W / 2;
        const leftEdge = 30 - INNER_W / 2;
        const floor = columnTopZ(open, (rightEdge + leftEdge) / 2, 0);
        // Enclosed: the fillet lifts the floor 1mm in from both side walls.
        expect(columnTopZ(enclosed, rightEdge - 1, 0)).toBeGreaterThan(floor + 1);
        expect(columnTopZ(enclosed, leftEdge + 1, 0)).toBeGreaterThan(floor + 1);
        // Open right: flat out to the wall, still scooped on the closed side.
        expect(columnTopZ(open, rightEdge - 1, 0)).toBeCloseTo(floor, 1);
        expect(columnTopZ(open, leftEdge + 1, 0)).toBeGreaterThan(floor + 1);
      },
    },
  }),
  defineScenario('open sides', '2x1x4 repeat array opens every copy', {
    params: block({
      depth: 8,
      y: 4,
      openSides: ['right'],
      array: {
        mode: 'grid',
        cols: 1,
        rows: 3,
        pitchX: 12,
        pitchY: 12,
        count: 1,
        radius: 20,
        startAngle: 0,
        rotateToCenter: false,
      },
    }),
    customAssert: (result) => {
      const bb = boundingBox(result.vertices);
      const tops = scanTops(result, 'y', bb.maxX - 0.6, -18, 18, 0.25);
      const breached = tops.map(({ top }) => top < bb.maxZ - BREACH_DROP_MM);
      const runs = breached.reduce((n, flag, i) => n + (flag && !breached[i - 1] ? 1 : 0), 0);
      expect(runs).toBe(3);
    },
  }),
  defineScenario('open sides', '2x1x4 open side is ignored off the 90° grid', {
    params: block({ rotation: 45, openSides: ['right'] }),
    customAssert: expectWallIntact,
  }),
  defineScenario('open sides', '2x1x4 open side is ignored inside a boolean group', {
    params: {
      ...block(),
      cutouts: [
        makeCutout({
          id: 'a',
          shape: 'rectangle',
          x: 30,
          y: 9.55,
          width: 30,
          depth: 20,
          cutDepth: 10,
          groupId: 'g',
          groupOp: 'union',
          openSides: ['right'],
        }),
        makeCutout({
          id: 'b',
          shape: 'rectangle',
          x: 20,
          y: 12,
          width: 20,
          depth: 10,
          cutDepth: 8,
          groupId: 'g',
          groupOp: 'union',
        }),
      ],
    },
    customAssert: expectWallIntact,
  }),
  defineScenario('open sides', '2x1x4 open side is ignored under a tapered wall', {
    params: {
      ...block({ openSides: ['right'] }),
      overhang: {
        enabled: true,
        left: 3,
        right: 3,
        front: 3,
        back: 3,
        taper: {
          enabled: true,
          profile: 'chamfer',
          bandHeight: 6,
          left: 3,
          right: 3,
          front: 3,
          back: 3,
        },
      },
    },
    customAssert: expectWallIntact,
  }),
  defineScenario('open sides', 'corner index block holds a framing square', {
    params: cornerIndexBlock(),
    customAssert: (result) => {
      const bb = boundingBox(result.vertices);
      const inner = 81.1;
      // Body arm leaves through the right wall across its 38.7mm width.
      const bodyLo = inner - 14 - 38.7 - inner / 2;
      expectBreach(result, 'y', bb.maxX - 0.6, bodyLo, bodyLo + 38.7);
      // Tongue leaves through the front wall across its 26mm width.
      const tongueLo = 14 - inner / 2;
      expectBreach(result, 'x', bb.minY + 0.6, tongueLo, tongueLo + 26);
      // The two walls the square does not exit stay whole.
      for (const { top } of scanTops(result, 'y', bb.minX + 0.6, -35, 35, 1)) {
        expect(top).toBeGreaterThan(bb.maxZ - 1.5);
      }
      for (const { top } of scanTops(result, 'x', bb.maxY - 0.6, -35, 35, 1)) {
        expect(top).toBeGreaterThan(bb.maxZ - 1.5);
      }
    },
  }),
];
