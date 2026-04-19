import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { useLineMaterialResolution } from './useLineMaterialResolution';

const sizeMock = { width: 0, height: 0 };
const invalidateMock = vi.fn();

vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ size: sizeMock, invalidate: invalidateMock }),
}));

function makeMaterial() {
  return { resolution: { set: vi.fn() } } as unknown as LineMaterial;
}

describe('useLineMaterialResolution', () => {
  beforeEach(() => {
    sizeMock.width = 800;
    sizeMock.height = 600;
    invalidateMock.mockClear();
  });

  it('sets resolution on mount when material is non-null', () => {
    const material = makeMaterial();
    renderHook(() => useLineMaterialResolution(material));
    expect(material.resolution.set).toHaveBeenCalledWith(800, 600);
    expect(invalidateMock).toHaveBeenCalled();
  });

  it('is a no-op when material is null', () => {
    expect(() => renderHook(() => useLineMaterialResolution(null))).not.toThrow();
  });

  it('updates resolution when canvas size changes', () => {
    const material = makeMaterial();
    const { rerender } = renderHook(() => useLineMaterialResolution(material));
    vi.mocked(material.resolution.set).mockClear();

    sizeMock.width = 1200;
    sizeMock.height = 900;
    rerender();

    expect(material.resolution.set).toHaveBeenCalledWith(1200, 900);
  });

  it('updates resolution when material reference changes', () => {
    const first = makeMaterial();
    const { rerender } = renderHook(
      ({ material }: { material: LineMaterial | null }) => useLineMaterialResolution(material),
      { initialProps: { material: first } }
    );
    expect(first.resolution.set).toHaveBeenCalledWith(800, 600);

    const second = makeMaterial();
    rerender({ material: second });
    expect(second.resolution.set).toHaveBeenCalledWith(800, 600);
  });

  it('skips setting resolution when canvas size is 0×0 (pre-measurement)', () => {
    sizeMock.width = 0;
    sizeMock.height = 0;
    const material = makeMaterial();
    renderHook(() => useLineMaterialResolution(material));
    expect(material.resolution.set).not.toHaveBeenCalled();
    expect(invalidateMock).not.toHaveBeenCalled();
  });

  it('applies resolution once size becomes non-zero after a 0×0 pre-measurement', () => {
    sizeMock.width = 0;
    sizeMock.height = 0;
    const material = makeMaterial();
    const { rerender } = renderHook(() => useLineMaterialResolution(material));
    expect(material.resolution.set).not.toHaveBeenCalled();

    sizeMock.width = 800;
    sizeMock.height = 600;
    rerender();
    expect(material.resolution.set).toHaveBeenCalledWith(800, 600);
  });
});
