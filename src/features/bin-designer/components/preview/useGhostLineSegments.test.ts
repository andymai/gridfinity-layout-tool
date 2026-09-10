import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { useGhostLineSegments } from './useGhostLineSegments';

const invalidateMock = vi.fn();
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ size: { width: 800, height: 600 }, invalidate: invalidateMock }),
}));

const STYLE = { color: '#fbbf24', opacity: 0.75, lineWidth: 2 };

function makeGeometry() {
  const geo = new LineSegmentsGeometry();
  geo.setPositions([0, 0, 0, 1, 0, 0]);
  return geo;
}

describe('useGhostLineSegments', () => {
  beforeEach(() => invalidateMock.mockClear());

  it('returns nothing without geometry and requests no frame', () => {
    const { result } = renderHook(() => useGhostLineSegments(null, STYLE));
    expect(result.current).toBeNull();
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it('builds fat lines styled from the options and requests a frame', () => {
    const geometry = makeGeometry();
    const { result } = renderHook(() => useGhostLineSegments(geometry, STYLE));

    const lines = result.current;
    expect(lines).not.toBeNull();
    expect(lines?.geometry).toBe(geometry);
    expect(lines?.material.opacity).toBe(0.75);
    expect(lines?.material.linewidth).toBe(2);
    expect(lines?.material.depthTest).toBe(true);
    expect(lines?.material.resolution.x).toBe(800);
    expect(invalidateMock).toHaveBeenCalled();
  });

  it('draws through the solid when asked', () => {
    const { result } = renderHook(() =>
      useGhostLineSegments(makeGeometry(), { ...STYLE, throughSolid: true })
    );
    expect(result.current?.material.depthTest).toBe(false);
    expect(result.current?.material.depthWrite).toBe(false);
  });

  it('disposes the geometry and material together when the geometry changes or unmounts', () => {
    const first = makeGeometry();
    const second = makeGeometry();
    const firstDispose = vi.spyOn(first, 'dispose');
    const secondDispose = vi.spyOn(second, 'dispose');
    const { result, rerender, unmount } = renderHook(
      ({ geometry }: { geometry: LineSegmentsGeometry }) => useGhostLineSegments(geometry, STYLE),
      { initialProps: { geometry: first } }
    );
    const firstMaterial = result.current?.material;
    const firstMaterialDispose = vi.spyOn(
      firstMaterial as NonNullable<typeof firstMaterial>,
      'dispose'
    );

    rerender({ geometry: second });
    expect(firstDispose).toHaveBeenCalledOnce();
    expect(firstMaterialDispose).toHaveBeenCalledOnce();
    expect(result.current?.material).not.toBe(firstMaterial);
    expect(secondDispose).not.toHaveBeenCalled();

    unmount();
    expect(secondDispose).toHaveBeenCalledOnce();
  });
});
