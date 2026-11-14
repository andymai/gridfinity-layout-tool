import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS, DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { FeatureTag } from '@/shared/types/generation';
import { makeUniformLipCells } from '@/features/bin-designer/types/featureColors';
import { useZoneColoredMesh } from './useZoneColoredMesh';

// The hook runs outside a <Canvas>, so only the canvas context is stood in for.
// Geometry and materials are real Three.js objects.
vi.mock('@react-three/fiber', () => ({
  useThree: () => ({ invalidate: vi.fn() }),
}));

// A lip sliver over a body sliver.
const INPUT = {
  vertices: new Float32Array([0, 0, 10, 1, 0, 10, 0, 1, 10, 0, 0, 0, 1, 0, 0, 0, 1, 0]),
  normals: new Float32Array(18),
  indices: new Uint32Array([0, 1, 2, 3, 4, 5]),
  edgeVertices: new Float32Array(0),
  faceGroups: [
    { start: 0, count: 3, tag: FeatureTag.LIP },
    { start: 3, count: 3, tag: FeatureTag.UNKNOWN },
  ],
  wireframe: false,
  xray: false,
  color: '#00ff00',
};

function setColors(enabled: boolean, lipHex: string) {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      featureColors: {
        ...DEFAULT_BIN_PARAMS.featureColors,
        enabled,
        body: '#cccccc',
        lip: { corners: 1, bands: 1, cells: makeUniformLipCells(lipHex) },
      },
    },
  });
}

describe('useZoneColoredMesh', () => {
  beforeEach(() => {
    useDesignerStore.setState({ ui: { ...DEFAULT_UI_STATE, colorTool: null } });
  });

  it('renders one color when multi-color is off', () => {
    setColors(false, '#ff0000');
    const { result } = renderHook(() => useZoneColoredMesh(INPUT));
    expect(result.current.materials).toBeNull();
    expect(result.current.singleMatProps.color).toBe('#00ff00');
  });

  it('builds one material per zone when the lip color differs from the body', () => {
    setColors(true, '#ff0000');
    const { result } = renderHook(() => useZoneColoredMesh(INPUT));
    const hexes = result.current.materials?.map((m) => `#${m.color.getHexString()}`) ?? [];
    expect(hexes).toContain('#ff0000');
    expect(hexes).toContain('#cccccc');
    expect(result.current.geometry?.groups.length).toBeGreaterThan(1);
    expect(result.current.singleMatProps.color).toBe('#cccccc');
  });

  it('adds pointer handlers only while a color tool is active', () => {
    setColors(true, '#ff0000');
    const idle = renderHook(() => useZoneColoredMesh(INPUT));
    expect(idle.result.current.meshProps).toEqual({});

    useDesignerStore.setState({ ui: { ...DEFAULT_UI_STATE, colorTool: 'eyedropper' } });
    const active = renderHook(() => useZoneColoredMesh({ ...INPUT, onZoneClick: vi.fn() }));
    expect(active.result.current.meshProps.onClick).toBeTypeOf('function');
    expect(active.result.current.meshProps.onPointerMove).toBeTypeOf('function');
  });
});
