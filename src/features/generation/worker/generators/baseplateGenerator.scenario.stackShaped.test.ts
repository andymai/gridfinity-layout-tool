// @vitest-environment node
/**
 * A stacked tower prints every plate onto the one below it, so each copy must
 * cover the same cells. Turning a plate over mirrors it in plan view, which a
 * rectangle survives and most drawer shapes do not: an L turned over puts
 * whole cells over air.
 *
 * Built the way the export does it: params from `buildFullParams`, the plate
 * from the real generator, the tower from `buildStackExportSoup` with the turn
 * `planPlateFlip` picks for it.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { mm } from '@/core/types';
import type { DrawerOutline, StackPrintParams } from '@/core/types';
import { buildFullParams } from '@/features/baseplate/utils/buildFullParams';
import { bodyParamsForDetach } from '@/features/baseplate/utils/splitPlanner';
import { planPlateFlip, stackStrideMm } from '@/features/baseplate/utils/stackPrint';
import { buildStackExportSoup } from '@/features/baseplate/utils/stackExport';
import { initBrepjs, getGenerateBaseplate } from './__kernel-tests__/wasmInit';
import { boundingBox } from './__kernel-tests__/meshAssertions';
import type { MeshData } from '../../bridge/types';

const NO_OP = (): void => {};
const U = 42;
const WIDTH = 3;
const DEPTH = 2;
const COPIES = 3;
const STACK: StackPrintParams = { enabled: true, gapMm: mm(0.2), copies: COPIES };

beforeAll(async () => {
  await initBrepjs();
}, 30_000);

/** Drawer-local outline covering exactly the listed cells' union (rectilinear). */
function outlineOf(vertices: readonly (readonly [number, number])[]): DrawerOutline {
  return { vertices: vertices.map(([x, y]) => ({ x: x * U, y: y * U })) };
}

/** Front row of three plus the back-left cell: no turn maps it onto itself. */
const L_SHAPE = outlineOf([
  [0, 0],
  [3, 0],
  [3, 1],
  [1, 1],
  [1, 2],
  [0, 2],
]);

/** Back-middle cell missing: symmetric about the Y axis only. */
const U_SHAPE = outlineOf([
  [0, 0],
  [3, 0],
  [3, 2],
  [2, 2],
  [2, 1],
  [1, 1],
  [1, 2],
  [0, 2],
]);

function soupOf(mesh: MeshData): { vertices: Float32Array; normals: Float32Array } {
  const n = mesh.indices.length;
  const vertices = new Float32Array(n * 3);
  const normals = new Float32Array(n * 3);
  for (let k = 0; k < n; k++) {
    const v = mesh.indices[k] * 3;
    for (let c = 0; c < 3; c++) {
      vertices[k * 3 + c] = mesh.vertices[v + c];
      normals[k * 3 + c] = mesh.normals[v + c];
    }
  }
  return { vertices, normals };
}

/**
 * Grid cells (as "col,row") holding material in one tower layer. A triangle
 * counts toward the cell its centroid falls in, ignoring the 1mm band around
 * every grid line where neighbouring cells share a wall.
 */
function cellsWithMaterial(soup: Float32Array, zLo: number, zHi: number): Set<string> {
  const cells = new Set<string>();
  for (let t = 0; t < soup.length; t += 9) {
    const zs = [soup[t + 2], soup[t + 5], soup[t + 8]];
    if (zs.some((z) => z < zLo || z > zHi)) continue;
    const gx = (soup[t] + soup[t + 3] + soup[t + 6]) / 3 / U + WIDTH / 2;
    const gy = (soup[t + 1] + soup[t + 4] + soup[t + 7]) / 3 / U + DEPTH / 2;
    const fx = gx - Math.floor(gx);
    const fy = gy - Math.floor(gy);
    const margin = 1 / U;
    if (fx < margin || fx > 1 - margin || fy < margin || fy > 1 - margin) continue;
    cells.add(`${Math.floor(gx)},${Math.floor(gy)}`);
  }
  return cells;
}

function towerLayerCells(outline: DrawerOutline): Set<string>[] {
  const params = bodyParamsForDetach(
    buildFullParams(
      { ...DEFAULT_BASEPLATE_PARAMS, syncWithLayout: true, stackPrint: STACK },
      WIDTH,
      DEPTH,
      U,
      'end',
      'end',
      0.4,
      outline
    )
  );
  expect(params.outline).toBeDefined();
  const plate = getGenerateBaseplate()(params, NO_OP, true);
  const bb = boundingBox(plate.vertices);
  const plateHeight = bb.maxZ - bb.minZ;
  const stride = stackStrideMm(plateHeight, STACK);
  const source = soupOf(plate);
  const tower = buildStackExportSoup(
    source.vertices,
    source.normals,
    COPIES,
    STACK,
    planPlateFlip(params)
  );
  const eps = 0.05;
  return Array.from({ length: COPIES }, (_, i) =>
    cellsWithMaterial(tower.vertices, i * stride - eps, i * stride + plateHeight + eps)
  );
}

describe('stacked custom-shaped plates', () => {
  it('lands every plate of an L-shaped tower on the cells of the one below', () => {
    const layers = towerLayerCells(L_SHAPE);
    for (let i = 1; i < layers.length; i++) {
      expect([...layers[i]].sort(), `plate ${i + 1}`).toEqual([...layers[i - 1]].sort());
    }
    // Every copy prints turned over, so the tower is the L's mirror image.
    expect([...layers[0]].sort()).toEqual(['0,0', '0,1', '1,1', '2,1']);
  });

  it('lands every plate of a U-shaped tower on the cells of the one below', () => {
    const layers = towerLayerCells(U_SHAPE);
    for (let i = 1; i < layers.length; i++) {
      expect([...layers[i]].sort(), `plate ${i + 1}`).toEqual([...layers[i - 1]].sort());
    }
    // A turn it is symmetric about exists, so the bottom plate stays upright.
    expect([...layers[0]].sort()).toEqual(['0,0', '0,1', '1,0', '2,0', '2,1']);
  });
});
