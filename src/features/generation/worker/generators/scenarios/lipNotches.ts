import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DISABLED_WALL_CUTOUT, GRIDFINITY } from '@/shared/constants/bin';
import { LIP_TIP_MM } from '@/shared/types/bin';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { boundingBox, verticalSolidSpans } from '../__kernel-tests__/meshAssertions';
import { defineScenario } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';
import { LIP_NOTCH_REACH_MM, LIP_NOTCH_TOP_DROP_MM } from '../boxTopShape';

const SIZE = GRIDFINITY.GRID_SIZE;
const HEIGHT = 3;
const PEAK_Z = HEIGHT * GRIDFINITY.HEIGHT_UNIT + GRIDFINITY.LIP_HEIGHT;
const WALL_TOP_Z = PEAK_Z - GRIDFINITY.LIP_HEIGHT;
const NOTCH_TOP_Z = PEAK_Z - LIP_NOTCH_TOP_DROP_MM;

/**
 * Probe depth in from the outer face: past the plain lip's deepest inset
 * (`LIP_TAPER_WIDTH`, 2.6mm) and the default wall, short of the notch's reach,
 * so only a notch can put lip material there.
 */
const PROBE_IN = 3;

/**
 * The span a notch puts in the probe column, or undefined when there is none.
 * Read off the export mesh: parity-paired column probes can misread a preview.
 */
function notchSpan(
  mesh: MeshData,
  x: number,
  y: number,
  wallTopZ = WALL_TOP_Z
): readonly [number, number] | undefined {
  return verticalSolidSpans(mesh, x, y).find(([, top]) => top > wallTopZ);
}

/** Probe point `PROBE_IN` inside the front wall at `x`. */
function frontProbe(depthUnits: number, x: number): [number, number] {
  return [x, -(depthUnits * SIZE - GRIDFINITY.TOLERANCE) / 2 + PROBE_IN];
}

function expectNotchAt(mesh: MeshData, x: number, y: number): void {
  const span = notchSpan(mesh, x, y);
  expect(span, `notch at (${x}, ${y})`).toBeDefined();
  if (!span) return;
  const [bottom, top] = span;
  // Stops short of the peak so the knife edge stays one loop...
  expect(top).toBeCloseTo(NOTCH_TOP_Z, 2);
  // ...and hangs below the wall top on its 45 degree underside, the lip's own
  // support carried on: at PROBE_IN that face is (reach - PROBE_IN) under the
  // point where it meets the reach.
  expect(bottom).toBeLessThan(WALL_TOP_Z);
  expect(bottom).toBeGreaterThan(WALL_TOP_Z - (LIP_NOTCH_REACH_MM - PROBE_IN) - 0.5);
}

function expectNoNotchAt(mesh: MeshData, x: number, y: number): void {
  expect(notchSpan(mesh, x, y), `no notch at (${x}, ${y})`).toBeUndefined();
}

function notched(width: number, depth: number, extra: Partial<BinParams> = {}): Partial<BinParams> {
  return {
    width,
    depth,
    height: HEIGHT,
    ...extra,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, lipNotches: true, ...extra.base },
  };
}

export const lipNotches: ScenarioCase[] = [
  defineScenario('lip-notches #4783', '3x2 notches every internal grid line', {
    assert: 'structural',
    forExport: true,
    params: notched(3, 2),
    customAssert: (result) => {
      // Front wall: grid lines at x = -21 and +21; mid-cell at -42 and 0.
      for (const x of [-21, 21]) expectNotchAt(result, ...frontProbe(2, x));
      for (const x of [-42, 0]) expectNoNotchAt(result, ...frontProbe(2, x));
      // Left wall: one grid line at y = 0.
      const xLeft = -(3 * SIZE - GRIDFINITY.TOLERANCE) / 2 + PROBE_IN;
      expectNotchAt(result, xLeft, 0);
      expectNoNotchAt(result, xLeft, 21);

      // Notches live inside the lip: the silhouette and the peak are untouched.
      const bb = boundingBox(result.vertices);
      expect(bb.maxX - bb.minX).toBeCloseTo(3 * SIZE - GRIDFINITY.TOLERANCE, 3);
      expect(bb.maxY - bb.minY).toBeCloseTo(2 * SIZE - GRIDFINITY.TOLERANCE, 3);
      expect(bb.maxZ).toBeCloseTo(PEAK_Z, 3);
    },
  }),
  defineScenario('lip-notches #4783', 'half-unit notches follow the fractional edge', {
    assert: 'structural',
    forExport: true,
    // Cells run [0.5, 1, 1] from the left, so the lines sit 21mm and 63mm in.
    params: notched(2.5, 1, { fractionalEdgeX: 'start' }),
    customAssert: (result) => {
      const left = -(2.5 * SIZE) / 2;
      for (const x of [left + 21, left + 63]) expectNotchAt(result, ...frontProbe(1, x));
      // Where an 'end' edge would put its first line: mid-cell here.
      expectNoNotchAt(result, ...frontProbe(1, left + 42));
    },
  }),
  defineScenario('lip-notches #4783', 'short wall keeps its notches without a support', {
    assert: 'structural',
    forExport: true,
    params: notched(2, 1, { height: 1 }),
    customAssert: (result) => {
      const wallTop = GRIDFINITY.HEIGHT_UNIT;
      const peak = wallTop + GRIDFINITY.LIP_HEIGHT;
      const [x, y] = frontProbe(1, 0);
      const span = notchSpan(result, x, y, wallTop);
      expect(span).toBeDefined();
      expect(span?.[1]).toBeCloseTo(peak - LIP_NOTCH_TOP_DROP_MM, 2);
    },
  }),
  defineScenario('lip-notches #4783', 'a rounded peak still rounds over notches', {
    assert: 'structural',
    forExport: true,
    params: notched(2, 2, {
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, lipNotches: true, lipTip: 'round' },
    }),
    customAssert: (result) => {
      // An untreated knife edge pins maxZ at the nominal peak, which is what a
      // finish silently refused by the kernel looks like.
      const dropped = PEAK_Z - boundingBox(result.vertices).maxZ;
      expect(dropped).toBeGreaterThan(LIP_TIP_MM / 2);
      expect(dropped).toBeLessThan(LIP_TIP_MM * 2);
      expectNotchAt(result, ...frontProbe(2, 0));
    },
  }),
  defineScenario('lip-notches #4783', 'a divider slot on a grid line clears through the notch', {
    assert: 'structural',
    forExport: true,
    // 42mm pitch puts the divider on the side walls' grid line, y = 0.
    params: notched(2, 2, {
      style: 'slotted',
      slotConfig: { ...DEFAULT_BIN_PARAMS.slotConfig, x: { enabled: true, pitch: SIZE } },
    }),
    customAssert: (result) => {
      const xLeft = -(2 * SIZE - GRIDFINITY.TOLERANCE) / 2 + PROBE_IN;
      // The divider's path is open past the plain lip's reach...
      expectNoNotchAt(result, xLeft, 0);
      // ...while the notch survives either side of it, and on the slotless wall.
      expect(notchSpan(result, xLeft, 2)).toBeDefined();
      expectNotchAt(result, ...frontProbe(2, 0));
    },
  }),
  defineScenario('lip-notches #4783', 'a wall cutout on a grid line clears the whole notch', {
    assert: 'structural',
    forExport: true,
    // The thinnest wall and divider leave the cutout tool the least reach to
    // spare past the notch.
    params: notched(2, 2, {
      wallThickness: 0.4,
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, thickness: 0.4 },
      walls: {
        enabled: true,
        shape: 'u-shape',
        width: 0,
        depth: 0,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 30, depth: 40 },
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
        interior: DISABLED_WALL_CUTOUT,
      },
    }),
    customAssert: (result) => {
      const yAtReach = -(2 * SIZE - GRIDFINITY.TOLERANCE) / 2 + LIP_NOTCH_REACH_MM - 0.05;
      expectNoNotchAt(result, 0, yAtReach);
    },
  }),
  defineScenario('lip-notches #4783', 'a lidded bin keeps a plain lip', {
    assert: 'structural',
    forExport: true,
    params: notched(2, 2, { lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true } }),
    customAssert: (result) => {
      expectNoNotchAt(result, ...frontProbe(2, 0));
    },
  }),
];
