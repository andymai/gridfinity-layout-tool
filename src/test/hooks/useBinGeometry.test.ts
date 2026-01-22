import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, cleanup } from '@testing-library/react';
import * as THREE from 'three';
import { createBinGeometry, useBinGeometry } from '@/hooks/useBinGeometry';

describe('useBinGeometry', () => {
  describe('createBinGeometry', () => {
    describe('geometry structure', () => {
      it('creates a BufferGeometry', () => {
        const geometry = createBinGeometry({
          width: 1,
          depth: 1,
          height: 1,
          baseColor: '#ff0000',
        });

        expect(geometry).toBeInstanceOf(THREE.BufferGeometry);
        geometry.dispose();
      });

      it('has position attribute', () => {
        const geometry = createBinGeometry({
          width: 1,
          depth: 1,
          height: 1,
          baseColor: '#00ff00',
        });

        expect(geometry.attributes.position).toBeDefined();
        expect(geometry.attributes.position.itemSize).toBe(3);
        geometry.dispose();
      });

      it('has color attribute', () => {
        const geometry = createBinGeometry({
          width: 1,
          depth: 1,
          height: 1,
          baseColor: '#0000ff',
        });

        expect(geometry.attributes.color).toBeDefined();
        expect(geometry.attributes.color.itemSize).toBe(3);
        geometry.dispose();
      });

      it('position and color arrays have same vertex count', () => {
        const geometry = createBinGeometry({
          width: 2,
          depth: 2,
          height: 2,
          baseColor: '#ffffff',
        });

        const positionCount = geometry.attributes.position.count;
        const colorCount = geometry.attributes.color.count;

        expect(positionCount).toBe(colorCount);
        geometry.dispose();
      });

      it('generates expected number of vertices for bin faces', () => {
        // A bin has multiple faces:
        // - 4 outer walls
        // - 4 top bevels
        // - 1 exterior floor
        // - 1 interior floor
        // - 4 interior walls
        // - 4 top rim segments
        // Total: 18 quads × 6 vertices per quad = 108 vertices
        const geometry = createBinGeometry({
          width: 1,
          depth: 1,
          height: 1,
          baseColor: '#ff0000',
        });

        const vertexCount = geometry.attributes.position.count;

        // 18 quads * 6 vertices per quad = 108
        expect(vertexCount).toBe(108);
        geometry.dispose();
      });
    });

    describe('dimension handling', () => {
      it('creates geometry for small bins', () => {
        const geometry = createBinGeometry({
          width: 0.5,
          depth: 0.5,
          height: 0.5,
          baseColor: '#ff0000',
        });

        expect(geometry.attributes.position.count).toBeGreaterThan(0);
        geometry.dispose();
      });

      it('creates geometry for large bins', () => {
        const geometry = createBinGeometry({
          width: 10,
          depth: 8,
          height: 12,
          baseColor: '#00ff00',
        });

        expect(geometry.attributes.position.count).toBeGreaterThan(0);
        geometry.dispose();
      });

      it('creates geometry for non-square bins', () => {
        const geometry = createBinGeometry({
          width: 3,
          depth: 1,
          height: 2,
          baseColor: '#0000ff',
        });

        expect(geometry.attributes.position.count).toBeGreaterThan(0);
        geometry.dispose();
      });

      it('handles fractional dimensions', () => {
        const geometry = createBinGeometry({
          width: 1.5,
          depth: 2.5,
          height: 3.25,
          baseColor: '#ffff00',
        });

        expect(geometry.attributes.position.count).toBeGreaterThan(0);
        geometry.dispose();
      });
    });

    describe('color handling', () => {
      it('handles hex color strings', () => {
        const geometry = createBinGeometry({
          width: 1,
          depth: 1,
          height: 1,
          baseColor: '#ff5500',
        });

        const colors = geometry.attributes.color.array;
        expect(colors.length).toBeGreaterThan(0);
        geometry.dispose();
      });

      it('handles rgb color strings', () => {
        const geometry = createBinGeometry({
          width: 1,
          depth: 1,
          height: 1,
          baseColor: 'rgb(255, 128, 0)',
        });

        expect(geometry.attributes.color.count).toBeGreaterThan(0);
        geometry.dispose();
      });

      it('handles named colors', () => {
        const geometry = createBinGeometry({
          width: 1,
          depth: 1,
          height: 1,
          baseColor: 'red',
        });

        expect(geometry.attributes.color.count).toBeGreaterThan(0);
        geometry.dispose();
      });

      it('applies base color to vertices', () => {
        const geometry = createBinGeometry({
          width: 1,
          depth: 1,
          height: 1,
          baseColor: '#ff0000', // Red
        });

        const colors = geometry.attributes.color.array as Float32Array;

        // Check that at least some vertices have red-ish color
        // (not all will be exact red due to darkening on some faces)
        let hasRedVertices = false;
        for (let i = 0; i < colors.length; i += 3) {
          if (colors[i] > 0.5 && colors[i + 1] < 0.5 && colors[i + 2] < 0.5) {
            hasRedVertices = true;
            break;
          }
        }
        expect(hasRedVertices).toBe(true);
        geometry.dispose();
      });

      it('has darkened interior faces', () => {
        const geometry = createBinGeometry({
          width: 2,
          depth: 2,
          height: 2,
          baseColor: '#ffffff', // White - easier to see darkening
        });

        const colors = geometry.attributes.color.array as Float32Array;

        // There should be some vertices with lightness < 1 (darkened)
        let hasDarkenedFaces = false;
        for (let i = 0; i < colors.length; i += 3) {
          const r = colors[i];
          const g = colors[i + 1];
          const b = colors[i + 2];
          // If any RGB component is significantly less than 1, it's darkened
          if (r < 0.9 || g < 0.9 || b < 0.9) {
            hasDarkenedFaces = true;
            break;
          }
        }
        expect(hasDarkenedFaces).toBe(true);
        geometry.dispose();
      });
    });

    describe('geometry bounds', () => {
      it('stays within expected bounds', () => {
        const geometry = createBinGeometry({
          width: 2,
          depth: 3,
          height: 4,
          baseColor: '#ff0000',
        });

        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;

        // X should be from 0 to width
        expect(box.min.x).toBeCloseTo(0, 2);
        expect(box.max.x).toBeCloseTo(2, 2);

        // Y should be from 0 to depth
        expect(box.min.y).toBeCloseTo(0, 2);
        expect(box.max.y).toBeCloseTo(3, 2);

        // Z should be from ~0 (small gap) to height
        expect(box.min.z).toBeGreaterThanOrEqual(0);
        expect(box.min.z).toBeLessThan(0.1); // Small floor gap
        expect(box.max.z).toBeCloseTo(4, 2);

        geometry.dispose();
      });

      it('has correct dimensions for 1x1x1 bin', () => {
        const geometry = createBinGeometry({
          width: 1,
          depth: 1,
          height: 1,
          baseColor: '#0000ff',
        });

        geometry.computeBoundingBox();
        const box = geometry.boundingBox!;

        expect(box.max.x - box.min.x).toBeCloseTo(1, 1);
        expect(box.max.y - box.min.y).toBeCloseTo(1, 1);
        expect(box.max.z - box.min.z).toBeCloseTo(1, 1);

        geometry.dispose();
      });
    });

    describe('vertex normals', () => {
      it('has computed normals', () => {
        const geometry = createBinGeometry({
          width: 1,
          depth: 1,
          height: 1,
          baseColor: '#ff0000',
        });

        expect(geometry.attributes.normal).toBeDefined();
        expect(geometry.attributes.normal.count).toBe(geometry.attributes.position.count);
        geometry.dispose();
      });

      it('normals are unit vectors', () => {
        const geometry = createBinGeometry({
          width: 1,
          depth: 1,
          height: 1,
          baseColor: '#00ff00',
        });

        const normals = geometry.attributes.normal.array as Float32Array;

        for (let i = 0; i < normals.length; i += 3) {
          const length = Math.sqrt(
            normals[i] ** 2 + normals[i + 1] ** 2 + normals[i + 2] ** 2
          );
          expect(length).toBeCloseTo(1, 2);
        }

        geometry.dispose();
      });
    });

    describe('edge cases', () => {
      it('handles very thin bins (small height)', () => {
        const geometry = createBinGeometry({
          width: 2,
          depth: 2,
          height: 0.1,
          baseColor: '#ff00ff',
        });

        expect(geometry.attributes.position.count).toBeGreaterThan(0);
        geometry.dispose();
      });

      it('handles very tall bins (large height)', () => {
        const geometry = createBinGeometry({
          width: 1,
          depth: 1,
          height: 50,
          baseColor: '#00ffff',
        });

        expect(geometry.attributes.position.count).toBeGreaterThan(0);
        geometry.dispose();
      });

      it('handles very wide bins', () => {
        const geometry = createBinGeometry({
          width: 20,
          depth: 1,
          height: 1,
          baseColor: '#ff0000',
        });

        expect(geometry.attributes.position.count).toBeGreaterThan(0);
        geometry.dispose();
      });
    });
  });

  describe('useBinGeometry hook', () => {
    afterEach(() => {
      cleanup();
    });

    it('returns a BufferGeometry', () => {
      const { result } = renderHook(() =>
        useBinGeometry({ width: 1, depth: 1, height: 1, baseColor: '#ff0000' })
      );

      expect(result.current).toBeInstanceOf(THREE.BufferGeometry);
    });

    it('memoizes geometry for same props', () => {
      const props = { width: 1, depth: 1, height: 1, baseColor: '#ff0000' };
      const { result, rerender } = renderHook(() => useBinGeometry(props));

      const initialGeometry = result.current;

      rerender();

      // Same object reference due to memoization
      expect(result.current).toBe(initialGeometry);
    });

    it('creates new geometry when width changes', () => {
      const { result, rerender } = renderHook(
        ({ width }) => useBinGeometry({ width, depth: 1, height: 1, baseColor: '#ff0000' }),
        { initialProps: { width: 1 } }
      );

      const initialGeometry = result.current;

      rerender({ width: 2 });

      expect(result.current).not.toBe(initialGeometry);
    });

    it('creates new geometry when depth changes', () => {
      const { result, rerender } = renderHook(
        ({ depth }) => useBinGeometry({ width: 1, depth, height: 1, baseColor: '#ff0000' }),
        { initialProps: { depth: 1 } }
      );

      const initialGeometry = result.current;

      rerender({ depth: 2 });

      expect(result.current).not.toBe(initialGeometry);
    });

    it('creates new geometry when height changes', () => {
      const { result, rerender } = renderHook(
        ({ height }) => useBinGeometry({ width: 1, depth: 1, height, baseColor: '#ff0000' }),
        { initialProps: { height: 1 } }
      );

      const initialGeometry = result.current;

      rerender({ height: 2 });

      expect(result.current).not.toBe(initialGeometry);
    });

    it('creates new geometry when color changes', () => {
      const { result, rerender } = renderHook(
        ({ baseColor }) => useBinGeometry({ width: 1, depth: 1, height: 1, baseColor }),
        { initialProps: { baseColor: '#ff0000' } }
      );

      const initialGeometry = result.current;

      rerender({ baseColor: '#00ff00' });

      expect(result.current).not.toBe(initialGeometry);
    });

    it('disposes geometry on dependency change', () => {
      const { result, rerender } = renderHook(
        ({ width }) => useBinGeometry({ width, depth: 1, height: 1, baseColor: '#ff0000' }),
        { initialProps: { width: 1 } }
      );

      const initialGeometry = result.current;
      const disposeSpy = vi.spyOn(initialGeometry, 'dispose');

      rerender({ width: 2 });

      expect(disposeSpy).toHaveBeenCalled();
    });

    it('disposes geometry on unmount', () => {
      const { result, unmount } = renderHook(() =>
        useBinGeometry({ width: 1, depth: 1, height: 1, baseColor: '#ff0000' })
      );

      const geometry = result.current;
      const disposeSpy = vi.spyOn(geometry, 'dispose');

      unmount();

      expect(disposeSpy).toHaveBeenCalled();
    });
  });

  describe('geometry consistency', () => {
    it('produces same vertex count for same dimensions', () => {
      const geometry1 = createBinGeometry({
        width: 2,
        depth: 3,
        height: 4,
        baseColor: '#ff0000',
      });
      const geometry2 = createBinGeometry({
        width: 2,
        depth: 3,
        height: 4,
        baseColor: '#00ff00',
      });

      expect(geometry1.attributes.position.count).toBe(geometry2.attributes.position.count);

      geometry1.dispose();
      geometry2.dispose();
    });

    it('produces identical positions for same dimensions', () => {
      const geometry1 = createBinGeometry({
        width: 2,
        depth: 3,
        height: 4,
        baseColor: '#ff0000',
      });
      const geometry2 = createBinGeometry({
        width: 2,
        depth: 3,
        height: 4,
        baseColor: '#00ff00',
      });

      const pos1 = geometry1.attributes.position.array;
      const pos2 = geometry2.attributes.position.array;

      expect(pos1).toEqual(pos2);

      geometry1.dispose();
      geometry2.dispose();
    });

    it('different dimensions produce different positions', () => {
      const geometry1 = createBinGeometry({
        width: 1,
        depth: 1,
        height: 1,
        baseColor: '#ff0000',
      });
      const geometry2 = createBinGeometry({
        width: 2,
        depth: 2,
        height: 2,
        baseColor: '#ff0000',
      });

      const pos1 = Array.from(geometry1.attributes.position.array);
      const pos2 = Array.from(geometry2.attributes.position.array);

      // Arrays should NOT be equal
      expect(pos1).not.toEqual(pos2);

      geometry1.dispose();
      geometry2.dispose();
    });
  });
});
