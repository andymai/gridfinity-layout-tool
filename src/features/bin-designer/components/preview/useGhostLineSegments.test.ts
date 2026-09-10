import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { useGhostLineSegments } from './useGhostLineSegments';

const invalidateMock = vi.fn();
const sizeMock = { width: 800, height: 600 };
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ size: sizeMock, invalidate: invalidateMock }),
}));

const STYLE = { color: '#fbbf24', opacity: 0.75, lineWidth: 2 };

function makeGeometry() {
  const geo = new LineSegmentsGeometry();
  geo.setPositions([0, 0, 0, 1, 0, 0]);
  return geo;
}

describe('useGhostLineSegments', () => {
  beforeEach(() => {
    invalidateMock.mockClear();
    sizeMock.width = 800;
    sizeMock.height = 600;
  });

  it('returns nothing without geometry and requests no frame', () => {
    const { result } = renderHook(() => useGhostLineSegments(null, STYLE));
    expect(result.current).toBeNull();
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it('builds fat lines styled from the options at the canvas resolution', () => {
    const geometry = makeGeometry();
    const { result } = renderHook(() => useGhostLineSegments(geometry, STYLE));

    const lines = result.current;
    expect(lines).not.toBeNull();
    expect(lines?.geometry).toBe(geometry);
    expect(lines?.material.opacity).toBe(0.75);
    expect(lines?.material.linewidth).toBe(2);
    expect(lines?.material.depthTest).toBe(true);
    expect(lines?.material.resolution.x).toBe(800);
  });

  it('requests a frame once the lines exist', () => {
    // A 0x0 canvas makes the resolution hook skip its own invalidate, so the
    // single call here is the lifecycle hook's.
    sizeMock.width = 0;
    sizeMock.height = 0;
    renderHook(() => useGhostLineSegments(makeGeometry(), STYLE));
    expect(invalidateMock).toHaveBeenCalledTimes(1);
  });

  it('draws through the solid when asked', () => {
    const { result } = renderHook(() =>
      useGhostLineSegments(makeGeometry(), { ...STYLE, throughSolid: true })
    );
    expect(result.current?.material.depthTest).toBe(false);
    expect(result.current?.material.depthWrite).toBe(false);
  });

  it('disposes geometry and material when the geometry changes or the hook unmounts', () => {
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

    const secondMaterial = result.current?.material;
    const secondMaterialDispose = vi.spyOn(
      secondMaterial as NonNullable<typeof secondMaterial>,
      'dispose'
    );
    unmount();
    expect(secondDispose).toHaveBeenCalledOnce();
    expect(secondMaterialDispose).toHaveBeenCalledOnce();
  });

  it('keeps the geometry when only the style changes', () => {
    const geometry = makeGeometry();
    const dispose = vi.spyOn(geometry, 'dispose');
    const { result, rerender } = renderHook(
      ({ opacity }: { opacity: number }) => useGhostLineSegments(geometry, { ...STYLE, opacity }),
      { initialProps: { opacity: 0.75 } }
    );
    const firstMaterial = result.current?.material;

    rerender({ opacity: 0.4 });
    expect(dispose).not.toHaveBeenCalled();
    expect(result.current?.material).not.toBe(firstMaterial);
    expect(result.current?.material.opacity).toBe(0.4);
  });
});
