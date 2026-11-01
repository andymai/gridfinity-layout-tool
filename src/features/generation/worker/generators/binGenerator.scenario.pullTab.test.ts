// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import { initBrepjs, getGenerateBin, getKernelName } from './__kernel-tests__/wasmInit';
import {
  assertStructurallyValid,
  assertWatertight,
  boundingBox,
  meshTopologyStats,
  meshVolume,
  verticalSolidSpans,
  columnCrossings,
} from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { DEFAULT_PULL_TAB, planPullTab, pullTabWallFields } from '@/shared/utils/pullTabPlan';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { deriveDimensions } from './pipeline/context';
import { generateLabelPlates } from './labelPlateGenerator';
import { planLabelPlates } from '@/shared/utils/labelSocketPlan';
import { labelPlateWidthMm, effectiveLabelSocketClearance } from '@/shared/constants/labelPlates';
import { assembledHeight } from '@/shared/printSettings/assembledHeight';
import { canBinUseDirectMesh } from './binDirectMesh';
import type { BinParams, PullTabConfig, PullTabWall } from '@/shared/types/bin';
import type { MeshData } from '@/features/generation/bridge/types';
import { runScenarios } from './__kernel-tests__/scenarioRunner';
import { pullTab } from './scenarios/pullTab';

runScenarios(pullTab);

beforeAll(initBrepjs, 30_000);
function params(tab: Partial<PullTabConfig> = {}, more: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    width: 2,
    depth: 3,
    height: 6,
    wallThickness: 1.6,
    base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
    pullTab: { ...DEFAULT_PULL_TAB, enabled: true, ...tab },
    ...more,
  };
}
describe('raised pull tabs', () => {
  it.skipIf(getKernelName() === 'manifold').each([
    {
      widthMode: 'percent' as const,
      widthPercent: 100,
      topRadius: 20,
      rootRadius: 20,
      height: 8,
      recessHeight: 20,
    },
    { width: 12, topRadius: 20, rootRadius: 20, height: 3, recessHeight: 1 },
    { topRadius: 20, rootRadius: 0, height: 8, recessHeight: 18 },
  ])('keeps maximum blends solid on a short or narrow tab: %j', (tab) => {
    const p = params(
      {
        ...tab,
        thickness: 4,
        backRecess: true,
        recessDepth: 3.2,
        recessEdgeRadius: 6,
        recessInsideRadius: 6,
      },
      {
        width: 2.5,
        base: {
          ...DEFAULT_BIN_PARAMS.base,
          stackingLip: false,
          rimFillet: true,
          rimFilletRadius: 0.4,
        },
      }
    );
    const mesh = getGenerateBin()(p, undefined, true);
    assertStructurallyValid(mesh);
    assertWatertight(mesh);
    expect(boundingBox(mesh.vertices).maxZ).toBeCloseTo(42 + tab.height, 2);
    expect(
      verticalSolidSpans(mesh, 0.13, -60.75).some(
        ([lo, hi]) => lo < 40 && hi > 42 + tab.height - 0.5
      )
    ).toBe(true);
  });
  it.each(['width', 'depth'] as const)(
    'makes a broad 2 mm slope in both %s-wall recesses',
    (wall) => {
      const p = params({ wall, backRecess: true, recessHeight: 18 });
      const narrow = getGenerateBin()(p, undefined, true);
      const wide = getGenerateBin()(
        {
          ...p,
          pullTab: {
            ...DEFAULT_PULL_TAB,
            ...p.pullTab,
            recessEdgeRadius: 2,
            recessInsideRadius: 2,
          },
        },
        undefined,
        true
      );
      const material = (m: typeof wide, along: number, inset: number) =>
        verticalSolidSpans(
          m,
          wall === 'width' ? along : 41.75 - inset,
          wall === 'width' ? -62.75 + inset : along
        ).some(([lo, hi]) => lo < 44 && hi > 44);
      for (const inset of [0.5, 2.5]) {
        expect(material(narrow, 18.9, inset)).toBe(false);
        expect(material(wide, 18.9, inset)).toBe(true);
        expect(material(wide, 0.13, inset)).toBe(false);
      }
      expect(material(wide, 0.13, 1.5)).toBe(true);
      expect(meshVolume(wide)).toBeGreaterThan(meshVolume(narrow) + 50);
      expect(boundingBox(wide.vertices)).toEqual(boundingBox(narrow.vertices));
      assertStructurallyValid(wide);
      assertWatertight(wide);
    }
  );
  it.each(['width', 'depth'] as const)(
    'uses larger %s-wall shoulder curves at the same height',
    (wall) => {
      const p = params({ wall, recessDepth: 0 });
      const standard = getGenerateBin()(p, undefined, true);
      const broad = getGenerateBin()(
        { ...p, pullTab: { ...DEFAULT_PULL_TAB, ...p.pullTab, topRadius: 10, rootRadius: 10 } },
        undefined,
        true
      );
      const shoulder = (m: typeof broad) =>
        columnCrossings(m, wall === 'width' ? 20 : 40.25, wall === 'width' ? -61.25 : 20).at(-1) ??
        0;
      expect(shoulder(standard)).toBeGreaterThan(49);
      expect(shoulder(broad)).toBeLessThan(45);
      expect(boundingBox(broad.vertices).maxZ).toBeCloseTo(54, 2);
      assertStructurallyValid(broad);
      assertWatertight(broad);
    }
  );
  it.skipIf(getKernelName() === 'manifold')(
    'changes the rounded tab when its percent width changes',
    () => {
      const p = params(
        { widthMode: 'percent', widthPercent: 50, recessDepth: 0 },
        {
          base: {
            ...DEFAULT_BIN_PARAMS.base,
            stackingLip: false,
            rimFillet: true,
            rimFilletRadius: 0.4,
          },
        }
      );
      const wider = { ...p, pullTab: { ...DEFAULT_PULL_TAB, ...p.pullTab, widthPercent: 80 } };
      const small = getGenerateBin()(p, undefined, true);
      const large = getGenerateBin()(wider, undefined, true);
      expect(deriveDimensions(p, true).shellKey).not.toEqual(
        deriveDimensions(wider, true).shellKey
      );
      expect(columnCrossings(small, 21.1, -61.25).at(-1)).toBeCloseTo(42, 2);
      expect(columnCrossings(large, 21.1, -61.25).at(-1)).toBeGreaterThan(48);
      assertStructurallyValid(large);
      assertWatertight(large);
    }
  );
  it.skipIf(getKernelName() === 'manifold').each([0.4, 2.6])(
    'rounds a full-width tab at the %s mm wall thickness limit',
    (wallThickness) => {
      const p = params(
        { width: 500, thickness: wallThickness, backRecess: true },
        {
          wallThickness,
          base: {
            ...DEFAULT_BIN_PARAMS.base,
            stackingLip: false,
            rimFillet: true,
            rimFilletRadius: 2,
          },
        }
      );
      const mesh = getGenerateBin()(p, undefined, true);
      assertStructurallyValid(mesh);
      assertWatertight(mesh);
      expect(boundingBox(mesh.vertices).maxZ).toBeCloseTo(54, 2);
      const halfTab = 37;
      const a = columnCrossings(mesh, halfTab - 0.05, -62.7).at(-1);
      const b = columnCrossings(mesh, halfTab + 0.05, -62.7).at(-1);
      expect(Math.abs((a ?? 0) - (b ?? 100))).toBeLessThan(0.05);
    }
  );
  it.skipIf(getKernelName() === 'manifold').each([0, 4])(
    'keeps rounded double recesses valid with %s mm outline radii',
    (radius) => {
      const p = params(
        {
          topRadius: radius,
          rootRadius: radius,
          backRecess: true,
          thickness: 1.6,
          recessDepth: 3.2,
          recessHeight: 18,
        },
        {
          width: 2.5,
          base: {
            ...DEFAULT_BIN_PARAMS.base,
            stackingLip: false,
            rimFillet: true,
            rimFilletRadius: 0.4,
          },
        }
      );
      const mesh = getGenerateBin()(p, undefined, true);
      assertStructurallyValid(mesh);
      assertWatertight(mesh);
      expect(verticalSolidSpans(mesh, 0.13, -62.75 + 0.8).some(([a, b]) => a < 40 && b > 45)).toBe(
        true
      );
      const taller = { ...p, pullTab: { ...DEFAULT_PULL_TAB, ...p.pullTab, height: 18 } };
      expect(deriveDimensions(p, true).shellKey).not.toEqual(
        deriveDimensions(taller, true).shellKey
      );
      expect(boundingBox(getGenerateBin()(taller, undefined, true).vertices).maxZ).toBeCloseTo(
        60,
        2
      );
    }
  );
  it.each(['width', 'depth'] as const)(
    'mirrors the %s recess while preserving the middle wall',
    (wall) => {
      const p = params({ wall, backRecess: true, recessHeight: 18 });
      const mesh = getGenerateBin()(p, undefined, true);
      const one = getGenerateBin()(params({ wall, recessHeight: 18 }), undefined, true);
      const spans = (m: typeof mesh, inset: number) =>
        verticalSolidSpans(
          m,
          wall === 'width' ? 0.13 : 41.75 - inset,
          wall === 'width' ? -62.75 + inset : 0.13
        );
      const solid = (m: typeof mesh, inset: number) =>
        spans(m, inset).some(([a, b]) => a < 44 && b > 44);
      expect(solid(one, 0.5)).toBe(true);
      expect(solid(mesh, 0.5)).toBe(false);
      expect(solid(mesh, 2.5)).toBe(false);
      expect(solid(mesh, 1.5)).toBe(true);
      const front = spans(mesh, 2.5).at(-1);
      const back = spans(mesh, 0.5).at(-1);
      expect(back?.[0]).toBeCloseTo(front?.[0] ?? 0, 3);
      expect(back?.[1]).toBeCloseTo(front?.[1] ?? 0, 3);
      expect(meshVolume(mesh)).toBeLessThan(meshVolume(one));
      assertStructurallyValid(mesh);
      assertWatertight(mesh);
    }
  );
  it.skipIf(getKernelName() === 'manifold').each(['width', 'depth'] as const)(
    'continues both rim fillets over the %s tab and its shoulders',
    (wall) => {
      const p = params(
        { wall, recessDepth: 0 },
        {
          base: {
            ...DEFAULT_BIN_PARAMS.base,
            stackingLip: false,
            rimFillet: true,
            rimFilletRadius: 0.4,
          },
        }
      );
      const mesh = getGenerateBin()(p, undefined, true);
      const topAt = (along: number, inset: number) => {
        const x = wall === 'width' ? along : 41.75 - inset;
        const y = wall === 'width' ? -62.75 + inset : along;
        return verticalSolidSpans(mesh, x, y).at(-1)?.[1] ?? 0;
      };
      for (const inset of [0.05, 2.95]) {
        expect(topAt(0.13, inset)).toBeLessThan(53.9);
        expect(topAt(0.13, inset)).toBeGreaterThan(53.5);
        expect(Math.abs(topAt(24.95, inset) - topAt(25.05, inset))).toBeLessThan(0.05);
      }
      expect(topAt(0.13, 1.5)).toBeCloseTo(54, 2);
      assertStructurallyValid(mesh);
      assertWatertight(mesh);
    }
  );
  it.each(['width', 'depth'] as const)(
    'rounds only the %s recess back junction when the inside fillet changes',
    (wall) => {
      const sharp = getGenerateBin()(
        params({ wall, recessHeight: 18, recessInsideRadius: 0 }),
        undefined,
        true
      );
      const rounded = getGenerateBin()(
        params({ wall, recessHeight: 18, recessInsideRadius: 0.4 }),
        undefined,
        true
      );
      // Probe beside a straight recess side, 0.95 mm into its 1 mm depth.
      // The inner fillet must add material here while keeping the pocket center open.
      const probe = (mesh: typeof sharp, along: number, depth: number) => {
        const x = wall === 'width' ? along : 41.75 - 3 + depth;
        const y = wall === 'width' ? -62.75 + 3 - depth : along;
        return verticalSolidSpans(mesh, x, y).some(([bottom, top]) => bottom < 44 && top > 44);
      };
      expect(probe(sharp, 19.3, 0.95)).toBe(false);
      expect(probe(rounded, 19.3, 0.95)).toBe(true);
      for (const mesh of [sharp, rounded]) {
        expect(probe(mesh, 0.13, 0.95)).toBe(false);
        expect(probe(mesh, 0.13, 1.1)).toBe(true);
        assertStructurallyValid(mesh);
        assertWatertight(mesh);
      }
      expect(meshVolume(rounded)).toBeGreaterThan(meshVolume(sharp));
    }
  );
  it.each(['width', 'depth'] as const)(
    'widens the %s-wall recess when its border is reduced',
    (wall) => {
      const wide = getGenerateBin()(
        params({ wall, recessHeight: 18, recessBorder: 1.2 }),
        undefined,
        true
      );
      const narrow = getGenerateBin()(
        params({ wall, recessHeight: 18, recessBorder: 3 }),
        undefined,
        true
      );
      const x = wall === 'width' ? 18.5 : 41.75 - 2.5;
      const y = wall === 'width' ? -62.75 + 2.5 : 18.5;
      const solidAtProbe = (mesh: typeof wide) =>
        verticalSolidSpans(mesh, x, y).some(([bottom, top]) => bottom < 44 && top > 44);
      expect(solidAtProbe(wide)).toBe(false);
      expect(solidAtProbe(narrow)).toBe(true);
      expect(meshVolume(wide)).toBeLessThan(meshVolume(narrow));
      for (const mesh of [wide, narrow]) {
        assertStructurallyValid(mesh);
        assertWatertight(mesh);
      }
    }
  );
  it.each(['width', 'depth'] as const)(
    'joins the %s tab and thickens only its host wall inward',
    (wall) => {
      const p = params({ wall, recessHeight: 18 });
      const mesh = getGenerateBin()(p, undefined, true);
      assertStructurallyValid(mesh);
      assertWatertight(mesh);
      const box = boundingBox(mesh.vertices);
      expect(box.maxZ).toBeCloseTo(54, 2);
      expect(box.minX).toBeCloseTo(-41.75, 2);
      expect(box.maxX).toBeCloseTo(41.75, 2);
      expect(box.minY).toBeCloseTo(-62.75, 2);
      expect(box.maxY).toBeCloseTo(62.75, 2);
      // A ray in the added wall skin reaches the tab top; inside the blind pocket it stops below the rim.
      const x = wall === 'width' ? 0.13 : 41.75 - 2.5;
      const y = wall === 'width' ? -62.75 + 2.5 : 0.13;
      const pocket = verticalSolidSpans(mesh, x, y);
      expect(pocket.length).toBeGreaterThanOrEqual(2);
      const behindX = wall === 'width' ? x : 41.75 - 1;
      const behindY = wall === 'width' ? -62.75 + 1 : y;
      const skin = verticalSolidSpans(mesh, behindX, behindY);
      expect(skin.some(([bottom, top]) => bottom < 10 && top > 53)).toBe(true);
      const dim = deriveDimensions(p, true);
      const ui = cutoutInterior(p);
      expect(ui.innerW).toBeCloseTo(dim.innerW);
      expect(ui.innerD).toBeCloseTo(dim.innerD);
      expect(ui.offsetX).toBeCloseTo(dim.innerOffsetX);
      expect(ui.offsetY).toBeCloseTo(dim.innerOffsetY);
      expect(canBinUseDirectMesh(p)).toBe(false);
      const preview = getGenerateBin()(p);
      assertStructurallyValid(preview);
      expect(boundingBox(preview.vertices).maxZ).toBeCloseTo(box.maxZ, 2);
    }
  );
  it('cuts below the rim and changes depth without breaching the outside', () => {
    const p = params({ recessHeight: 20, recessDepth: 1.5 });
    const dim = deriveDimensions(p, true);
    const plan = planPullTab(p, dim.wallHeight, dim.floorThickness);
    expect(plan).not.toBeNull();
    expect((plan?.recessTop ?? 0) - (plan?.recessHeight ?? 0)).toBeLessThan(dim.wallHeight);
    const solid = getGenerateBin()(params({ recessDepth: 0 }), undefined, true);
    const recessed = getGenerateBin()(p, undefined, true);
    expect(meshVolume(recessed)).toBeLessThan(meshVolume(solid) - 100);
    assertWatertight(recessed);
  });
  it.each(['width', 'depth'] as const)(
    'keeps %s-wall tabs compatible with column dividers and label holders',
    (wall) => {
      const p = params(
        { wall },
        {
          compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 1, cells: [0, 1] },
          label: {
            ...DEFAULT_BIN_PARAMS.label,
            enabled: true,
            mode: 'socket',
            socketStyle: 'slideChannel',
            width: 100,
            depth: 14,
            edges: 'both',
            support: 'solid',
          },
          interiorFilletMm: 2,
        }
      );
      const mesh = getGenerateBin()(p, undefined, true);
      assertStructurallyValid(mesh);
      assertWatertight(mesh);
      expect(boundingBox(mesh.vertices).maxZ).toBeCloseTo(54, 2);
      expect(assembledHeight(p).totalMm).toBeCloseTo(54, 2);
      const preview = generateLabelPlates(p);
      const dim = deriveDimensions(p, true);
      const exported = planLabelPlates({
        params: p,
        innerWmm: dim.innerW,
        innerDmm: dim.innerD,
        wallHeightMm: dim.wallHeight,
        clearanceMm: effectiveLabelSocketClearance(0.4, p.label.plateFitOffset),
      });
      expect(preview?.plates.length).toBe(exported.length);
      expect(exported.length).toBeGreaterThan(0);
      for (const [i, plate] of (preview?.plates ?? []).entries()) {
        expect(plate.widthMm).toBeCloseTo(labelPlateWidthMm(exported[i].widthU), 3);
        const crossings = columnCrossings(mesh, plate.seatX + 0.17, plate.seatY);
        // The existing draft socket also reports its lip underside on this ray.
        // The exact export has only the floor crossing; both must contain the seat plane.
        expect(crossings.some((z) => Math.abs(z - plate.seatZ) < 0.01)).toBe(true);
        if (getKernelName() !== 'manifold') expect(crossings.at(-1)).toBeCloseTo(plate.seatZ, 2);
      }
      if (getKernelName() !== 'manifold') {
        const rounded = getGenerateBin()(
          {
            ...p,
            base: { ...p.base, rimFillet: true, rimFilletRadius: 0.4 },
            pullTab: { ...DEFAULT_PULL_TAB, ...p.pullTab, backRecess: true },
          },
          undefined,
          true
        );
        assertStructurallyValid(rounded);
        assertWatertight(rounded);
      }
    }
  );
  it('supports half units, a rectangular pitch, minimum wall thickness and large radii', () => {
    const p = params(
      { thickness: 0.4, topRadius: 20, rootRadius: 20, width: 500, height: 3, recessDepth: 3.2 },
      { width: 2.5, gridUnitMmY: 35 }
    );
    const mesh = getGenerateBin()(p, undefined, true);
    assertStructurallyValid(mesh);
    assertWatertight(mesh);
    expect(boundingBox(mesh.vertices).maxZ).toBeCloseTo(45, 2);
  });
  it('supports an extra-height wall with a stacking lip', () => {
    const p = params(
      {},
      { extraWallHeightMm: 5, base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true } }
    );
    const mesh = getGenerateBin()(p, undefined, true);
    assertStructurallyValid(mesh);
    assertWatertight(mesh);
    expect(boundingBox(mesh.vertices).maxZ).toBeCloseTo(59, 2);
  });
  it.skipIf(getKernelName() === 'manifold')(
    'keeps a rounded rim and a thick wall joined to the raised tab',
    () => {
      const p = params(
        { thickness: 4 },
        {
          base: {
            ...DEFAULT_BIN_PARAMS.base,
            stackingLip: false,
            rimFillet: true,
            rimFilletRadius: 0.4,
          },
          interiorFilletMm: 2,
        }
      );
      const mesh = getGenerateBin()(p, undefined, true);
      assertStructurallyValid(mesh);
      assertWatertight(mesh);
      const wall = verticalSolidSpans(mesh, 30.13, -62.75 + 3.5);
      expect(wall.some(([bottom, top]) => bottom < 10 && top > 41.5)).toBe(true);
      expect(boundingBox(mesh.vertices).maxZ).toBeCloseTo(54, 2);
    }
  );
  it('keeps zero outline radii valid', () => {
    const mesh = getGenerateBin()(
      params({ topRadius: 0, rootRadius: 0, recessRadius: 0, recessEdgeRadius: 0 }),
      undefined,
      true
    );
    assertStructurallyValid(mesh);
    assertWatertight(mesh);
  });
  it.each<Partial<PullTabConfig>>([
    {
      topRadius: 0,
      rootRadius: 0,
      recessRadius: 0.2,
      recessHeight: 3,
      recessDepth: 3.2,
      thickness: 4,
      recessEdgeRadius: 1.5,
      recessInsideRadius: 3.2,
    },
    { recessHeight: 1, recessDepth: 0.2, recessEdgeRadius: 1.5, recessInsideRadius: 3.2 },
    { recessEdgeRadius: 0, recessInsideRadius: 0.8 },
  ])('keeps constrained inside fillets closed: %j', (tab) => {
    const mesh = getGenerateBin()(params(tab), undefined, true);
    assertStructurallyValid(mesh);
    assertWatertight(mesh);
    expect(meshVolume(mesh)).toBeGreaterThan(0);
  });
});

/**
 * One closed genus-0 solid. Disjoint tabs fuse as one compound, and a tab left
 * as its own shell would still read watertight. The draft kernel meshes the
 * socket on its own, so only the exact kernel's count means anything.
 */
function expectOneSolid(mesh: MeshData): void {
  if (getKernelName() !== 'manifold') expect(meshTopologyStats(mesh).eulerCharacteristic).toBe(2);
}

describe('pull tabs on several walls', () => {
  const WALLS: readonly PullTabWall[] = ['front', 'back', 'left', 'right'];
  const HALF_W = 41.75;
  const HALF_D = 62.75;
  const RIM = 42;
  const TOP = RIM + DEFAULT_PULL_TAB.height;
  const on = (walls: readonly PullTabWall[], more: Partial<BinParams> = {}) =>
    params(pullTabWallFields(walls), more);
  /** A point `inset` mm in from the outside of a wall, `along` mm from its centre. */
  const at = (wall: PullTabWall, inset: number, along = 0.13): readonly [number, number] => {
    if (wall === 'front') return [along, -HALF_D + inset];
    if (wall === 'back') return [along, HALF_D - inset];
    if (wall === 'left') return [-HALF_W + inset, along];
    return [HALF_W - inset, along];
  };
  const top = (mesh: MeshData, wall: PullTabWall, along?: number) =>
    verticalSolidSpans(mesh, ...at(wall, 1, along)).at(-1)?.[1] ?? 0;
  /** The preview carries its socket unfused, so only its highest crossing is meaningful. */
  const previewTop = (mesh: MeshData, wall: PullTabWall) =>
    Math.max(...columnCrossings(mesh, ...at(wall, 1)));
  /** Solid through mid-height 2.5 mm in: inside a 3 mm wall, but cavity behind a 1.6 mm one. */
  const thickened = (mesh: MeshData, wall: PullTabWall) =>
    verticalSolidSpans(mesh, ...at(wall, 2.5, 30)).some(([lo, hi]) => lo < 20 && hi > 30);

  function expectTabsOn(mesh: MeshData, chosen: readonly PullTabWall[]) {
    for (const wall of WALLS) {
      const expected = chosen.includes(wall) ? TOP : RIM;
      expect(top(mesh, wall), `${wall} wall top`).toBeCloseTo(expected, 1);
      expect(thickened(mesh, wall), `${wall} wall thickened`).toBe(chosen.includes(wall));
    }
  }

  it('the probes see the wall but no tab, and no thickening, on a bin without one', () => {
    const mesh = getGenerateBin()(params({ enabled: false }), undefined, true);
    for (const wall of WALLS) {
      expect(verticalSolidSpans(mesh, ...at(wall, 1)).length).toBeGreaterThan(0);
    }
    expectTabsOn(mesh, []);
  });

  it.each<{ chosen: readonly PullTabWall[] }>([
    { chosen: ['front', 'back'] },
    { chosen: ['left', 'right'] },
    { chosen: ['back'] },
    { chosen: ['left'] },
    { chosen: ['front', 'right'] },
    { chosen: ['front', 'back', 'left', 'right'] },
  ])('raises a tab above the rim on $chosen and on no other wall', ({ chosen }) => {
    const p = on(chosen, {
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 2, cells: [0, 1, 2, 3] },
    });
    const mesh = getGenerateBin()(p, undefined, true);
    assertStructurallyValid(mesh);
    assertWatertight(mesh);
    expectOneSolid(mesh);
    expectTabsOn(mesh, chosen);
    const box = boundingBox(mesh.vertices);
    expect([box.minX, box.maxX, box.minY, box.maxY]).toEqual([
      expect.closeTo(-HALF_W, 2),
      expect.closeTo(HALF_W, 2),
      expect.closeTo(-HALF_D, 2),
      expect.closeTo(HALF_D, 2),
    ]);
    const dim = deriveDimensions(p, true);
    const ui = cutoutInterior(p);
    expect([ui.innerW, ui.innerD, ui.offsetX, ui.offsetY]).toEqual([
      expect.closeTo(dim.innerW, 6),
      expect.closeTo(dim.innerD, 6),
      expect.closeTo(dim.innerOffsetX, 6),
      expect.closeTo(dim.innerOffsetY, 6),
    ]);
    expect(canBinUseDirectMesh(p)).toBe(false);
    const preview = getGenerateBin()(p);
    assertStructurallyValid(preview);
    for (const wall of WALLS) {
      expect(previewTop(preview, wall), `${wall} preview top`).toBeCloseTo(top(mesh, wall), 1);
    }
  });

  it.each<{ chosen: readonly PullTabWall[] }>([
    { chosen: ['front', 'right'] },
    { chosen: ['back', 'left'] },
  ])('centres each tab on its own wall when a neighbour is thickened: $chosen', ({ chosen }) => {
    const mesh = getGenerateBin()(on(chosen), undefined, true);
    for (const wall of chosen) {
      expect(Math.abs(top(mesh, wall, 22.5) - top(mesh, wall, -22.5)), wall).toBeLessThan(0.05);
      expect(top(mesh, wall, 22.5)).toBeGreaterThan(RIM + 0.3);
      expect(top(mesh, wall, 22.5)).toBeLessThan(RIM + 2);
    }
  });

  it.skipIf(getKernelName() === 'manifold')(
    'joins four rounded tabs, each with mirrored recesses, into one watertight shell',
    () => {
      const p = on(WALLS, {
        base: {
          ...DEFAULT_BIN_PARAMS.base,
          stackingLip: false,
          rimFillet: true,
          rimFilletRadius: 0.4,
        },
      });
      const rounded = { ...p, pullTab: { ...DEFAULT_PULL_TAB, ...p.pullTab, backRecess: true } };
      const mesh = getGenerateBin()(rounded, undefined, true);
      assertStructurallyValid(mesh);
      assertWatertight(mesh);
      expectOneSolid(mesh);
      expectTabsOn(mesh, WALLS);
      const single = getGenerateBin()(
        params({ backRecess: true }, { base: rounded.base }),
        undefined,
        true
      );
      expect(meshVolume(mesh)).toBeGreaterThan(meshVolume(single) + 500);
    }
  );
});
