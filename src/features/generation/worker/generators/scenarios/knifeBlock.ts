import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { BinParams, KnifeSpec } from '@/shared/types/bin';
import { planKnifeRest } from '@/shared/utils/knifeRestPlan';
import { defineScenario, makeCutout, buildParams } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { boundingBox, columnCrossings } from '../__kernel-tests__/meshAssertions';
import type { MeshData } from '@/features/generation/bridge/types';

const SOLID_BASE = { ...DEFAULT_BIN_PARAMS.base, solid: true };

const CHEF: KnifeSpec = {
  presetId: 'chef8',
  bladeLengthMm: 205,
  heelHeightMm: 47,
  spineThicknessMm: 2.3,
  handleWidthMm: 23,
  handleHeightMm: 23,
  openEnd: 'end',
};

/** 6x1x8 block with a chef slot along X; `openEnd` decides the wall breach. */
function chefBlock(openEnd: boolean): Partial<BinParams> {
  return {
    style: 'solid',
    width: 6,
    depth: 1,
    height: 8,
    base: SOLID_BASE,
    cutouts: [
      makeCutout({
        shape: 'knifeSlot',
        x: 20,
        y: 16,
        width: 215,
        depth: 3.8,
        cutDepth: 51,
        chamferWidth: 1.2,
        knife: { ...CHEF, openEnd: openEnd ? 'end' : undefined },
      }),
    ],
  };
}

/**
 * Highest surface over a column inside the perimeter wall. Parity-free on
 * purpose: the base/body seam leaves a coincident internal face that flips
 * `verticalSolidSpans` pairing, but the LAST crossing is the wall (or lip) top
 * whatever happens below it — and a breach drags it down to the slot floor.
 */
function columnTopZ(mesh: MeshData, x: number, y: number): number {
  const crossings = columnCrossings(mesh, x, y);
  return crossings.length > 0 ? crossings[crossings.length - 1] : Number.NEGATIVE_INFINITY;
}

/** Column tops across a world-Y scan just inside the +X wall face. */
function wallTops(mesh: MeshData, x: number, from: number, to: number, step: number): number[] {
  const tops: number[] = [];
  for (let py = from; py <= to; py += step) tops.push(columnTopZ(mesh, x, py));
  return tops;
}

export const knifeBlock: ScenarioCase[] = [
  defineScenario('knife block', '6x1x8 solid with enclosed chef knife slot', {
    params: chefBlock(false),
  }),
  defineScenario('knife block', '6x1x8 chef slot open end breaches the +X wall and lip', {
    params: chefBlock(true),
    compareWith: {
      params: chefBlock(false),
      assert: (open, enclosed) => {
        const bb = boundingBox(open.vertices);
        const px = bb.maxX - 0.6;
        const openTops = wallTops(open, px, -3, 3, 0.5);
        const enclosedTops = wallTops(enclosed, px, -3, 3, 0.5);
        // Enclosed: the end wall (and its lip) is intact across the whole scan.
        for (const top of enclosedTops) expect(top).toBeGreaterThan(bb.maxZ - 1.5);
        // Open end: at the slot's centerline the exit removes the wall and lip
        // all the way down to the slot floor (the base socket top), while the
        // wall survives beside the exit — and never cuts INTO the socket.
        const breached = openTops.filter((top) => top < bb.maxZ - 40);
        expect(breached.length).toBeGreaterThanOrEqual(4);
        for (const top of breached) expect(top).toBeGreaterThan(3.5);
        expect(openTops.some((top) => top > bb.maxZ - 1.5)).toBe(true);
      },
    },
  }),
  defineScenario('knife block', '6x1x8 open chef slot ignores wall patterns (solid host)', {
    params: {
      ...chefBlock(true),
      wallPattern: { enabled: true, pattern: 'honeycomb' },
    },
    compareWith: {
      params: chefBlock(true),
      // Sentinel, not a wish: featuresStage's solid branch returns before the
      // wall-pattern section, so a solid host emits no pattern and no exit
      // border clip exists for one. If patterns ever reach solid bins this
      // inequality flips — and the knife exits then need a border clip in
      // computeWallClips (gotcha 5) fed from knifeSlotWallExits, or the
      // pattern prisms straddling the exit are sliced jagged.
      assert: (patterned, plain) => {
        expect(patterned.triangleCount).toBe(plain.triangleCount);
        const bb = boundingBox(patterned.vertices);
        const px = bb.maxX - 0.6;
        expect(wallTops(patterned, px, -3, 3, 0.5).some((top) => top < bb.maxZ - 40)).toBe(true);
      },
    },
  }),
  defineScenario('knife block', '6x1x8 chef slot with integrated rear rest shelf', {
    params: {
      ...chefBlock(true),
      knifeRest: { enabled: true, style: 'integrated' },
    },
    compareWith: {
      params: chefBlock(true),
      assert: (withRest, plain) => {
        const plan = planKnifeRest(
          buildParams({ ...chefBlock(true), knifeRest: { enabled: true, style: 'integrated' } })
        );
        expect(plan).not.toBeNull();
        if (!plan) return;
        // Front (slotted) section untouched: full fill height either way.
        expect(columnTopZ(withRest, 0, 10)).toBeCloseTo(columnTopZ(plain, 0, 10), 1);
        // Rear section dropped to the shelf, with the blade slit still open
        // through it and the cradle sunk between shelf and saddle. The flat
        // shelf is probed OUTSIDE the groove's half-width (~14.5mm for a chef
        // handle) — y=16 clears it while staying inside the interior.
        const rearX = 115;
        expect(columnTopZ(withRest, rearX, 16)).toBeCloseTo(plan.bodyTopZMm, 0.5);
        expect(columnTopZ(plain, rearX, 16)).toBeGreaterThan(plan.bodyTopZMm + 10);
        const grooveY = plan.grooves[0].centre;
        expect(columnTopZ(withRest, rearX, grooveY)).toBeLessThan(6);
        const cradle = columnTopZ(withRest, rearX, grooveY + 4);
        expect(cradle).toBeLessThan(plan.bodyTopZMm - 1);
        expect(cradle).toBeGreaterThan(plan.bodyTopZMm - plan.grooves[0].depthMm - 0.5);
      },
    },
  }),
  defineScenario('knife block', '3x1x4 steak slot row (repeat array) with open ends', {
    params: {
      style: 'solid',
      width: 3,
      depth: 1,
      height: 4,
      base: SOLID_BASE,
      cutouts: [
        makeCutout({
          shape: 'knifeSlot',
          x: 3,
          y: 6,
          width: 115,
          depth: 3,
          cutDepth: 23,
          chamferWidth: 1.2,
          knife: {
            presetId: 'steak',
            bladeLengthMm: 115,
            heelHeightMm: 19,
            spineThicknessMm: 1.5,
            handleWidthMm: 19,
            handleHeightMm: 19,
            openEnd: 'end',
          },
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
      ],
    },
    customAssert: (result) => {
      const bb = boundingBox(result.vertices);
      const px = bb.maxX - 0.6;
      // Every array instance's exit must clear the wall: three ~3mm openings
      // 12mm apart, with wall standing between them. Count transitions from
      // intact rim to breached column and back along the scan.
      const tops = wallTops(result, px, -16, 16, 0.25);
      const breachedFlags = tops.map((top) => top < bb.maxZ - 10);
      const breachedRuns = breachedFlags.reduce(
        (runs, flag, i) => runs + (flag && !breachedFlags[i - 1] ? 1 : 0),
        0
      );
      expect(breachedRuns).toBe(3);
      expect(breachedFlags.some((flag) => !flag)).toBe(true);
    },
  }),
];
