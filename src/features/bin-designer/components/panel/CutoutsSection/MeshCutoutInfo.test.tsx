import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MeshCutoutInfo } from './MeshCutoutInfo';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { Cutout } from '@/features/bin-designer/types';
import type { MeshAsset } from '@/shared/generation/meshAsset';

const asset: MeshAsset = {
  name: 'wrench',
  data: 'AAAA',
  triangleCount: 1234,
  sizeMm: { x: 20, y: 10, z: 5 },
  outlines: [
    [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
    ],
  ],
};

const cutout: Cutout = {
  id: 'mesh-1',
  shape: 'mesh',
  meshId: 'asset-1',
  x: 0,
  y: 0,
  width: 20,
  depth: 10,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
};

describe('MeshCutoutInfo', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('shows the asset name, size, and triangle count', () => {
    useDesignerStore.setState((s) => ({
      params: { ...s.params, meshAssets: { 'asset-1': asset } },
    }));
    render(<MeshCutoutInfo cutout={cutout} />);
    expect(screen.getByText('wrench')).toBeInTheDocument();
    expect(screen.getByText(/20\.0 × 10\.0 × 5\.0 mm/)).toBeInTheDocument();
  });

  it('renders nothing when the asset is missing', () => {
    const { container } = render(<MeshCutoutInfo cutout={cutout} />);
    expect(container).toBeEmptyDOMElement();
  });
});
