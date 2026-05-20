/**
 * Solid-mode × cutout permutation coverage.
 *
 * Targets the underexplored matrix of:
 *   - cutoutTopOffset × cutDepth × stacking lip
 *   - multiple grouped cutouts at varying rotations
 *   - solid mode × label tabs (entirely missing before)
 *   - solid + handles + cutout interactions
 */
import { expect } from 'vitest';
import { DEFAULT_BIN_PARAMS, DEFAULT_HANDLE_SIDE } from '@/shared/constants/bin';
import {
  assertBoundingBoxMatchesParams,
  assertNoDegenerateTriangles,
} from '../__kernel-tests__/meshAssertions';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const ENABLED_SIDE = { ...DEFAULT_HANDLE_SIDE, enabled: true } as const;
const SOLID_BASE = { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false };
const CAT = 'solid+cutout matrix';

export const solidCutoutMatrix: ScenarioCase[] = [
  // ─── Solid mode silently ignores label tabs and handles ─────────────────
  // featuresStage short-circuits in solid mode and applies only cutout cuts
  // (see pipeline/stages/featuresStage.ts: `if (dim.solid) ... return ctx`).
  // These scenarios lock in that contract: setting `label.enabled` or
  // enabling handle sides on a solid bin must NOT alter the mesh.
  defineScenario(CAT, 'solid + label tab bracket params ignored (no geometry change)', {
    assert: 'structural',
    params: {
      height: 4,
      base: SOLID_BASE,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' },
    },
    timeout: 60_000,
    customAssert: (result) => {
      assertNoDegenerateTriangles(result, 'solid+label-bracket');
    },
    compareWith: {
      params: { height: 4, base: SOLID_BASE },
      assert: (withLabel, withoutLabel) => {
        expect(
          withLabel.triangleCount,
          'solid+label should match plain solid — features stage short-circuits'
        ).toBe(withoutLabel.triangleCount);
      },
    },
  }),

  defineScenario(CAT, 'solid + label tab solid params ignored', {
    assert: 'structural',
    params: {
      height: 4,
      base: SOLID_BASE,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'solid' },
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, 'solid + label tab + thick walls — label still ignored', {
    assert: 'structural',
    params: {
      height: 4,
      wallThickness: 2.0,
      base: SOLID_BASE,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'solid', depth: 3 },
    },
  }),

  defineScenario(CAT, 'solid + label (ignored) + cutout (applied)', {
    assert: 'structural',
    params: {
      height: 5,
      base: SOLID_BASE,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'bracket' },
      cutouts: [makeCutout({ id: 'c1', shape: 'circle', cutDepth: 4 })],
    },
    timeout: 60_000,
  }),

  // ─── Solid + handle params (also ignored) + cutouts ──────────────────────
  // Same short-circuit applies to handles — only the cutout takes effect.
  defineScenario(CAT, 'solid + handle params ignored + cutout (only cutout cuts)', {
    assert: 'structural',
    params: {
      height: 5,
      base: SOLID_BASE,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        left: ENABLED_SIDE,
        right: ENABLED_SIDE,
      },
      cutouts: [makeCutout({ id: 'c1', cutDepth: 3 })],
    },
    timeout: 60_000,
  }),

  // ─── topOffset × cutDepth matrix ─────────────────────────────────────────
  // At height=5 and heightUnitMm=7, solidSurfaceZ ≈ wallHeight - topOffset
  // ≈ 30 - topOffset. A cut reaches the floor when cutDepth >= solidSurfaceZ.
  ...[
    { offset: 0, depth: 3, label: 'flush + shallow' },
    { offset: 0, depth: 10, label: 'flush + medium' },
    { offset: 5, depth: 3, label: 'mid-offset + shallow' },
    { offset: 5, depth: 15, label: 'mid-offset + deep' },
    { offset: 20, depth: 2, label: 'high-offset + shallow' },
    { offset: 20, depth: 30, label: 'high-offset + deep (past floor)' },
  ].map(({ offset, depth, label }) =>
    defineScenario(CAT, `solid topOffset=${offset} cutDepth=${depth} (${label})`, {
      assert: 'structural',
      params: {
        height: 5,
        base: SOLID_BASE,
        cutoutConfig: { topOffset: offset },
        cutouts: [makeCutout({ id: 'c1', width: 20, depth: 20, cutDepth: depth })],
      },
      timeout: 60_000,
    })
  ),

  // ─── Multiple grouped cutouts at rotations ───────────────────────────────
  defineScenario(CAT, 'solid + 4 grouped cutouts at 0/30/60/90°', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 3,
      height: 5,
      base: SOLID_BASE,
      cutouts: [
        makeCutout({ id: 'a', x: -20, y: -20, rotation: 0, groupId: 'g1' }),
        makeCutout({ id: 'b', x: 20, y: -20, rotation: 30, groupId: 'g1' }),
        makeCutout({ id: 'c', x: -20, y: 20, rotation: 60, groupId: 'g1' }),
        makeCutout({ id: 'd', x: 20, y: 20, rotation: 90, groupId: 'g1' }),
      ],
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, 'solid + grouped cutouts varying depth in same group', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 2,
      height: 6,
      base: SOLID_BASE,
      cutouts: [
        makeCutout({ id: 's1', x: -20, cutDepth: 2, groupId: 'g1' }),
        makeCutout({ id: 's2', x: 0, cutDepth: 5, groupId: 'g1' }),
        makeCutout({ id: 's3', x: 20, cutDepth: 8, groupId: 'g1' }),
      ],
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, 'solid + grouped cutouts with scoop at 45°', {
    assert: 'structural',
    params: {
      height: 5,
      base: SOLID_BASE,
      cutouts: [
        makeCutout({
          id: 'sc1',
          x: -10,
          y: -10,
          width: 15,
          depth: 15,
          rotation: 45,
          scoopRadius: 2,
          groupId: 'g1',
        }),
        makeCutout({
          id: 'sc2',
          x: 10,
          y: 10,
          width: 15,
          depth: 15,
          rotation: 45,
          scoopRadius: 2,
          groupId: 'g1',
        }),
      ],
    },
    timeout: 60_000,
  }),

  // ─── topOffset + stacking lip (solid + lip on, edge case) ───────────────
  defineScenario(CAT, 'solid + lip + cutout topOffset 5mm', {
    assert: 'structural',
    params: {
      height: 5,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: true },
      cutoutConfig: { topOffset: 5 },
      cutouts: [makeCutout({ id: 'c1', cutDepth: 8 })],
    },
    timeout: 60_000,
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, 'solid+lip+topOffset');
    },
  }),

  defineScenario(CAT, 'solid + lip + multiple cutouts (manifold under fuse)', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 3,
      height: 5,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: true },
      cutouts: [
        makeCutout({ id: 'l', x: -25, cutDepth: 4 }),
        makeCutout({ id: 'r', x: 25, cutDepth: 4 }),
        makeCutout({ id: 'c', x: 0, y: 0, cutDepth: 4 }),
      ],
    },
    timeout: 60_000,
    customAssert: (result) => {
      assertNoDegenerateTriangles(result, 'solid+lip+multiCut');
    },
  }),

  // ─── Path cutouts in solid mode ──────────────────────────────────────────
  defineScenario(CAT, 'solid + path cutout (triangle) + topOffset', {
    assert: 'structural',
    params: {
      height: 5,
      base: SOLID_BASE,
      cutoutConfig: { topOffset: 5 },
      cutouts: [
        makeCutout({
          id: 'tri',
          shape: 'path',
          x: 10,
          y: 10,
          width: 20,
          depth: 20,
          cutDepth: 6,
          path: [
            { x: 10, y: 10, handleIn: null, handleOut: null, symmetric: false },
            { x: 30, y: 10, handleIn: null, handleOut: null, symmetric: false },
            { x: 20, y: 30, handleIn: null, handleOut: null, symmetric: false },
          ],
        }),
      ],
    },
    timeout: 60_000,
  }),

  // ─── Stress: solid + 6 features ─────────────────────────────────────────
  defineScenario(CAT, '4×4 solid + lip + label + handles + cutout + topOffset (mega)', {
    assert: 'structural',
    params: {
      width: 4,
      depth: 4,
      height: 6,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: true },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        front: ENABLED_SIDE,
      },
      cutoutConfig: { topOffset: 3 },
      cutouts: [makeCutout({ id: 'mega', shape: 'circle', width: 30, depth: 30, cutDepth: 8 })],
    },
    timeout: 180_000,
    customAssert: (result) => {
      expect(result.triangleCount).toBeGreaterThan(100);
      assertNoDegenerateTriangles(result, 'solid-mega');
    },
  }),

  // ─── Fractional + solid + cutouts ───────────────────────────────────────
  defineScenario(CAT, '1.5×1.5 solid + cutout + label', {
    assert: 'structural',
    params: {
      width: 1.5,
      depth: 1.5,
      height: 4,
      base: SOLID_BASE,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      cutouts: [makeCutout({ id: 'frac', width: 15, depth: 15, cutDepth: 3 })],
    },
    timeout: 60_000,
  }),

  defineScenario(CAT, '0.5×0.5 solid + cutout (smallest + cut)', {
    assert: 'structural',
    params: {
      width: 0.5,
      depth: 0.5,
      height: 3,
      base: SOLID_BASE,
      cutouts: [makeCutout({ id: 'tiny', width: 8, depth: 8, cutDepth: 2 })],
    },
  }),
];
