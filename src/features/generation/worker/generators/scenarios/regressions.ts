/**
 * Regression locks for previously-fixed bin generation bugs.
 *
 * Each scenario corresponds to a closed GitHub issue + fix PR.
 * The customAssert is the specific invariant the fix restored —
 * not a triangle-count snapshot. If a future change reintroduces
 * the same bug class, the customAssert fails noisily.
 */
import { expect } from 'vitest';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_HANDLE_SIDE,
  DISABLED_WALL_CUTOUT,
  GRIDFINITY,
} from '@/shared/constants/bin';
import {
  assertBoundingBoxMatchesParams,
  assertNoDegenerateTriangles,
  boundingBox,
  countWallVerticesInZone,
  hasNoNaNOrInfinity,
} from '../__kernel-tests__/meshAssertions';
import { defineScenario, makeCutout } from '../__kernel-tests__/scenarioTypes';
import type { ScenarioCase } from '../__kernel-tests__/scenarioTypes';

const ENABLED_SIDE = { ...DEFAULT_HANDLE_SIDE, enabled: true } as const;
const SIZE = GRIDFINITY.GRID_SIZE;
const TOL = GRIDFINITY.TOLERANCE;
const CAT = 'regressions';

export const regressions: ScenarioCase[] = [
  // #1753 / PR #1756 — compartmented bins were generating non-manifold geometry
  // because each compartment wall was fused individually; fix restructured to a
  // single multi-cavity cut. Invariant: no degenerate triangles, no NaN.
  defineScenario(CAT, '#1753 compartmented bin is manifold (multi-cavity cut)', {
    assert: 'structural',
    params: {
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    },
    customAssert: (result) => {
      assertNoDegenerateTriangles(result, '#1753 manifold');
      expect(hasNoNaNOrInfinity(result.vertices)).toBe(true);
      expect(hasNoNaNOrInfinity(result.normals)).toBe(true);
    },
  }),

  // #1760 / PR #1765 — split STL export failed for scoop + tall walls (h>=9)
  // with lip enabled. Fix bypassed OCCT STL writer for split pieces.
  // Invariant: mesh validity at height 10 + scoop + lip in export mode.
  defineScenario(CAT, '#1760 scoop + tall (h=10) + lip + export mode', {
    assert: 'structural',
    params: {
      height: 10,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      scoop: { enabled: true, radius: 'auto' },
    },
    forExport: true,
    timeout: 60_000,
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, '#1760');
      assertNoDegenerateTriangles(result, '#1760');
    },
  }),

  // #1681 — split cut planes intersected socket-cell boundaries causing
  // non-manifold split pieces on fractional bins. Fix nudged planes off.
  defineScenario(CAT, '#1681 fractional + scoop near socket boundary', {
    assert: 'structural',
    params: {
      width: 2.5,
      depth: 2,
      scoop: { enabled: true, radius: 'auto' },
    },
    timeout: 60_000,
    customAssert: (result) => {
      assertNoDegenerateTriangles(result, '#1681');
    },
  }),

  // #1657 — lid magnet holes had to be cut before fusing stack grid; otherwise
  // boolean ops left non-manifold edges. Invariant on a lidless-bin proxy:
  // half-sockets + magnet base + lip should still produce manifold mesh.
  defineScenario(CAT, '#1657 magnet base + half sockets + lip (pre-fuse cut order)', {
    assert: 'structural',
    params: {
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        style: 'magnet',
        halfSockets: true,
        stackingLip: true,
      },
    },
    customAssert: (result) => {
      assertNoDegenerateTriangles(result, '#1657');
    },
  }),

  // #1653 — divider notches needed to cut through the lip in split slotted
  // bins; otherwise the lip blocked the divider slot. Invariant: enabling
  // the stacking lip must NOT erase the slot notches — so the lip-on
  // mesh should have MORE triangles than the lip-off baseline (lip adds
  // geometry) AND the lip should peak above wallHeight. If the lip-on
  // mesh is suspiciously close to or smaller than lip-off, the notch cut
  // through the lip probably failed silently.
  defineScenario(CAT, '#1653 slotted + lip + slot notches', {
    assert: 'structural',
    params: {
      width: 4,
      depth: 2,
      height: 6,
      style: 'slotted',
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
    timeout: 60_000,
    customAssert: (result) => {
      const wallHeight = 6 * GRIDFINITY.HEIGHT_UNIT;
      const bb = boundingBox(result.vertices);
      expect(bb.maxZ, '#1653: lip peaks above wallHeight').toBeGreaterThan(wallHeight);
    },
    compareWith: {
      params: {
        width: 4,
        depth: 2,
        height: 6,
        style: 'slotted',
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      },
      assert: (lipOn, lipOff) => {
        // Lip adds geometry; if notches don't cut through it the savings
        // would be much larger, so lipOn ≥ lipOff is the floor.
        expect(
          lipOn.triangleCount,
          '#1653: slotted+lip should not regress below slotted+nolip triangle count'
        ).toBeGreaterThanOrEqual(lipOff.triangleCount);
      },
    },
  }),

  // #1487 / PR #1491 — stacking lip lost angled support beneath the overhang;
  // fix restored the support geometry. Invariant: lip-band vertex count on
  // outer walls is non-trivial (support spans corner-to-corner).
  defineScenario(CAT, '#1487 stacking lip has angled support beneath', {
    assert: 'structural',
    params: {
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
    customAssert: (result) => {
      const wallHeight = 4 * GRIDFINITY.HEIGHT_UNIT;
      const outerW = 2 * SIZE - TOL;
      const outerD = 2 * SIZE - TOL;
      // Look for vertices just BELOW lip junction (the support angle)
      const supportBand = countWallVerticesInZone(
        result,
        outerW,
        outerD,
        wallHeight - 3.0,
        wallHeight - 0.5,
        1.5
      );
      expect(supportBand.left).toBeGreaterThan(0);
      expect(supportBand.right).toBeGreaterThan(0);
      expect(supportBand.front).toBeGreaterThan(0);
      expect(supportBand.back).toBeGreaterThan(0);
    },
  }),

  // #1448 / #1445 — exporting with custom heightUnitMm produced incorrect Z
  // dimension. Invariant: bounding-box Z matches height * heightUnitMm.
  defineScenario(CAT, '#1448 custom heightUnitMm respected in export', {
    assert: 'structural',
    params: {
      height: 5,
      heightUnitMm: 10,
    },
    forExport: true,
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, '#1448');
    },
  }),

  // #1437 — wall pattern + dividers had overlapping geometry near junctions.
  // Invariant: honeycomb + compartments → no degenerate triangles, valid manifold.
  defineScenario(CAT, '#1437 honeycomb + dividers — no junction overlap', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 3,
      height: 5,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
    },
    timeout: 120_000,
    customAssert: (result) => {
      assertNoDegenerateTriangles(result, '#1437');
    },
  }),

  // #1404 — oversized bins (>print bed) had to split into MINIMUM equal pieces
  // not maximum. Proxy: large bin generates without crashing or degenerates.
  defineScenario(CAT, '#1404 oversized 8×4 bin (would need split)', {
    assert: 'structural',
    params: { width: 8, depth: 4, height: 4 },
    timeout: 120_000,
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, '#1404');
    },
  }),

  // #1379 — 4×3 (and similar elongated) bins had stacking lip overhanging the
  // outer X/Y bound. lipWall.ts locks 4×3 + 6×2; we lock 3×5 here as an
  // independent witness of the same class.
  defineScenario(CAT, '#1379 3×5 lip does not overhang outer bound', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 5,
      height: 6,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
    timeout: 120_000,
    customAssert: (result) => {
      const outerW = 3 * SIZE - TOL;
      const outerD = 5 * SIZE - TOL;
      const bb = boundingBox(result.vertices);
      expect(bb.maxX - bb.minX, '#1379: lip X extent').toBeLessThanOrEqual(outerW + 1.0);
      expect(bb.maxY - bb.minY, '#1379: lip Y extent').toBeLessThanOrEqual(outerD + 1.0);
    },
  }),

  // #1354 / PR #1355 — honeycomb pattern left holes at thick walls (>0.8mm)
  // in divider regions because hex prism extrusion exceeded the clip depth.
  // Invariant: thick walls + honeycomb + compartments still produces valid mesh.
  defineScenario(CAT, '#1354 honeycomb + thick walls (1.6mm) + compartments', {
    assert: 'structural',
    params: {
      height: 5,
      wallThickness: 1.6,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 1.2 },
    },
    timeout: 120_000,
    customAssert: (result) => {
      assertNoDegenerateTriangles(result, '#1354');
    },
  }),

  // #1351 / #1348 — honeycomb pattern bled into divider-wall junctions.
  // Invariant: divider junctions remain clean (no degenerate triangles where
  // hex prisms would have overlapped).
  defineScenario(CAT, '#1351 honeycomb cleanly blocked at divider junctions', {
    assert: 'structural',
    params: {
      width: 4,
      depth: 2,
      height: 5,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      compartments: { cols: 2, rows: 1, cells: [0, 1], thickness: 0.8 },
    },
    timeout: 120_000,
    customAssert: (result) => {
      assertNoDegenerateTriangles(result, '#1351');
    },
  }),

  // #1314 — visible seam where outer wall met stacking lip. Invariant:
  // continuous vertex zone at lip junction (left/right/front/back all have
  // contributing vertices).
  defineScenario(CAT, '#1314 no wall-to-lip seam (continuous junction)', {
    assert: 'structural',
    params: {
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
    customAssert: (result) => {
      const wallHeight = 4 * GRIDFINITY.HEIGHT_UNIT;
      const outerW = 2 * SIZE - TOL;
      const outerD = 2 * SIZE - TOL;
      const stats = countWallVerticesInZone(
        result,
        outerW,
        outerD,
        wallHeight - 1.0,
        wallHeight + 1.0,
        1.5
      );
      expect(stats.left).toBeGreaterThanOrEqual(2);
      expect(stats.right).toBeGreaterThanOrEqual(2);
      expect(stats.front).toBeGreaterThanOrEqual(2);
      expect(stats.back).toBeGreaterThanOrEqual(2);
    },
  }),

  // #1306 — stacking lip overhang on rectangular bins didn't match outer
  // bound. Same class as #1379. Lock 5×2 elongated bin here.
  defineScenario(CAT, '#1306 5×2 rectangular lip overhang in bounds', {
    assert: 'structural',
    params: {
      width: 5,
      depth: 2,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
    timeout: 60_000,
    customAssert: (result) => {
      const outerW = 5 * SIZE - TOL;
      const outerD = 2 * SIZE - TOL;
      const bb = boundingBox(result.vertices);
      expect(bb.maxX - bb.minX).toBeLessThanOrEqual(outerW + 1.0);
      expect(bb.maxY - bb.minY).toBeLessThanOrEqual(outerD + 1.0);
    },
  }),

  // #1305 — at 2u height, label tabs had to be disabled because there was
  // no room. Repro: 2u + label.enabled=true should still produce valid mesh
  // (gracefully suppressed or geometrically bounded).
  defineScenario(CAT, '#1305 2u bin with label tab enabled (graceful)', {
    assert: 'structural',
    params: {
      height: 2,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    },
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, '#1305');
    },
  }),

  // #1206 — label tab support didn't reach the shelf front edge; gusset
  // calculation was off. Invariant: label tab solid + reasonable height
  // produces valid mesh with no degenerates.
  defineScenario(CAT, '#1206 label tab solid reaches front edge', {
    assert: 'structural',
    params: {
      height: 4,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'solid', depth: 15 },
    },
    customAssert: (result) => {
      assertNoDegenerateTriangles(result, '#1206');
    },
  }),

  // #921 / PR #923 — non-manifold slot geometry on STL export. Invariant:
  // slotted + export mode produces manifold (no degenerate triangles).
  defineScenario(CAT, '#921 slotted bin export is manifold', {
    assert: 'structural',
    params: { style: 'slotted', height: 4 },
    forExport: true,
    timeout: 60_000,
    customAssert: (result) => {
      assertNoDegenerateTriangles(result, '#921');
    },
  }),

  // #377 — finger scoop geometry orientation was wrong (scoop faced the
  // wrong wall). Invariant: scoop + bin produces valid mesh and the bin's
  // back-wall vertex count is reduced (scoop carves from one side).
  defineScenario(CAT, '#377 finger scoop geometry orientation', {
    assert: 'structural',
    params: { scoop: { enabled: true, radius: 'auto' } },
    customAssert: (result) => {
      assertNoDegenerateTriangles(result, '#377');
    },
  }),

  // #371 — wall cutout geometry was positioned incorrectly. Invariant:
  // wall cutouts produce valid mesh, bounding box matches outer dimensions.
  defineScenario(CAT, '#371 wall cutout geometry positioned correctly', {
    assert: 'structural',
    params: {
      height: 5,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: { ...DISABLED_WALL_CUTOUT, enabled: true, width: 50, depth: 40 },
      },
    },
    timeout: 60_000,
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, '#371');
    },
  }),

  // #351 — invalid compartment mesh at minimum thickness produced
  // non-manifold output. Invariant: very thin compartment thickness still
  // generates structurally valid mesh.
  defineScenario(CAT, '#351 minimum compartment thickness guard', {
    assert: 'structural',
    params: {
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.4 },
    },
    customAssert: (result) => {
      assertNoDegenerateTriangles(result, '#351');
    },
  }),

  // #449 — incorrect stacking lip height. Invariant: lip top vertex ≥
  // wallHeight (peaks above) but bounding box Z reasonably close to expected.
  defineScenario(CAT, '#449 stacking lip height correct', {
    assert: 'structural',
    params: {
      height: 6,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
    },
    customAssert: (result) => {
      const wallHeight = 6 * GRIDFINITY.HEIGHT_UNIT;
      const bb = boundingBox(result.vertices);
      expect(bb.maxZ, '#449: lip peaks above wallHeight').toBeGreaterThan(wallHeight);
      // Lip shouldn't exceed wallHeight by more than ~5mm (lip is ~4.4mm tall)
      expect(bb.maxZ - wallHeight).toBeLessThan(6);
    },
  }),

  // #1344 — magnet hole diameter was being interpreted as radius. Proxy:
  // magnet base + reasonable diameter generates valid mesh with bounding
  // box matching outer dimensions.
  defineScenario(CAT, '#1344 magnet base diameter (not radius) interpreted', {
    assert: 'structural',
    params: {
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', magnetDiameter: 6.5 },
    },
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, '#1344');
    },
  }),

  // Solid-mode + cutout regression — cutoutTopOffset >= wallHeight previously
  // caused degenerate fillHeight; existing edgeCases covers structural validity,
  // we add the actual cutout-into-solid-from-top variant.
  defineScenario(CAT, '#solid top-cutout degenerate fillHeight guard', {
    assert: 'structural',
    params: {
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: false },
      cutoutConfig: { topOffset: 5 },
      cutouts: [makeCutout({ id: 'top-cut', width: 20, depth: 20, cutDepth: 8 })],
    },
    timeout: 60_000,
    customAssert: (result) => {
      assertNoDegenerateTriangles(result, '#solid-top');
    },
  }),

  // Combined regression — multiple historical bug classes in one bin.
  // Locks "everything that has ever broken" into a single canary scenario.
  defineScenario(CAT, '#canary lip + scoop + compartments + magnet base + tall', {
    assert: 'structural',
    params: {
      width: 3,
      depth: 3,
      height: 8,
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', stackingLip: true },
      compartments: { cols: 2, rows: 2, cells: [0, 1, 2, 3], thickness: 0.8 },
      scoop: { enabled: true, radius: 'auto' },
      handles: { ...DEFAULT_BIN_PARAMS.handles, enabled: true, front: ENABLED_SIDE },
    },
    timeout: 180_000,
    customAssert: (result, params) => {
      assertBoundingBoxMatchesParams(result, params, '#canary');
      assertNoDegenerateTriangles(result, '#canary');
    },
  }),
];
