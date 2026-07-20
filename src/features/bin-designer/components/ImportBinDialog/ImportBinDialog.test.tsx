import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { GridClaim, PendingBinImport } from './useImportBinDesign';

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

import { ImportBinDialog } from './ImportBinDialog';

function pendingFixture(overrides?: Partial<PendingBinImport['detected']>): PendingBinImport {
  return {
    asset: {
      name: 'widget_bin',
      data: 'AAAA',
      triangleCount: 1234,
      sizeMm: { x: 83.5, y: 41.5, z: 25.4 },
      outlines: [
        [
          { x: 0, y: 0 },
          { x: 83.5, y: 0 },
          { x: 83.5, y: 41.5 },
        ],
      ],
    },
    positions: new Float32Array(9),
    indices: new Uint32Array(3),
    volumeMm3: 25000,
    fileName: 'widget_bin.stl',
    rotation: { x: 0, y: 0, z: 0 },
    detected: {
      width: 2,
      depth: 1,
      heightUnits: 3,
      deviation: { x: 0, y: 0, z: 0 },
      hasLip: true,
      offGrid: false,
      ...overrides,
    },
  };
}

const claim: GridClaim = { width: 2, depth: 1, heightUnits: 3 };
const noop = () => undefined;

function renderDialog(
  pending: PendingBinImport | null,
  props?: Partial<Parameters<typeof ImportBinDialog>[0]>
) {
  return render(
    <ImportBinDialog
      pending={pending}
      importing={false}
      claim={claim}
      onClaimChange={noop}
      onRotate={noop}
      onSave={noop}
      onCancel={noop}
      {...props}
    />
  );
}

describe('ImportBinDialog', () => {
  it('renders nothing without a pending import', () => {
    const { container } = renderDialog(null);
    expect(container.innerHTML).toBe('');
  });

  it('shows mesh name, dimensions, and lip note', () => {
    renderDialog(pendingFixture());
    expect(screen.getByText('widget_bin')).toBeInTheDocument();
    expect(screen.getByText(/83\.5 × 41\.5 × 25\.4 mm/)).toBeInTheDocument();
    // hasLip: true renders the lip-detected note
    expect(screen.getByText(/stacking lip/i)).toBeInTheDocument();
  });

  it('shows the off-grid warning only when detection flags it', () => {
    const { unmount } = renderDialog(pendingFixture());
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    unmount();

    renderDialog(pendingFixture({ offGrid: true }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('reports claim changes through onClaimChange', () => {
    const onClaimChange = vi.fn();
    renderDialog(pendingFixture(), { onClaimChange });
    const widthInput = screen
      .getAllByLabelText(/width/i)
      .find((el) => el.tagName === 'INPUT') as HTMLElement;
    fireEvent.change(widthInput, { target: { value: '3' } });
    fireEvent.blur(widthInput);
    expect(onClaimChange).toHaveBeenCalled();
  });

  it('save button triggers onSave and cancel triggers onCancel', () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    renderDialog(pendingFixture(), { onSave, onCancel });
    fireEvent.click(screen.getByRole('button', { name: /save|import/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
