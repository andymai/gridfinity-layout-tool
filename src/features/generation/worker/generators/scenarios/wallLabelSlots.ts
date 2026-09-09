/**
 * Vertical label slots, measured where a bounding box or a watertight check
 * cannot see them: column probes through the frame, the slot, the post and
 * the boss of each planned socket.
 */
import { expect } from 'vitest';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { columnCrossings } from '../__kernel-tests__/meshAssertions';
import { deriveDimensions } from '../pipeline/context';
import { planForContext } from '../wallLabelSlotBuilder';
import {
  WALL_LABEL_SLOT_BOTTOM_BAR_MM,
  planWallLabelSlotCorners,
} from '@/shared/utils/wallLabelSlotPlan';
import type { WallLabelSlotSide } from '@/shared/utils/wallLabelSlotPlan';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { MeshData } from '@/features/generation/bridge/types';

const SIDES_OFF = { front: false, back: false, left: false, right: false };

/** Bin-frame XY of a point on one wall: `along` from the wall's centre, `inward` from the outer face. */
function wallPoint(
  params: BinParams,
  side: WallLabelSlotSide,
  along: number,
  inward: number
): [number, number] {
  const dim = deriveDimensions(params, false);
  const t = params.wallThickness;
  switch (side) {
    case 'front':
      return [dim.innerOffsetX + along, dim.innerOffsetY - dim.innerD / 2 - t + inward];
    case 'back':
      return [dim.innerOffsetX + along, dim.innerOffsetY + dim.innerD / 2 + t - inward];
    case 'left':
      return [dim.innerOffsetX - dim.innerW / 2 - t + inward, dim.innerOffsetY + along];
    case 'right':
      return [dim.innerOffsetX + dim.innerW / 2 + t - inward, dim.innerOffsetY + along];
  }
}

function topAt(
  mesh: MeshData,
  params: BinParams,
  side: WallLabelSlotSide,
  along: number,
  inward: number
): number {
  const [x, y] = wallPoint(params, side, along, inward);
  const zs = columnCrossings(mesh, x, y);
  return zs.length === 0 ? Number.NEGATIVE_INFINITY : Math.max(...zs);
}

/** Whether the column through a wall point is inside material at height `z`. */
function solidAt(
  mesh: MeshData,
  params: BinParams,
  side: WallLabelSlotSide,
  along: number,
  inward: number,
  z: number
): boolean {
  const [x, y] = wallPoint(params, side, along, inward);
  // Parity counted from the open air above rather than from the base: the
  // preview mesh concatenates the socket below with coincident faces that
  // confuse any pairing that starts there, and nothing above a wall does.
  const above = columnCrossings(mesh, x, y).filter((c) => c > z).length;
  return above % 2 === 1;
}

function assertSockets(mesh: MeshData, params: BinParams): void {
  const dim = deriveDimensions(params, false);
  const plan = planForContext(params, dim);
  expect(plan.refusal).toBeNull();
  expect(plan.slots.length).toBeGreaterThan(0);
  const z0 = dim.baseOffsetZ;
  const t = params.wallThickness;
  for (const slot of plan.slots) {
    const frameMid = plan.frameMm / 2;
    const slotMid = plan.frameMm + plan.slotThicknessMm / 2;
    const backMid = plan.frameMm + plan.slotThicknessMm + 0.5;
    // Window: the frame is open above its bottom bar.
    expect(topAt(mesh, params, slot.side, slot.offset, frameMid)).toBeCloseTo(
      z0 + plan.floorZ + WALL_LABEL_SLOT_BOTTOM_BAR_MM,
      1
    );
    // Slot: open from the plate's underside all the way up.
    expect(topAt(mesh, params, slot.side, slot.offset, slotMid)).toBeCloseTo(z0 + plan.floorZ, 1);
    // Posts: frame stands beside the window, up to the rim.
    const post = plan.windowWidthMm / 2 + (plan.socketWidthMm - plan.windowWidthMm) / 4;
    expect(topAt(mesh, params, slot.side, slot.offset + post, frameMid)).toBeGreaterThanOrEqual(
      z0 + plan.wallTopZ - 0.05
    );
    // Back: the boss closes the slot behind the plate, mid-way up it.
    const midPlate = z0 + (plan.floorZ + plan.plateTopZ) / 2;
    expect(solidAt(mesh, params, slot.side, slot.offset, backMid, midPlate)).toBe(true);
    // Beside the socket the boss is gone and only the wall remains: probed
    // inside the boss's own height band, below the lip's inward overhang.
    const beside = t + plan.bossDepthMm / 2;
    expect(
      solidAt(mesh, params, slot.side, slot.offset + plan.bossWidthMm / 2 + 1.5, beside, midPlate)
    ).toBe(false);
  }
}

export const wallLabelSlots: ScenarioCase[] = [
  defineScenario('wall label slots', 'one slot per cell along the front wall', {
    params: {
      width: 3,
      depth: 2,
      height: 6,
      wallLabelSlots: { enabled: true, sides: { ...SIDES_OFF, front: true }, everyCells: 1 },
    },
    assert: 'structural',
    customAssert: (mesh, params) => {
      assertSockets(mesh, params);
      expect(planForContext(params, deriveDimensions(params, false)).slots).toHaveLength(3);
    },
  }),
  defineScenario('wall label slots', 'every other cell on a side wall, lip off', {
    params: {
      width: 2,
      depth: 4,
      height: 6,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      wallLabelSlots: { enabled: true, sides: { ...SIDES_OFF, right: true }, everyCells: 2 },
    },
    assert: 'structural',
    customAssert: (mesh, params) => {
      assertSockets(mesh, params);
      const plan = planForContext(params, deriveDimensions(params, false));
      expect(plan.slots.map((s) => s.offset)).toEqual([-63, 21]);
      // The skipped cell keeps a plain wall.
      const z0 = deriveDimensions(params, false).baseOffsetZ;
      expect(topAt(mesh, params, 'right', -21, plan.frameMm / 2)).toBeGreaterThanOrEqual(
        z0 + plan.wallTopZ - 0.05
      );
    },
  }),
  defineScenario('wall label slots', 'all four walls of a lipped bin, with a wall pattern', {
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      wallLabelSlots: {
        enabled: true,
        sides: { front: true, back: true, left: true, right: true },
        everyCells: 1,
      },
    },
    assert: 'structural',
    customAssert: (mesh, params) => {
      assertSockets(mesh, params);
      const dim = deriveDimensions(params, false);
      const plan = planForContext(params, dim);
      expect(plan.slots).toHaveLength(8);
      // Adjacent cavities meet on the grid pitch; each corner is joined by a
      // channel rather than touching along an edge.
      const corners = planWallLabelSlotCorners(plan, params, dim, dim);
      expect(corners).toHaveLength(4);
      const midPlate = dim.baseOffsetZ + (plan.floorZ + plan.plateTopZ) / 2;
      for (const corner of corners) {
        const cx = (corner.x[0] + corner.x[1]) / 2;
        const cy = (corner.y[0] + corner.y[1]) / 2;
        const side = cy < 0 ? 'front' : 'back';
        const inward = params.wallThickness + dim.innerD / 2 - Math.abs(cy);
        expect(solidAt(mesh, params, side, cx, inward, midPlate)).toBe(false);
      }
    },
  }),
  // The wrapped lattice steps aside for label slots the way it does for
  // divider slots: its corner cutters cannot take the slot keep-out, so the
  // walls stay solid rather than perforating the plate's backing.
  defineScenario('wall label slots', 'a kumiko lattice steps aside for label slots', {
    timeout: 180_000,
    params: {
      width: 2,
      depth: 2,
      height: 6,
      wallPattern: { enabled: true, pattern: 'asanoha', scale: 0.5 },
      wallLabelSlots: { enabled: true, sides: { ...SIDES_OFF, front: true }, everyCells: 1 },
    },
    assert: 'structural',
    compareWith: {
      params: {
        width: 2,
        depth: 2,
        height: 6,
        wallLabelSlots: { enabled: true, sides: { ...SIDES_OFF, front: true }, everyCells: 1 },
      },
      assert: (result, plain) => {
        expect(result.triangleCount).toBe(plain.triangleCount);
      },
    },
    customAssert: (mesh, params) => {
      assertSockets(mesh, params);
    },
  }),
];
