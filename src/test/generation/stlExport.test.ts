import { describe, it, expect } from 'vitest';
import { geometryToSTL } from '../../generation/stlExport';
import * as THREE from 'three';

describe('geometryToSTL', () => {
  function createSimpleGeometry(): THREE.BufferGeometry {
    // Create a simple triangle for testing
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0, 0, 0, 1, 0, 0, 0.5, 1, 0, // Single triangle
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    return geometry;
  }

  function createBoxGeometry(): THREE.BufferGeometry {
    // BoxGeometry creates indexed geometry by default
    const box = new THREE.BoxGeometry(10, 10, 10);
    // Convert to non-indexed for STL
    return box.toNonIndexed();
  }

  describe('binary format', () => {
    it('returns DataView for binary STL', () => {
      const geometry = createSimpleGeometry();
      const result = geometryToSTL(geometry, { binary: true });

      expect(result).toBeInstanceOf(DataView);
      geometry.dispose();
    });

    it('has correct binary STL header size (84 bytes)', () => {
      const geometry = createSimpleGeometry();
      const result = geometryToSTL(geometry, { binary: true }) as DataView;

      // Binary STL: 80-byte header + 4-byte triangle count + triangles
      // Minimum size is 84 bytes (header + count)
      expect(result.byteLength).toBeGreaterThanOrEqual(84);
      geometry.dispose();
    });

    it('stores triangle count at correct offset', () => {
      const geometry = createSimpleGeometry();
      const result = geometryToSTL(geometry, { binary: true }) as DataView;

      // Triangle count is stored as uint32 at byte 80
      const triangleCount = result.getUint32(80, true); // little-endian
      expect(triangleCount).toBe(1); // Single triangle

      geometry.dispose();
    });

    it('calculates correct file size for triangle count', () => {
      const geometry = createBoxGeometry();
      const result = geometryToSTL(geometry, { binary: true }) as DataView;

      // Read triangle count
      const triangleCount = result.getUint32(80, true);

      // Binary STL size: 84 bytes + (50 bytes per triangle)
      // Each triangle: 12 bytes normal + 36 bytes vertices + 2 bytes attribute
      const expectedSize = 84 + triangleCount * 50;
      expect(result.byteLength).toBe(expectedSize);

      geometry.dispose();
    });

    it('handles box geometry with multiple triangles', () => {
      const geometry = createBoxGeometry();
      const result = geometryToSTL(geometry, { binary: true }) as DataView;

      // Box has 6 faces * 2 triangles = 12 triangles
      const triangleCount = result.getUint32(80, true);
      expect(triangleCount).toBe(12);

      geometry.dispose();
    });
  });

  describe('ASCII format', () => {
    it('returns string for ASCII STL', () => {
      const geometry = createSimpleGeometry();
      const result = geometryToSTL(geometry, { binary: false });

      expect(typeof result).toBe('string');
      geometry.dispose();
    });

    it('starts with solid keyword', () => {
      const geometry = createSimpleGeometry();
      const result = geometryToSTL(geometry, { binary: false }) as string;

      expect(result.trim().startsWith('solid')).toBe(true);
      geometry.dispose();
    });

    it('ends with endsolid keyword', () => {
      const geometry = createSimpleGeometry();
      const result = geometryToSTL(geometry, { binary: false }) as string;

      // STL can end with "endsolid" or "endsolid <name>"
      const trimmed = result.trim();
      expect(
        trimmed.endsWith('endsolid') ||
          trimmed.split('\n').at(-1)?.startsWith('endsolid')
      ).toBe(true);
      geometry.dispose();
    });

    it('contains facet definitions', () => {
      const geometry = createSimpleGeometry();
      const result = geometryToSTL(geometry, { binary: false }) as string;

      expect(result).toContain('facet normal');
      expect(result).toContain('outer loop');
      expect(result).toContain('vertex');
      expect(result).toContain('endloop');
      expect(result).toContain('endfacet');

      geometry.dispose();
    });
  });

  describe('defaults', () => {
    it('defaults to binary format', () => {
      const geometry = createSimpleGeometry();
      const result = geometryToSTL(geometry);

      // Default is binary, which returns DataView
      expect(result).toBeInstanceOf(DataView);
      geometry.dispose();
    });
  });
});
