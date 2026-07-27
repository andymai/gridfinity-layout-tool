import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { LabelPlateMeshes } from './LabelPlateMeshes';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import type { LabelPlateMeshData } from '@/shared/types/generation';

// The component's job is choosing poses and how many meshes to emit; the
// geometry itself is the worker's and is covered by labelPlateGenerator.test.
vi.mock('@/shared/components/preview/useMeshGeometry', () => ({
  useMeshGeometry: () => ({ geometry: {}, edgesGeometry: null, hasPrecomputedNormals: true }),
}));

function plate(over: Partial<LabelPlateMeshData> = {}): LabelPlateMeshData {
  return {
    vertices: new Float32Array([0, 0, 0]),
    normals: new Float32Array([0, 0, 1]),
    indices: new Uint32Array([0]),
    edgeVertices: new Float32Array(0),
    triangleCount: 1,
    seatX: 10,
    seatY: -20,
    seatZ: 30,
    slideY: -1,
    widthMm: 36,
    ...over,
  };
}

function setPlates(plates: LabelPlateMeshData[] | null) {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS, depth: 2, gridUnitMm: 42 },
    generation: {
      status: 'complete',
      progress: 0,
      epoch: 0,
      mesh: { labelPlates: plates ? { plates, omittedCount: 0 } : undefined },
    },
  } as never);
}

describe('LabelPlateMeshes', () => {
  it('renders nothing without plates', () => {
    setPlates(null);
    const { container } = render(<LabelPlateMeshes color="#ccc" lidOffsetMm={0} />);

    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for an empty plate set', () => {
    setPlates([]);
    const { container } = render(<LabelPlateMeshes color="#ccc" lidOffsetMm={0} />);

    expect(container.firstChild).toBeNull();
  });

  // Every plate is drawn twice from one mesh: seated, and in the reference row.
  it('draws each plate twice', () => {
    setPlates([plate(), plate({ seatX: 60 })]);
    const { container } = render(<LabelPlateMeshes color="#ccc" lidOffsetMm={0} />);

    expect(container.querySelectorAll('mesh')).toHaveLength(4);
  });
});
