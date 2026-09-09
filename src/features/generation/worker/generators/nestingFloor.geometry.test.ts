// @vitest-environment node
import { beforeAll, describe, expect, it } from 'vitest';
import {
  DEFAULT_TRAY_BOTTOM,
  DEFAULT_FLOOR_PATTERN_CONFIG,
  retentionMagnetInset,
  retentionBossRadius,
} from '@/shared/types/bin';
import { initBrepjs, getGenerateBin, type GenerateBinFn } from './__kernel-tests__/wasmInit';
import { buildParams, makeInsert } from './__kernel-tests__/scenarioTypes';
import {
  assertWatertight,
  assertNoDegenerateTriangles,
  boundingBox,
  verticalSolidSpans,
  columnCrossings,
} from './__kernel-tests__/meshAssertions';
import { deriveDimensions, createInitialContext } from './pipeline/context';
import { resolveTrayBottomInputs } from './trayBottomInputs';
import { retentionSeatPlanes } from './retentionMagnetGeometry';
import { buildFullMask } from '@/shared/utils/cellMask';
import { binDimensions, baseFloorZ } from '@/features/bin-designer/utils/binDimensions';
import { parseSTLBinary } from '@/shared/generation/stlParser';
import { retentionMagnetPositions } from '@/shared/utils/retentionMagnetPlacement';
import { scoopRampsFeature } from './scoopRampBuilder';
import { insertCutsFeature } from './insertBuilder';
import { isOk } from '@/core/result';
import { FeatureTag } from './featureTags';

let generateBin: GenerateBinFn;
beforeAll(async () => {
  await initBrepjs();
  generateBin = getGenerateBin();
}, 30_000);

function paramsFor(depth = 2) {
  const p = buildParams({ width: 6, depth: 5, height: 12 });
  return {
    ...p,
    lid: {
      ...p.lid,
      enabled: true,
      attachment: 'magnetic' as const,
      retentionMagnet: { diameter: 6, depth, edgeMagnets: 0 },
    },
    base: {
      ...p.base,
      style: 'lid' as const,
      trayBottom: {
        ...DEFAULT_TRAY_BOTTOM,
        floorAtBed: true,
        attachment: 'magnetic' as const,
      },
    },
  };
}

describe('nesting body', () => {
  it('paints its magnet bosses as body, not as lid', () => {
    const mesh = generateBin(paramsFor(2), undefined, false);
    const tags = new Set((mesh.faceGroups ?? []).map((g) => g.tag));
    expect(tags.size).toBeGreaterThan(0);
    expect(tags.has(FeatureTag.LID_BODY)).toBe(false);
  });

  it.each(['rectangle', 'full mask', 'partial mask'])(
    'keeps UI floor coordinates aligned with the worker for %s and independent lid settings',
    (outline) => {
      const p = { ...paramsFor(2), width: 2, depth: 2 };
      const full = buildFullMask(2, 2);
      const cellMask =
        outline === 'rectangle'
          ? undefined
          : outline === 'full mask'
            ? full
            : { ...full, cells: full.cells.map((cell, i) => (i === 0 ? (0 as const) : cell)) };
      for (const topThicknessMm of [1, 5]) {
        const params = {
          ...p,
          cellMask,
          lid: {
            ...p.lid,
            topThicknessMm,
            extraHeightMm: 8,
            tray: { ...p.lid.tray, enabled: true, depthMm: 5 },
          },
          base: {
            ...p.base,
            trayBottom: {
              ...p.base.trayBottom,
              retentionMagnet: { diameter: 6, depth: 6, edgeMagnets: 0 },
            },
          },
        };
        expect(binDimensions(params).floorZ).toBeCloseTo(
          deriveDimensions(params, true).baseOffsetZ,
          6
        );
      }
    }
  );

  it.each([2, 6])(
    'joins all four magnet corners to the walls with straight tangents (%s mm pockets)',
    (depth) => {
      const p = { ...paramsFor(depth), width: 2, depth: 2 };
      const mesh = generateBin(p, undefined, true);
      assertWatertight(mesh, 'tangent corner supports');
      const r = retentionBossRadius(6);
      const c = 42 - retentionMagnetInset(6);
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) {
          const x = sx * c;
          const y = sy * c;
          // These points lie outside the old cylinder but inside the straight
          // flanks that now run from its tangent points to each wall.
          for (const [px, py] of [
            [x - sx * (r - 0.1), y + sy],
            [x + sx, y - sy * (r - 0.1)],
          ]) {
            expect(verticalSolidSpans(mesh, px, py)[0][1]).toBeGreaterThan(
              deriveDimensions(p, true).floorThickness + 0.5
            );
          }
          // Keep the rounded inward corner and the original pocket depth.
          expect(
            verticalSolidSpans(mesh, x - sx * (r - 0.1), y - sy * (r - 0.1))[0][1]
          ).toBeCloseTo(2, 4);
          expect(verticalSolidSpans(mesh, x + 0.1, y + 0.1)[0][0]).toBeCloseTo(depth, 4);
        }
    }
  );

  it.each([false, true])(
    'has a flat underside around magnet pockets without boss seams (export=%s)',
    (forExport) => {
      const p = { ...paramsFor(), width: 2, depth: 2 };
      const mesh = generateBin(p, undefined, forExport);
      const center = 42 - retentionMagnetInset(6);
      const bossRadius = retentionBossRadius(6);
      // The pocket is the only circle on the bed face. A coplanar boss seam
      // should not be exported as another circular edge around it.
      let seamVertices = 0;
      for (let i = 0; i < mesh.edgeVertices.length; i += 3) {
        const radius = Math.hypot(mesh.edgeVertices[i] - center, mesh.edgeVertices[i + 1] - center);
        if (Math.abs(mesh.edgeVertices[i + 2]) < 0.001 && Math.abs(radius - bossRadius) < 0.01)
          seamVertices++;
      }
      expect(seamVertices).toBe(0);
      for (const radius of [3.2, bossRadius - 0.2, bossRadius + 0.2]) {
        const spans = verticalSolidSpans(mesh, center - radius, center + 0.1);
        expect(spans[0][0]).toBeCloseTo(0, 4);
      }
    }
  );

  it('guards the lowered floor when imported parameters bypass the UI', () => {
    const p = paramsFor();
    const ctx = createInitialContext({
      ...p,
      style: 'slotted',
      inserts: [makeInsert({})],
      scoop: { ...p.scoop, enabled: true },
    });
    expect(ctx.dimensions.isSlotted).toBe(false);
    expect(scoopRampsFeature.shouldBuild(ctx)).toBe(false);
    expect(insertCutsFeature.shouldBuild(ctx)).toBe(false);
  });

  it('drains through the bed floor while keeping corner and edge magnet pockets closed above', () => {
    const p = paramsFor();
    const patterned = {
      ...p,
      width: 3,
      depth: 2,
      lid: { ...p.lid, retentionMagnet: { ...p.lid.retentionMagnet, edgeMagnets: 2 } },
      floorPattern: {
        ...DEFAULT_FLOOR_PATTERN_CONFIG,
        enabled: true,
        scale: 1,
        pattern: 'round' as const,
      },
    };
    const mesh = generateBin(patterned, undefined, true);
    assertWatertight(mesh, 'nesting drainage');
    assertNoDegenerateTriangles(mesh, 'nesting drainage');
    let openings = 0;
    for (let x = -40.3; x < 40; x += 5.1) {
      for (let y = -20.7; y < 20; y += 5.1) {
        if (verticalSolidSpans(mesh, x, y).length === 0) openings++;
      }
    }
    expect(openings).toBeGreaterThan(20);
    const positions = retentionMagnetPositions(
      3,
      2,
      42,
      42,
      retentionMagnetInset(6),
      2,
      retentionBossRadius(6)
    );
    expect(positions.length).toBeGreaterThan(4);
    for (const { x, y } of positions) {
      const spans = verticalSolidSpans(mesh, x + 0.1, y + 0.1);
      expect(spans[0][0]).toBeCloseTo(2, 3);
      expect(spans[0][1]).toBeGreaterThan(2.5);
    }
    // The preview path must cut the same floor as fused export geometry.
    const preview = generateBin(patterned, undefined, false);
    expect(columnCrossings(preview, positions[0].x + 0.1, positions[0].y + 0.1)[0]).toBeCloseTo(
      2,
      3
    );
  });

  it.each([
    [0.8, 2],
    [1.2, 2],
    [2.6, 2.6],
  ])(
    'uses the ordinary floor minimum with %s mm walls (%s mm floor)',
    (wallThickness, expectedFloor) => {
      const p = { ...paramsFor(), width: 2, depth: 2, wallThickness };
      const mesh = generateBin(p, undefined, true);
      const [floor] = verticalSolidSpans(mesh, 0.3, 0.7);
      expect(floor[0]).toBeCloseTo(0, 4);
      expect(floor[1]).toBeCloseTo(expectedFloor, 4);
    }
  );
  it('exports the bed-supported solid as STL and STEP', async () => {
    const { exportBin } = await import('./binExporter');
    const p = paramsFor();
    const stl = await exportBin(p, 'stl');
    const parsed = parseSTLBinary(stl.data);
    expect(isOk(parsed)).toBe(true);
    if (!isOk(parsed)) throw new Error('STL did not parse');
    expect(boundingBox(parsed.value.vertices).minZ).toBeCloseTo(0, 4);
    const step = await exportBin(p, 'step');
    expect(new TextDecoder().decode(step.data)).toContain('ISO-10303-21');
  });
  it.each([2, 6])('prints its floor on the bed with %s mm deep corner magnets', (depth) => {
    const p = paramsFor(depth);
    const mesh = generateBin(p, undefined, true);
    assertWatertight(mesh, 'nesting body');
    assertNoDegenerateTriangles(mesh, 'nesting body');
    expect(boundingBox(mesh.vertices).minZ).toBeCloseTo(0, 4);
    const dim = deriveDimensions(p, true);
    expect(baseFloorZ(p.base, p.heightUnitMm, p.lid)).toBeCloseTo(dim.baseOffsetZ, 6);
    // An interior-grid sweep catches an accidentally retained lattice, holes,
    // or a raised floor even when the bounding box alone looks correct.
    for (const x of [-80.3, -40.3, 0.3, 40.3, 80.3]) {
      for (const y of [-60.7, -20.7, 20.7, 60.7]) {
        const spans = verticalSolidSpans(mesh, x, y);
        expect(spans).toHaveLength(1);
        expect(spans[0][0]).toBeCloseTo(0, 4);
        expect(spans[0][1]).toBeCloseTo(dim.floorThickness, 4);
      }
    }
    const inset = retentionMagnetInset(6);
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        const spans = verticalSolidSpans(mesh, sx * (126 - inset) + 0.1, sy * (105 - inset) + 0.1);
        expect(spans[0][0]).toBeCloseTo(depth, 3);
      }
    // Both parts use the same joint; verify the stack's bottom magnets land
    // one seat gap above the receiving bin's top magnets.
    const input = resolveTrayBottomInputs(p);
    const lift = dim.lipTopZ - input.anchorZ - dim.baseOffsetZ;
    const { binFaceZ } = retentionSeatPlanes(p, dim.lipTopZ);
    expect(lift - binFaceZ).toBeCloseTo(0.2, 5);
    for (let x = -124.3; x < 125; x += 3.1) {
      for (const y of [-102.7, -98.1, -94.9, 0.7, 94.9, 98.1, 102.7]) {
        const spans = verticalSolidSpans(mesh, x, y);
        for (const [a, b] of spans)
          for (const [c, d] of spans) {
            expect(Math.min(b, d + lift) - Math.max(a, c + lift)).toBeLessThanOrEqual(0.01);
          }
      }
    }
  });

  it('supports a divider down to the bed', () => {
    const p = paramsFor();
    const divided = { ...p, compartments: { ...p.compartments, cols: 2, rows: 1, cells: [0, 1] } };
    const mesh = generateBin(divided, undefined, true);
    assertWatertight(mesh, 'nesting divider');
    const spans = verticalSolidSpans(mesh, 0.1, 15.7);
    expect(spans[0][0]).toBeCloseTo(0, 4);
    expect(spans[0][1]).toBeGreaterThan(70);
  });

  it('supports merged compartments without keeping a raised central floor', () => {
    const p = paramsFor();
    const mesh = generateBin(
      {
        ...p,
        compartments: {
          ...p.compartments,
          cols: 2,
          rows: 2,
          cells: [0, 0, 0, 1],
        },
      },
      undefined,
      true
    );
    assertWatertight(mesh, 'merged nesting compartments');
    const floor = verticalSolidSpans(mesh, -30.1, -20.7);
    expect(floor[0][0]).toBeCloseTo(0, 4);
    expect(floor[0][1]).toBeCloseTo(deriveDimensions(p, true).floorThickness, 4);
  });

  it('prints a continuous floor with magnets off, including small and fractional bins', () => {
    for (const [width, depth] of [
      [1, 1],
      [1.5, 2],
      [6, 5],
    ]) {
      const p = paramsFor();
      const plain = {
        ...p,
        width,
        depth,
        lid: { ...p.lid, enabled: false },
        base: {
          ...p.base,
          trayBottom: { ...p.base.trayBottom, attachment: 'friction' as const },
        },
      };
      const mesh = generateBin(plain, undefined, true);
      assertWatertight(mesh, 'plain nesting floor');
      const floor = verticalSolidSpans(mesh, 0.3, 0.7);
      expect(floor[0][0]).toBeCloseTo(0, 4);
      expect(floor[0][1]).toBeCloseTo(deriveDimensions(plain, true).floorThickness, 4);
    }
  });
});
