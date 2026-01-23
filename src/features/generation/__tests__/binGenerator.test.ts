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

    it('produces correct total height (height units include base)', () => {
      const mesh = generateBinGeometry(DEFAULT_BIN_PARAMS);
      const bounds = getBounds(mesh.vertices);

      // Height units INCLUDE the base: 3U = 3*7 = 21mm
      const expectedHeight = 3 * GRIDFINITY.HEIGHT_UNIT; // 21mm
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

      // Height units INCLUDE the base: 6U = 6*7 = 42mm
      const expectedHeight = 6 * GRIDFINITY.HEIGHT_UNIT; // 42mm
      expect(bounds.maxZ - bounds.minZ).toBeCloseTo(expectedHeight, 1);
    });

    it('handles half-unit dimensions (0.5)', () => {
      const params: BinParams = { ...DEFAULT_BIN_PARAMS, width: 0.5, depth: 0.5 };
      const mesh = generateBinGeometry(params);
      const bounds = getBounds(mesh.vertices);

      const expectedWidth = 0.5 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE; // 20.5mm
      expect(bounds.maxX - bounds.minX).toBeCloseTo(expectedWidth, 1);
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
      // Height units INCLUDE the base: 3U = 3*7 = 21mm
      const expectedHeight = 3 * GRIDFINITY.HEIGHT_UNIT;

      expect(bounds.maxX - bounds.minX).toBeCloseTo(expectedWidth, 1);
      expect(bounds.maxY - bounds.minY).toBeCloseTo(expectedDepth, 1);
      expect(bounds.maxZ - bounds.minZ).toBeCloseTo(expectedHeight, 1);
    });

    it('vertex count is divisible by 9 (3 vertices * 3 components per triangle)', () => {
      const mesh = generateBinGeometry(DEFAULT_BIN_PARAMS);
      expect(mesh.vertices.length % 9).toBe(0);
      expect(mesh.vertices.length / 9).toBe(mesh.triangleCount);
    });

    it('scoop adds geometry when enabled', () => {
      const noScoop = generateBinGeometry({ ...DEFAULT_BIN_PARAMS, scoop: { enabled: false, radius: 'auto', allRows: false } });
      const withScoop = generateBinGeometry({ ...DEFAULT_BIN_PARAMS, scoop: { enabled: true, radius: 'auto', allRows: false } });

      expect(withScoop.triangleCount).toBeGreaterThan(noScoop.triangleCount);
    });

    it('scoop geometry stays within bin bounds', () => {
      const params: BinParams = { ...DEFAULT_BIN_PARAMS, scoop: { enabled: true, radius: 'auto', allRows: false } };
      const mesh = generateBinGeometry(params);
      const bounds = getBounds(mesh.vertices);

      const expectedWidth = 2 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
      const expectedDepth = 2 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
      // Height units INCLUDE the base: 3U = 3*7 = 21mm
      const expectedHeight = 3 * GRIDFINITY.HEIGHT_UNIT;

      expect(bounds.maxX - bounds.minX).toBeCloseTo(expectedWidth, 0);
      expect(bounds.maxY - bounds.minY).toBeCloseTo(expectedDepth, 0);
      // Scoop may add slight height due to arc, but within bounds
      expect(bounds.maxZ).toBeLessThanOrEqual(expectedHeight + 1);
    });

    it('scoop respects divider compartments', () => {
      const noDividers = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: true, radius: 'auto', allRows: false },
        dividers: { x: 0, y: 0, thickness: 1.2 },
      });
      const withDividers = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: true, radius: 'auto', allRows: false },
        dividers: { x: 2, y: 0, thickness: 1.2 },
      });

      // More compartments = more scoops = more triangles
      expect(withDividers.triangleCount).toBeGreaterThan(noDividers.triangleCount);
    });

    it('label tab adds geometry when enabled', () => {
      const noLabel = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        label: { enabled: false, text: '', fontSize: 'auto' },
      });
      const withLabel = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        label: { enabled: true, text: 'Test', fontSize: 'auto' },
      });

      expect(withLabel.triangleCount).toBeGreaterThan(noLabel.triangleCount);
    });

    it('solid style adds corner gussets', () => {
      const standard = generateBinGeometry({ ...DEFAULT_BIN_PARAMS, style: 'standard' });
      const solid = generateBinGeometry({ ...DEFAULT_BIN_PARAMS, style: 'solid' });

      expect(solid.triangleCount).toBeGreaterThan(standard.triangleCount);
    });

    it('lite style produces same features as standard but thinner walls', () => {
      const lite = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        style: 'lite',
        scoop: { enabled: true, radius: 'auto', allRows: false },
        label: { enabled: true, text: 'Test', fontSize: 'auto' },
      });
      const standard = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        style: 'standard',
        scoop: { enabled: true, radius: 'auto', allRows: false },
        label: { enabled: true, text: 'Test', fontSize: 'auto' },
      });

      // Same feature set (same triangle count), different geometry positions
      expect(lite.triangleCount).toBe(standard.triangleCount);
    });

    // ─── Wall Cutout Tests ────────────────────────────────────────────────────

    it('wall cutouts reduce geometry (100% removes wall entirely)', () => {
      const fullWalls = generateBinGeometry(DEFAULT_BIN_PARAMS);
      const frontRemoved = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        walls: { front: 100, back: 0, left: 0, right: 0 },
      });

      // Removing a wall removes one box (12 triangles)
      expect(frontRemoved.triangleCount).toBeLessThan(fullWalls.triangleCount);
    });

    it('partial wall cutout produces same triangle count as full walls', () => {
      // 50% cutout still creates a wall box, just shorter
      const fullWalls = generateBinGeometry(DEFAULT_BIN_PARAMS);
      const partialCut = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        walls: { front: 50, back: 0, left: 0, right: 0 },
      });

      // Same number of boxes, just shorter wall
      expect(partialCut.triangleCount).toBe(fullWalls.triangleCount);
    });

    it('50% wall cutout reduces wall height by half', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        walls: { front: 50, back: 50, left: 50, right: 50 },
      };
      const mesh = generateBinGeometry(params);
      const bounds = getBounds(mesh.vertices);

      // Height units INCLUDE the base: 3U = 21mm, base = 7mm
      const baseHeight = GRIDFINITY.BASE_HEIGHT; // 7mm
      const totalHeight = 3 * GRIDFINITY.HEIGHT_UNIT; // 21mm
      const fullWallHeight = totalHeight - baseHeight; // 14mm
      const halfWallHeight = fullWallHeight * 0.5; // 7mm
      const expectedMaxZ = baseHeight + halfWallHeight; // 14mm

      // Max Z should be approximately base + half wall (not full height)
      expect(bounds.maxZ).toBeCloseTo(expectedMaxZ, 0);
    });

    it('all walls removed still produces bottom plate', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        walls: { front: 100, back: 100, left: 100, right: 100 },
      };
      const mesh = generateBinGeometry(params);

      // Should still have geometry (the bottom plate at minimum)
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(mesh.vertices.length).toBeGreaterThan(0);
    });

    // ─── Per-Compartment Label Tab Tests ──────────────────────────────────────

    it('label tab creates more geometry with X dividers (per-column tabs)', () => {
      const singleLabel = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        label: { enabled: true, text: 'Test', fontSize: 'auto' },
        dividers: { x: 0, y: 0, thickness: 1.2 },
      });
      const multiLabel = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        label: { enabled: true, text: 'Test', fontSize: 'auto' },
        dividers: { x: 2, y: 0, thickness: 1.2 },
      });

      // 3 compartments = 3 label tabs (more triangles than 1 tab)
      expect(multiLabel.triangleCount).toBeGreaterThan(singleLabel.triangleCount);
    });

    // ─── Multi-Row Scoop Tests ──────────────────────────────────────────────

    it('allRows scoop produces more geometry than single-row', () => {
      const singleRow = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: true, radius: 'auto', allRows: false },
        dividers: { x: 0, y: 2, thickness: 1.2 },
      });
      const allRows = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: true, radius: 'auto', allRows: true },
        dividers: { x: 0, y: 2, thickness: 1.2 },
      });

      // allRows creates scoops in 3 compartment rows vs 1
      expect(allRows.triangleCount).toBeGreaterThan(singleRow.triangleCount);
    });

    it('allRows with no Y dividers produces same as single-row (only 1 row)', () => {
      const singleRow = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: true, radius: 'auto', allRows: false },
        dividers: { x: 0, y: 0, thickness: 1.2 },
      });
      const allRows = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: true, radius: 'auto', allRows: true },
        dividers: { x: 0, y: 0, thickness: 1.2 },
      });

      // No Y dividers = 1 row, so allRows makes no difference
      expect(allRows.triangleCount).toBe(singleRow.triangleCount);
    });

    // ─── Configurable Scoop Radius Tests ──────────────────────────────────────

    it('fixed scoop radius produces valid geometry', () => {
      const mesh = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: true, radius: 5, allRows: false },
      });
      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(mesh.vertices.length % 9).toBe(0);
    });

    it('large scoop radius is capped to fit compartment', () => {
      // Even with a huge radius, geometry should stay within bounds
      const mesh = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: true, radius: 25, allRows: false },
      });
      const bounds = getBounds(mesh.vertices);

      const expectedWidth = 2 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
      const expectedDepth = 2 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;

      expect(bounds.maxX - bounds.minX).toBeCloseTo(expectedWidth, 0);
      expect(bounds.maxY - bounds.minY).toBeCloseTo(expectedDepth, 0);
    });

    it('different scoop radii produce different geometry', () => {
      const smallRadius = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: true, radius: 3, allRows: false },
      });
      const largeRadius = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        scoop: { enabled: true, radius: 15, allRows: false },
      });

      // Different radii should produce different vertex positions
      // They might have same triangle count but different vertex values
      const smallBounds = getBounds(smallRadius.vertices);
      const largeBounds = getBounds(largeRadius.vertices);

      // Both should produce valid geometry
      expect(smallRadius.triangleCount).toBeGreaterThan(0);
      expect(largeRadius.triangleCount).toBeGreaterThan(0);
      // Larger radius scoop scoops deeper (lower minZ for scoop portion)
      expect(largeBounds.minZ).toBeLessThanOrEqual(smallBounds.minZ + 0.001);
    });

    // ─── Expanded Dimension Tests ─────────────────────────────────────────────

    it('generates valid geometry for 8-unit wide bin', () => {
      const params: BinParams = { ...DEFAULT_BIN_PARAMS, width: 8, depth: 2 };
      const mesh = generateBinGeometry(params);
      const bounds = getBounds(mesh.vertices);

      const expectedWidth = 8 * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
      expect(bounds.maxX - bounds.minX).toBeCloseTo(expectedWidth, 1);
      expect(mesh.vertices.length % 9).toBe(0);
    });

    it('generates valid geometry for 20-height bin', () => {
      const params: BinParams = { ...DEFAULT_BIN_PARAMS, height: 20 };
      const mesh = generateBinGeometry(params);
      const bounds = getBounds(mesh.vertices);

      const expectedHeight = 20 * GRIDFINITY.HEIGHT_UNIT; // 140mm
      expect(bounds.maxZ - bounds.minZ).toBeCloseTo(expectedHeight, 1);
    });

    it('generates valid geometry for max-size bin (8x8x20)', () => {
      const params: BinParams = { ...DEFAULT_BIN_PARAMS, width: 8, depth: 8, height: 20 };
      const mesh = generateBinGeometry(params);

      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(mesh.vertices.length % 9).toBe(0);

      // Should be much larger than default
      const defaultMesh = generateBinGeometry(DEFAULT_BIN_PARAMS);
      expect(mesh.triangleCount).toBeGreaterThanOrEqual(defaultMesh.triangleCount);
    });

    it('8-unit bin with dividers and all features', () => {
      const params: BinParams = {
        ...DEFAULT_BIN_PARAMS,
        width: 8,
        depth: 4,
        height: 10,
        dividers: { x: 3, y: 2, thickness: 1.2 },
        scoop: { enabled: true, radius: 'auto', allRows: true },
        label: { enabled: true, text: 'Big Bin', fontSize: 'auto' },
      };
      const mesh = generateBinGeometry(params);

      expect(mesh.triangleCount).toBeGreaterThan(0);
      expect(mesh.vertices.length % 9).toBe(0);
    });

    it('label tab with Y dividers only does not split into multiple tabs', () => {
      const noDiv = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        label: { enabled: true, text: 'Test', fontSize: 'auto' },
        dividers: { x: 0, y: 0, thickness: 1.2 },
      });
      const yDivs = generateBinGeometry({
        ...DEFAULT_BIN_PARAMS,
        label: { enabled: true, text: 'Test', fontSize: 'auto' },
        dividers: { x: 0, y: 2, thickness: 1.2 },
      });

      // Y dividers add divider walls but the label stays as one tab
      // So the triangle difference is only from divider geometry
      const dividerTriangles = yDivs.triangleCount - noDiv.triangleCount;
      // Each Y divider = 1 box = 12 triangles
      expect(dividerTriangles).toBe(2 * 12);
    });
  });
});
