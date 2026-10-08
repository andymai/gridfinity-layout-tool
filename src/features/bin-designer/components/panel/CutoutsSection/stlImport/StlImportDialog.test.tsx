import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PendingStlImport } from './useStlImport';
import { MAX_MESH_TRIANGLES_PER_DESIGN } from '@/shared/generation/meshAsset';

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
  rotation: { x: 0, y: 0, z: 30 },
  oversized: false,
  designTriangles: 10_000,
};

const noop = () => undefined;

describe('StlImportDialog', () => {
  it('renders nothing without a pending import', () => {
    const { container } = render(
      <StlImportDialog
        pending={null}
        importing={false}
        onRotate={noop}
        onPlace={noop}
        onCancel={noop}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the asset details and rotation controls', () => {
    render(
      <StlImportDialog
        pending={pending}
        importing={false}
        onRotate={noop}
        onPlace={noop}
        onCancel={noop}
      />
    );
    expect(screen.getByText('wrench')).toBeInTheDocument();
    expect(screen.getByText(/20\.0 × 10\.0 × 5\.0 mm/)).toBeInTheDocument();
    for (const axis of ['X', 'Y', 'Z']) {
      expect(screen.getByLabelText(`Rotate ${axis} (degrees)`)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Flip ${axis}` })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('Rotate Z (degrees)')).toHaveValue(30);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('reports rotation changes from steppers and quarter-turn buttons', () => {
    const onRotate = vi.fn();
    render(
      <StlImportDialog
        pending={pending}
        importing={false}
        onRotate={onRotate}
        onPlace={noop}
        onCancel={noop}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Increase Rotate Z (degrees)' }));
    expect(onRotate).toHaveBeenCalledWith('z', 45);
    fireEvent.click(screen.getByRole('button', { name: 'Flip X' }));
    expect(onRotate).toHaveBeenCalledWith('x', 90);
  });

  it('warns when the mesh exceeds the bin interior', () => {
    render(
      <StlImportDialog
        pending={{ ...pending, oversized: true }}
        importing={false}
        onRotate={noop}
        onPlace={noop}
        onCancel={noop}
      />
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('meters the design triangles with this mesh against the budget', () => {
    render(
      <StlImportDialog
        pending={pending}
        importing={false}
        onRotate={noop}
        onPlace={noop}
        onCancel={noop}
      />
    );
    expect(screen.getByText('With this mesh: 11,234 of 400,000 triangles')).toBeInTheDocument();
    const meter = screen.getByRole('progressbar');
    expect(Number(meter.getAttribute('aria-valuenow'))).toBeCloseTo(
      (11_234 / MAX_MESH_TRIANGLES_PER_DESIGN) * 100
    );
    expect(screen.getByRole('button', { name: 'Place in bin' })).toBeEnabled();
  });

  it('holds Place back when the mesh would take the design past the budget', () => {
    const onPlace = vi.fn();
    render(
      <StlImportDialog
        pending={{ ...pending, designTriangles: MAX_MESH_TRIANGLES_PER_DESIGN - 1000 }}
        importing={false}
        onRotate={noop}
        onPlace={onPlace}
        onCancel={noop}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/triangle limit/);
    const place = screen.getByRole('button', { name: 'Place in bin' });
    expect(place).toBeDisabled();
    fireEvent.click(place);
    expect(onPlace).not.toHaveBeenCalled();
  });
});
