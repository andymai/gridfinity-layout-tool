/**
 * Regression guard: non-rectangular (cellMask) bins must be shelled, not
 * silently solid. The original polygon implementation wrapped brepjs
 * `shell()` in a try/catch that fell back to the solid extrusion when
 * shell failed on concave perimeters — which meant every L/T/U bin
 * printed with no interior. This file exists to catch that regression.
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { buildParams } from './__kernel-tests__/scenarioTypes';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { CellMask } from '@/shared/utils/cellMask';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

/** Build a mask from a visually top-first 2D array. */
function buildMask(rows: (0 | 1)[][]): CellMask {
  const bottomFirst = rows.slice().reverse();
  const cols = bottomFirst[0]?.length ?? 0;
  return { cols, rows: bottomFirst.length, cells: bottomFirst.flat() };
}

const L_SHAPE: CellMask = buildMask([
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 0, 0],
  [1, 1, 1, 1, 0, 0],
]);

describe('non-rectangular bins are properly shelled', () => {
  it('L-shape in standard (shelled) mode has significantly more triangles than solid mode', () => {
    const generateBin = getGenerateBin();
    // Compare flat-base / no-lip so the shelling delta dominates the
    // triangle count. With lip/socket geometry shared between modes the
    // ratio gets noisy; stripping those leaves only the interior walls
    // and floor top as the distinguishing faces.
    const shelled = generateBin(
      buildParams({
        width: 3,
        depth: 3,
        cellMask: L_SHAPE,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false, solid: false },
      }),
      undefined,
      false
    );
    const solid = generateBin(
      buildParams({
        width: 3,
        depth: 3,
        cellMask: L_SHAPE,
        base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat', stackingLip: false, solid: true },
      }),
      undefined,
      false
    );

    // If the shell() path had silently failed and fallen back to a solid
    // extrusion, the "shelled" and "solid" meshes would be near-identical.
    // A properly shelled bin has roughly 2x the triangles because the
    // interior walls and floor top add a full extra set of faces.
    expect(
      shelled.triangleCount,
      `shelled L (${shelled.triangleCount}) should be materially larger than solid L (${solid.triangleCount}) — if these are similar, shell() silently failed and fell back to solid`
    ).toBeGreaterThan(solid.triangleCount * 1.5);
  });

  it('vertices exist between the floor and the rim — confirms interior wall surfaces', () => {
    const generateBin = getGenerateBin();
    const result = generateBin(
      buildParams({
        width: 3,
        depth: 3,
        height: 4,
        cellMask: L_SHAPE,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: false },
      }),
      undefined,
      false
    );

    let interiorVertexCount = 0;
    // Inspect Z coordinates (every 3rd float). A solid extrusion has
    // vertices only at Z=0 and Z=wallHeight; a shelled bin also has
    // vertices on the interior wall surfaces throughout the intermediate
    // Z range. We look for vertices at least 2mm above the floor
    // thickness and well below the rim.
    const MIN_Z = 2;
    const MAX_Z = 4 * DEFAULT_BIN_PARAMS.heightUnitMm - 2;
    for (let i = 2; i < result.vertices.length; i += 3) {
      const z = result.vertices[i];
      if (z > MIN_Z && z < MAX_Z) interiorVertexCount++;
    }

    expect(
      interiorVertexCount,
      'expected vertices in the interior Z range (interior wall surfaces)'
    ).toBeGreaterThan(0);
  });
});
