import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { PendingStlImport } from './useStlImport';

// jsdom has no WebGL — stub the 3D viewer internals.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: unknown }) => {
    void children;
    return null;
  },
}));
vi.mock('@react-three/drei', () => ({
  Center: () => null,
  OrbitControls: () => null,
}));

import { StlImportDialog } from './StlImportDialog';

const pending: PendingStlImport = {
  asset: {
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
  },
  positions: new Float32Array(9),
  indices: new Uint32Array(3),
  suggestedCutDepth: 5,
  fileName: 'wrench.stl',
  flips: { x: 0, y: 0, z: 0 },
  oversized: false,
};

const noop = () => undefined;

describe('StlImportDialog', () => {
  it('renders nothing without a pending import', () => {
    const { container } = render(
      <StlImportDialog
        pending={null}
        importing={false}
        onFlip={noop}
        onPlace={noop}
        onCancel={noop}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the asset details and flip controls', () => {
    render(
      <StlImportDialog
        pending={pending}
        importing={false}
        onFlip={noop}
        onPlace={noop}
        onCancel={noop}
      />
    );
    expect(screen.getByText('wrench')).toBeInTheDocument();
    expect(screen.getByText(/20\.0 × 10\.0 × 5\.0 mm/)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('warns when the mesh exceeds the bin interior', () => {
    render(
      <StlImportDialog
        pending={{ ...pending, oversized: true }}
        importing={false}
        onFlip={noop}
        onPlace={noop}
        onCancel={noop}
      />
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
