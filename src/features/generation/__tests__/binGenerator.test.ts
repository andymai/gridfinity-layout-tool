import { describe, it, expect } from 'vitest';
import { generateBinGeometry } from '../worker/generators/binGenerator';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import type { BinParams } from '@/features/bin-designer/types';

/** Helper to get bounding box from mesh vertices */
function getBounds(vertices: Float32Array) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < vertices.length; i += 3) {
    minX = Math.min(minX, vertices[i]);
    maxX = Math.max(maxX, vertices[i]);
    minY = Math.min(minY, vertices[i + 1]);
    maxY = Math.max(maxY, vertices[i + 1]);
    minZ = Math.min(minZ, vertices[i + 2]);
    maxZ = Math.max(maxZ, vertices[i + 2]);
  }

  return { minX, maxX, minY, maxY, minZ, maxZ };
}

describe('binGenerator', () => {
  describe('generateBinGeometry', () => {
    it('generates non-empty mesh for default params', () => {
      const mesh = generateBinGeometry(DEFAULT_BIN_PARAMS);
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.normals.length).toBe(mesh.vertices.length);
      expect(mesh.triangleCount).toBeGreaterThan(0);
    });

    it('produces correct outer width for 2-unit bin', () => {
      const mesh = generateBinGeometry(DEFAULT_BIN_PARAMS);
      const bounds = getBounds(mesh.vertices);

      const expectedWidth = 2 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE; // 83.5mm
      const actualWidth = bounds.maxX - bounds.minX;
      expect(actualWidth).toBeCloseTo(expectedWidth, 1);
    });

    it('produces correct outer depth for 2-unit bin', () => {
      const mesh = generateBinGeometry(DEFAULT_BIN_PARAMS);
      const bounds = getBounds(mesh.vertices);

      const expectedDepth = 2 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE; // 83.5mm
      const actualDepth = bounds.maxY - bounds.minY;
      expect(actualDepth).toBeCloseTo(expectedDepth, 1);
    });

    it('produces correct total height (height units + base)', () => {
      const mesh = generateBinGeometry(DEFAULT_BIN_PARAMS);
      const bounds = getBounds(mesh.vertices);

      const expectedHeight = 3 * GRIDFINITY.HEIGHT_UNIT + GRIDFINITY.BASE_HEIGHT; // 26mm
      const actualHeight = bounds.maxZ - bounds.minZ;
      expect(actualHeight).toBeCloseTo(expectedHeight, 1);
    });

    it('is centered on X/Y with Z starting at 0', () => {
      const mesh = generateBinGeometry(DEFAULT_BIN_PARAMS);
      const bounds = getBounds(mesh.vertices);

      // Centered on X
      expect(bounds.minX).toBeCloseTo(-bounds.maxX, 1);
      // Centered on Y
      expect(bounds.minY).toBeCloseTo(-bounds.maxY, 1);
      // Bottom at Z=0
      expect(bounds.minZ).toBeCloseTo(0, 3);
    });

    it('scales width correctly for different unit counts', () => {
      const params: BinParams = { ...DEFAULT_BIN_PARAMS, width: 4 };
      const mesh = generateBinGeometry(params);
      const bounds = getBounds(mesh.vertices);

      const expectedWidth = 4 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE; // 167.5mm
      expect(bounds.maxX - bounds.minX).toBeCloseTo(expectedWidth, 1);
    });

    it('scales height correctly for different unit counts', () => {
      const params: BinParams = { ...DEFAULT_BIN_PARAMS, height: 6 };
      const mesh = generateBinGeometry(params);
      const bounds = getBounds(mesh.vertices);

      const expectedHeight = 6 * GRIDFINITY.HEIGHT_UNIT + GRIDFINITY.BASE_HEIGHT; // 47mm
      expect(bounds.maxZ - bounds.minZ).toBeCloseTo(expectedHeight, 1);
    });

    it('handles half-unit dimensions (0.5)', () => {
      const params: BinParams = { ...DEFAULT_BIN_PARAMS, width: 0.5, depth: 0.5 };
      const mesh = generateBinGeometry(params);
      const bounds = getBounds(mesh.vertices);

      const expectedWidth = 0.5 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE; // 20.5mm
      expect(bounds.maxX - bounds.minX).toBeCloseTo(expectedWidth, 1);
    });

    it('vase mode produces fewer triangles than standard (no dividers possible)', () => {
      const standardParams: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        dividers: { x: 2, y: 2, thickness: 1.2 },
      };
      const vaseParams: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        style: 'vase',
        dividers: { x: 0, y: 0, thickness: 1.2 },
      };

      const standardMesh = generateBinGeometry(standardParams);
      const vaseMesh = generateBinGeometry(vaseParams);

      expect(vaseMesh.triangleCount).toBeLessThan(standardMesh.triangleCount);
    });

    it('dividers increase triangle count', () => {
      const noDividers = generateBinGeometry(DEFAULT_BIN_PARAMS);
      const withDividers = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        dividers: { x: 1, y: 1, thickness: 1.2 },
      });

      expect(withDividers.triangleCount).toBeGreaterThan(noDividers.triangleCount);
    });

    it('more dividers produce more triangles', () => {
      const oneDivider = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        dividers: { x: 1, y: 0, thickness: 1.2 },
      });
      const threeDividers = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        dividers: { x: 3, y: 0, thickness: 1.2 },
      });

      expect(threeDividers.triangleCount).toBeGreaterThan(oneDivider.triangleCount);
    });

    it('dividers do not extend beyond outer bin bounds', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        dividers: { x: 3, y: 3, thickness: 1.2 },
      };
      const mesh = generateBinGeometry(params);
      const bounds = getBounds(mesh.vertices);

      const expectedWidth = 2 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
      const expectedDepth = 2 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
      const expectedHeight = 3 * GRIDFINITY.HEIGHT_UNIT + GRIDFINITY.BASE_HEIGHT;

      expect(bounds.maxX - bounds.minX).toBeCloseTo(expectedWidth, 1);
      expect(bounds.maxY - bounds.minY).toBeCloseTo(expectedDepth, 1);
      expect(bounds.maxZ - bounds.minZ).toBeCloseTo(expectedHeight, 1);
    });

    it('vertex count is divisible by 9 (3 vertices * 3 components per triangle)', () => {
      const mesh = generateBinGeometry(DEFAULT_BIN_PARAMS);
      expect(mesh.vertices.length % 9).toBe(0);
      expect(mesh.vertices.length / 9).toBe(mesh.triangleCount);
    });
  });
});
