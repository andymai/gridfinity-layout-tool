import { describe, it, expect, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import { LabelPlateMeshes } from './LabelPlateMeshes';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/shared/constants/bin';
import { FeatureTag } from '@/shared/types/generation';
import type { LabelPlateMeshData } from '@/shared/types/generation';

// The component's job is choosing poses and how many meshes to emit; the
// geometry itself is the worker's and is covered by labelPlateGenerator.test.
const meshGeometry = vi.hoisted(() =>
  vi.fn((_args: { faceGroups?: unknown }) => ({
    geometry: {},
    edgesGeometry: null,
    hasPrecomputedNormals: true,
  }))
);
vi.mock('@/shared/components/preview/useMeshGeometry', () => ({ useMeshGeometry: meshGeometry }));

function plate(over: Partial<LabelPlateMeshData> = {}): LabelPlateMeshData {
  return {
    vertices: new Float32Array([0, 0, 0]),
    normals: new Float32Array([0, 0, 1]),
    indices: new Uint32Array([0]),
    triangleCount: 1,
    seatX: 10,
    seatY: -20,
    seatZ: 30,
    slideY: -1,
    widthMm: 36,
    ...over,
  };
}

function setPlates(
  plates: LabelPlateMeshData[] | null,
  featureColors = DEFAULT_BIN_PARAMS.featureColors
) {
  useDesignerStore.setState({
    params: { ...DEFAULT_BIN_PARAMS, depth: 2, gridUnitMm: 42, featureColors },
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

  it('renders nothing while the plates are hidden from the preview', () => {
    setPlates([plate(), plate({ seatX: 60 })]);
    useDesignerStore.setState((s) => ({ ui: { ...s.ui, showLabelPlates: false } }));
    const { container } = render(<LabelPlateMeshes color="#ccc" lidOffsetMm={0} />);

    expect(container.firstChild).toBeNull();
    act(() => useDesignerStore.setState((s) => ({ ui: { ...s.ui, showLabelPlates: true } })));
    expect(container.querySelectorAll('mesh')).toHaveLength(4);
  });

  // Every plate is drawn twice from one mesh: seated, and in the reference row.
  it('draws each plate twice', () => {
    setPlates([plate(), plate({ seatX: 60 })]);
    const { container } = render(<LabelPlateMeshes color="#ccc" lidOffsetMm={0} />);

    expect(container.querySelectorAll('mesh')).toHaveLength(4);
  });

  // The pitch stands the plate up before the yaw turns it onto its wall, so the
  // Euler order has to apply X first.
  it('pitches a standing plate before yawing it, and lays its row copy flat', () => {
    setPlates([plate({ standing: true, slideY: 0, slideZ: 1, yawDeg: 90 })]);
    const { container } = render(<LabelPlateMeshes color="#ccc" lidOffsetMm={0} />);

    const [seated, row] = Array.from(container.querySelectorAll('mesh'));
    expect(seated.getAttribute('rotation')).toBe(`${Math.PI / 2},0,${Math.PI / 2},ZYX`);
    expect(row.getAttribute('rotation')).toBe('0,0,0,ZYX');
  });

  it('paints plate glyphs the Text colour when it differs from the label tab', () => {
    const tagged = plate({
      faceGroups: [
        { start: 0, count: 3, tag: FeatureTag.TEXT },
        { start: 3, count: 3, tag: FeatureTag.UNKNOWN },
      ],
    });
    const colors = { ...DEFAULT_BIN_PARAMS.featureColors, enabled: true, labelTab: '#111111' };

    setPlates([tagged], { ...colors, text: '#ff0000' });
    meshGeometry.mockClear();
    render(<LabelPlateMeshes color="#ccc" lidOffsetMm={0} />);
    expect(meshGeometry.mock.calls.at(-1)?.[0].faceGroups).toEqual([
      { start: 0, count: 3, materialIndex: 1 },
      { start: 3, count: 3, materialIndex: 0 },
    ]);

    setPlates([tagged], { ...colors, text: '#111111' });
    meshGeometry.mockClear();
    render(<LabelPlateMeshes color="#ccc" lidOffsetMm={0} />);
    expect(meshGeometry.mock.calls.at(-1)?.[0].faceGroups).toBeUndefined();
  });
});
