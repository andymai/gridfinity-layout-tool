/**
 * Scenario test: the exterior-wall collar (`extraWallHeightMm`, issue #2500)
 * raises the outer walls + stacking lip while leaving the interior anchored to
 * the original plane.
 *
 * Runs the full BREP pipeline (real WASM) and asserts, versus the same bin with
 * no collar, that:
 *   - the mesh grows taller by ~collar mm (maxZ delta),
 *   - the XY footprint and the floor (minZ) are unchanged (walls rise; the
 *     socket/floor and outline stay put),
 *   - the geometry stays finite with triangles.
 *
 * Covers the three interesting shell paths: a hollow lipped bin, a solid bin
 * (exercises the `cutoutTopOffset + collar` recess path), and a custom-shape
 * (cellMask) bin (the lip lofts from the footprint polygon).
 */
// @vitest-environment node
import { describe, it, expect, beforeAll } from 'vitest';
import { initBrepjs, getGenerateBin } from './__kernel-tests__/wasmInit';
import { boundingBox, hasNoNaNOrInfinity } from './__kernel-tests__/meshAssertions';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { BinParams } from '@/shared/types/bin';

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

const COLLAR = 10; // mm

function assertCollarRaisesWallsOnly(base: BinParams, label: string): void {
  const generateBin = getGenerateBin();
  const nominal = generateBin(base);
  const collared = generateBin({ ...base, extraWallHeightMm: COLLAR });

  expect(nominal.vertices, `${label} nominal`).not.toBeNull();
  expect(collared.vertices, `${label} collared`).not.toBeNull();
  if (!nominal.vertices || !collared.vertices) return;

  expect(hasNoNaNOrInfinity(collared.vertices), `${label} finite`).toBe(true);
  expect(collared.indices?.length ?? 0, `${label} has triangles`).toBeGreaterThan(0);

  const nb = boundingBox(nominal.vertices);
  const cb = boundingBox(collared.vertices);

  // Walls + lip rise by the collar amount (the whole point).
  expect(cb.maxZ - nb.maxZ, `${label} maxZ delta`).toBeCloseTo(COLLAR, 1);
  // Floor / socket base is untouched — only the top moved.
  expect(cb.minZ, `${label} minZ unchanged`).toBeCloseTo(nb.minZ, 1);
  // Footprint is untouched — the collar grows Z only, never the XY outline.
  expect(cb.maxX - cb.minX, `${label} width unchanged`).toBeCloseTo(nb.maxX - nb.minX, 1);
  expect(cb.maxY - cb.minY, `${label} depth unchanged`).toBeCloseTo(nb.maxY - nb.minY, 1);
}

describe('exterior-wall collar through full pipeline', () => {
  it('raises walls + lip on a hollow lipped bin without moving the interior', () => {
    assertCollarRaisesWallsOnly(
      {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
        height: 3,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, solid: false },
      },
      'hollow'
    );
  }, 60_000);

  it('raises walls on a solid bin (cutoutTopOffset recess path)', () => {
    assertCollarRaisesWallsOnly(
      {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
        height: 3,
        style: 'solid',
        base: { ...DEFAULT_BIN_PARAMS.base, solid: true, stackingLip: true },
      },
      'solid'
    );
  }, 60_000);

  it('raises walls + lip on a custom-shape (cellMask) bin', () => {
    // 2×2 bin (4×4 half-bin mask) with one corner half-cell cleared — an
    // L-ish polygon footprint whose lip lofts from the mask outline.
    const cells = new Array<0 | 1>(16).fill(1);
    cells[0] = 0;
    assertCollarRaisesWallsOnly(
      {
        ...DEFAULT_BIN_PARAMS,
        width: 2,
        depth: 2,
        height: 3,
        base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true, solid: false },
        cellMask: { cols: 4, rows: 4, cells },
      },
      'cellMask'
    );
  }, 60_000);

  it('leaves geometry byte-for-byte identical when the collar is zero', () => {
    const generateBin = getGenerateBin();
    const base: BinParams = { ...DEFAULT_BIN_PARAMS, width: 2, depth: 2, height: 3 };
    // An absent field and an explicit 0 must both resolve to no collar and reuse
    // the same shellKey, so the full mesh — every vertex, normal, and index — is
    // identical, not just its bounding box.
    const a = generateBin(base);
    const b = generateBin({ ...base, extraWallHeightMm: 0 });
    expect(a.vertices).not.toBeNull();
    expect(b.vertices).not.toBeNull();
    if (!a.vertices || !b.vertices) return;
    expect(Array.from(b.vertices)).toEqual(Array.from(a.vertices));
    expect(Array.from(b.indices ?? [])).toEqual(Array.from(a.indices ?? []));
    expect(Array.from(b.normals ?? [])).toEqual(Array.from(a.normals ?? []));
  }, 60_000);
});
