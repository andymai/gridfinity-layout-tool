import { describe, it, expect } from 'vitest';
import {
  createBox,
  createHollowBox,
  createCylinder,
  createDividerWall,
  createScoop,
  createLabelTab,
  createCornerGusset,
  mergeMeshes,
} from '../worker/generators/geometry';
import type { MeshData } from '../bridge/types';

describe('geometry utilities', () => {
  describe('createBox', () => {
    it('produces 12 triangles (36 vertices)', () => {
      const mesh = createBox(0, 0, 0, 10, 10, 10);
      expect(mesh.triangleCount).toBe(12);
      expect(mesh.vertices.length).toBe(108); // 12 * 9
      expect(mesh.normals.length).toBe(108);
    });

    it('vertices are within the specified bounds', () => {
      const mesh = createBox(5, 10, 15, 20, 30, 40);
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        const x = mesh.vertices[i];
        const y = mesh.vertices[i + 1];
        const z = mesh.vertices[i + 2];
        expect(x).toBeGreaterThanOrEqual(5);
        expect(x).toBeLessThanOrEqual(25);
        expect(y).toBeGreaterThanOrEqual(10);
        expect(y).toBeLessThanOrEqual(40);
        expect(z).toBeGreaterThanOrEqual(15);
        expect(z).toBeLessThanOrEqual(55);
      }
    });

    it('normals are unit vectors', () => {
      const mesh = createBox(0, 0, 0, 1, 1, 1);
      for (let i = 0; i < mesh.normals.length; i += 3) {
        const nx = mesh.normals[i];
        const ny = mesh.normals[i + 1];
        const nz = mesh.normals[i + 2];
        const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
        expect(length).toBeCloseTo(1, 5);
      }
    });

    it('handles zero dimensions gracefully', () => {
      const mesh = createBox(0, 0, 0, 0, 10, 10);
      expect(mesh.triangleCount).toBe(12);
      // Degenerate triangles but no crash
    });
  });

  describe('createHollowBox', () => {
    it('produces more triangles than a solid box (walls + bottom)', () => {
      const mesh = createHollowBox(42, 42, 28, 1.2, 5.7);
      // 5 sub-boxes * 12 triangles each = 60
      expect(mesh.triangleCount).toBe(60);
    });

    it('falls back to solid box when walls are too thick', () => {
      // Wall thickness > half of width = no inner cavity
      const mesh = createHollowBox(4, 4, 10, 3, 2);
      // Should be a solid box (12 triangles)
      expect(mesh.triangleCount).toBe(12);
    });

    it('vertices are bounded by outer dimensions', () => {
      const w = 84;
      const d = 84;
      const h = 26;
      const mesh = createHollowBox(w, d, h, 1.2, 5.7);
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        expect(mesh.vertices[i]).toBeGreaterThanOrEqual(-w / 2 - 0.001);
        expect(mesh.vertices[i]).toBeLessThanOrEqual(w / 2 + 0.001);
        expect(mesh.vertices[i + 1]).toBeGreaterThanOrEqual(-d / 2 - 0.001);
        expect(mesh.vertices[i + 1]).toBeLessThanOrEqual(d / 2 + 0.001);
        expect(mesh.vertices[i + 2]).toBeGreaterThanOrEqual(-0.001);
        expect(mesh.vertices[i + 2]).toBeLessThanOrEqual(h + 0.001);
      }
    });
  });

  describe('createCylinder', () => {
    it('produces correct triangle count for given segments', () => {
      const segments = 16;
      const mesh = createCylinder(0, 0, 0, 3, 5, segments);
      // 4 triangles per segment (2 sides + top cap + bottom cap)
      expect(mesh.triangleCount).toBe(segments * 4);
      expect(mesh.vertices.length).toBe(segments * 4 * 9);
    });

    it('vertices are within cylinder bounds', () => {
      const cx = 10;
      const cy = 20;
      const z = 0;
      const radius = 3.25;
      const height = 2.4;
      const mesh = createCylinder(cx, cy, z, radius, height, 16);

      for (let i = 0; i < mesh.vertices.length; i += 3) {
        const x = mesh.vertices[i];
        const y = mesh.vertices[i + 1];
        const vz = mesh.vertices[i + 2];

        const distFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        expect(distFromCenter).toBeLessThanOrEqual(radius + 0.001);
        expect(vz).toBeGreaterThanOrEqual(z - 0.001);
        expect(vz).toBeLessThanOrEqual(z + height + 0.001);
      }
    });

    it('side normals point outward from center', () => {
      const mesh = createCylinder(0, 0, 0, 5, 10, 8);
      // First 2 triangles per segment are side faces
      // Their normals should have nz = 0 and point radially outward
      for (let seg = 0; seg < 8; seg++) {
        const baseIdx = seg * 4 * 9; // 4 tris * 9 floats
        // First side triangle - check first vertex normal
        const nx = mesh.normals[baseIdx];
        const ny = mesh.normals[baseIdx + 1];
        const nz = mesh.normals[baseIdx + 2];
        expect(nz).toBeCloseTo(0, 5);
        const nLen = Math.sqrt(nx * nx + ny * ny);
        expect(nLen).toBeCloseTo(1, 3);
      }
    });
  });

  describe('createDividerWall', () => {
    it('is equivalent to createBox', () => {
      const divider = createDividerWall(0, 0, 5, 1.2, 40, 20);
      const box = createBox(0, 0, 5, 1.2, 40, 20);
      expect(divider.triangleCount).toBe(box.triangleCount);
      expect(divider.vertices).toEqual(box.vertices);
    });
  });

  describe('mergeMeshes', () => {
    it('returns empty mesh for empty input', () => {
      const result = mergeMeshes([]);
      expect(result.triangleCount).toBe(0);
      expect(result.vertices.length).toBe(0);
    });

    it('returns the single mesh unchanged for single input', () => {
      const mesh = createBox(0, 0, 0, 5, 5, 5);
      const result = mergeMeshes([mesh]);
      expect(result).toBe(mesh); // Same reference
    });

    it('combines triangle counts', () => {
      const a = createBox(0, 0, 0, 1, 1, 1);
      const b = createBox(5, 0, 0, 1, 1, 1);
      const result = mergeMeshes([a, b]);
      expect(result.triangleCount).toBe(24);
      expect(result.vertices.length).toBe(216);
    });

    it('preserves vertex data from all meshes', () => {
      const meshes: MeshData[] = [
        createBox(0, 0, 0, 1, 1, 1),
        createBox(10, 10, 10, 2, 2, 2),
      ];
      const result = mergeMeshes(meshes);

      // First mesh vertices should be unchanged
      for (let i = 0; i < meshes[0].vertices.length; i++) {
        expect(result.vertices[i]).toBe(meshes[0].vertices[i]);
      }
      // Second mesh vertices should follow
      const offset = meshes[0].vertices.length;
      for (let i = 0; i < meshes[1].vertices.length; i++) {
        expect(result.vertices[offset + i]).toBe(meshes[1].vertices[i]);
      }
    });
  });

  describe('createScoop', () => {
    it('produces non-empty mesh', () => {
      const mesh = createScoop(0, -30, 5, 40, 15);
      expect(mesh.vertices.length).toBeGreaterThan(0);
      expect(mesh.normals.length).toBe(mesh.vertices.length);
      expect(mesh.triangleCount).toBeGreaterThan(0);
    });

    it('spans the correct width', () => {
      const width = 40;
      const mesh = createScoop(0, -30, 5, width, 15);

      let minX = Infinity, maxX = -Infinity;
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        minX = Math.min(minX, mesh.vertices[i]);
        maxX = Math.max(maxX, mesh.vertices[i]);
      }
      expect(maxX - minX).toBeCloseTo(width, 1);
    });

    it('starts at the given Z coordinate', () => {
      const floorZ = 5.7;
      const mesh = createScoop(0, -30, floorZ, 40, 15);

      let minZ = Infinity;
      for (let i = 2; i < mesh.vertices.length; i += 3) {
        minZ = Math.min(minZ, mesh.vertices[i]);
      }
      expect(minZ).toBeCloseTo(floorZ, 3);
    });

    it('scoop height equals radius', () => {
      const radius = 15;
      const floorZ = 5;
      const mesh = createScoop(0, -30, floorZ, 40, radius);

      let minZ = Infinity, maxZ = -Infinity;
      for (let i = 2; i < mesh.vertices.length; i += 3) {
        minZ = Math.min(minZ, mesh.vertices[i]);
        maxZ = Math.max(maxZ, mesh.vertices[i]);
      }
      expect(maxZ - minZ).toBeCloseTo(radius, 1);
    });

    it('more segments produce more triangles', () => {
      const mesh4 = createScoop(0, 0, 5, 40, 15, 4);
      const mesh16 = createScoop(0, 0, 5, 40, 15, 16);
      expect(mesh16.triangleCount).toBeGreaterThan(mesh4.triangleCount);
    });

    it('vertex count matches triangle count * 9', () => {
      const mesh = createScoop(0, 0, 5, 40, 15);
      expect(mesh.vertices.length).toBe(mesh.triangleCount * 9);
    });
  });

  describe('createLabelTab', () => {
    it('produces 4 triangles for valid dimensions', () => {
      const mesh = createLabelTab(84, 1.2, 42, 26);
      expect(mesh.triangleCount).toBe(4);
      expect(mesh.vertices.length).toBe(36); // 4 * 9
    });

    it('returns empty mesh when tab width is zero or negative', () => {
      const mesh = createLabelTab(4, 3, 2, 26);
      expect(mesh.vertices.length).toBe(0);
      expect(mesh.triangleCount).toBe(0);
    });

    it('tab top edge is at total height', () => {
      const totalHeight = 26;
      const mesh = createLabelTab(84, 1.2, 42, totalHeight);

      let maxZ = -Infinity;
      for (let i = 2; i < mesh.vertices.length; i += 3) {
        maxZ = Math.max(maxZ, mesh.vertices[i]);
      }
      expect(maxZ).toBeCloseTo(totalHeight, 1);
    });

    it('tab height span matches tabHeight parameter', () => {
      const totalHeight = 26;
      const tabHeight = 10;
      const mesh = createLabelTab(84, 1.2, 42, totalHeight, tabHeight);

      let minZ = Infinity, maxZ = -Infinity;
      for (let i = 2; i < mesh.vertices.length; i += 3) {
        minZ = Math.min(minZ, mesh.vertices[i]);
        maxZ = Math.max(maxZ, mesh.vertices[i]);
      }
      expect(maxZ - minZ).toBeCloseTo(tabHeight, 1);
    });

    it('normals have non-zero Y and Z components (angled surface)', () => {
      const mesh = createLabelTab(84, 1.2, 42, 26);
      // Front face normals should have negative Y and positive Z (angled 45°)
      const ny = mesh.normals[1];
      const nz = mesh.normals[2];
      expect(ny).toBeLessThan(0);
      expect(nz).toBeGreaterThan(0);
    });
  });

  describe('createCornerGusset', () => {
    it('produces 8 triangles', () => {
      const mesh = createCornerGusset(0, 0, 5, 3, 20, 1, 1);
      expect(mesh.triangleCount).toBe(8);
      expect(mesh.vertices.length).toBe(72); // 8 * 9
    });

    it('gusset Z range matches z + height', () => {
      const z = 5.7;
      const height = 20;
      const mesh = createCornerGusset(0, 0, z, 3, height, 1, 1);

      let minZ = Infinity, maxZ = -Infinity;
      for (let i = 2; i < mesh.vertices.length; i += 3) {
        minZ = Math.min(minZ, mesh.vertices[i]);
        maxZ = Math.max(maxZ, mesh.vertices[i]);
      }
      expect(minZ).toBeCloseTo(z, 3);
      expect(maxZ).toBeCloseTo(z + height, 3);
    });

    it('positive signs extend in +X +Y from corner', () => {
      const mesh = createCornerGusset(10, 10, 0, 5, 10, 1, 1);

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        minX = Math.min(minX, mesh.vertices[i]);
        maxX = Math.max(maxX, mesh.vertices[i]);
        minY = Math.min(minY, mesh.vertices[i + 1]);
        maxY = Math.max(maxY, mesh.vertices[i + 1]);
      }
      expect(minX).toBeCloseTo(10, 3);
      expect(maxX).toBeCloseTo(15, 3);
      expect(minY).toBeCloseTo(10, 3);
      expect(maxY).toBeCloseTo(15, 3);
    });

    it('negative signs extend in -X -Y from corner', () => {
      const mesh = createCornerGusset(10, 10, 0, 5, 10, -1, -1);

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < mesh.vertices.length; i += 3) {
        minX = Math.min(minX, mesh.vertices[i]);
        maxX = Math.max(maxX, mesh.vertices[i]);
        minY = Math.min(minY, mesh.vertices[i + 1]);
        maxY = Math.max(maxY, mesh.vertices[i + 1]);
      }
      expect(minX).toBeCloseTo(5, 3);
      expect(maxX).toBeCloseTo(10, 3);
      expect(minY).toBeCloseTo(5, 3);
      expect(maxY).toBeCloseTo(10, 3);
    });

    it('vertex count is consistent', () => {
      const mesh = createCornerGusset(0, 0, 0, 3, 20, 1, 1);
      expect(mesh.vertices.length).toBe(mesh.triangleCount * 9);
      expect(mesh.normals.length).toBe(mesh.vertices.length);
    });
  });
});
