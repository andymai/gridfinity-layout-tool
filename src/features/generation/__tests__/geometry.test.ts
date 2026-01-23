import { describe, it, expect } from 'vitest';
import {
  createBox,
  createHollowBox,
  createCylinder,
  createDividerWall,
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
});
