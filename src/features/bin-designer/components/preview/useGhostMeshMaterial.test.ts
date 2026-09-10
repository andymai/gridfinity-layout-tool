import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import * as THREE from 'three';
import { useGhostMeshMaterial } from './useGhostMeshMaterial';

const invalidateMock = vi.fn();
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ size: { width: 800, height: 600 }, invalidate: invalidateMock }),
}));

const STYLE = { color: '#22d3ee', opacity: 0.4 };

describe('useGhostMeshMaterial', () => {
  beforeEach(() => invalidateMock.mockClear());

  it('returns nothing without geometry and requests no frame', () => {
    const { result } = renderHook(() => useGhostMeshMaterial(null, STYLE));
    expect(result.current).toBeNull();
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it('builds a translucent double-sided material and requests a frame', () => {
    const { result } = renderHook(() => useGhostMeshMaterial(new THREE.BufferGeometry(), STYLE));
    const material = result.current;
    expect(material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(material?.opacity).toBe(0.4);
    expect(material?.transparent).toBe(true);
    expect(material?.side).toBe(THREE.DoubleSide);
    expect(material?.color.getHexString()).toBe('22d3ee');
    expect(invalidateMock).toHaveBeenCalled();
  });

  it('disposes the geometry and material together when the geometry changes or unmounts', () => {
    const first = new THREE.BufferGeometry();
    const second = new THREE.BufferGeometry();
    const firstDispose = vi.spyOn(first, 'dispose');
    const secondDispose = vi.spyOn(second, 'dispose');
    const { result, rerender, unmount } = renderHook(
      ({ geometry }: { geometry: THREE.BufferGeometry }) => useGhostMeshMaterial(geometry, STYLE),
      { initialProps: { geometry: first } }
    );
    const firstMaterial = result.current;
    const firstMaterialDispose = vi.spyOn(firstMaterial as THREE.MeshBasicMaterial, 'dispose');

    rerender({ geometry: second });
    expect(firstDispose).toHaveBeenCalledOnce();
    expect(firstMaterialDispose).toHaveBeenCalledOnce();
    expect(result.current).not.toBe(firstMaterial);

    unmount();
    expect(secondDispose).toHaveBeenCalledOnce();
  });
});
