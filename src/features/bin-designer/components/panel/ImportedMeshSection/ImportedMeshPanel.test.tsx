import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportedMeshPanel } from './ImportedMeshPanel';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_UI_STATE } from '@/features/bin-designer/constants';
import { createDefaultEnvelope } from '@/shared/items/defaultEnvelope';
import type { ImportedMeshStructure, ItemEnvelope } from '@/shared/types/item';

const envelope: ItemEnvelope = {
  ...createDefaultEnvelope({ enabled: false } as never),
  width: 2,
  depth: 1,
};

const structure: ImportedMeshStructure = {
  kind: 'importedMesh',
  heightUnits: 3,
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
  sourceFileName: 'widget_bin.stl',
};

function setImportedState(): void {
  useDesignerStore.setState({
    itemKind: 'importedMesh',
    envelope,
    structure: { ...structure },
    ui: { ...DEFAULT_UI_STATE },
  });
}

describe('ImportedMeshPanel', () => {
  beforeEach(setImportedState);

  it('renders mesh stats and footprint controls', () => {
    render(<ImportedMeshPanel />);
    expect(screen.getByText('widget_bin')).toBeInTheDocument();
    expect(screen.getByText(/83\.5 × 41\.5 × 25\.4 mm/)).toBeInTheDocument();
    expect(screen.getByText(/Imported from widget_bin\.stl/)).toBeInTheDocument();
    expect(screen.getByText('Width (units)')).toBeInTheDocument();
    expect(screen.getByText('Height (units)')).toBeInTheDocument();
    expect(screen.getByText('Export STL')).toBeInTheDocument();
    expect(screen.getByText('3MF')).toBeInTheDocument();
  });

  it('does not offer STEP export', () => {
    render(<ImportedMeshPanel />);
    expect(screen.queryByText(/STEP/)).not.toBeInTheDocument();
  });

  it('height stepper updates structure.heightUnits', () => {
    render(<ImportedMeshPanel />);
    const input = screen
      .getAllByLabelText('Height (units)')
      .find((el) => el.tagName === 'INPUT') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.blur(input);
    const updated = useDesignerStore.getState().structure;
    expect(updated?.kind).toBe('importedMesh');
    if (updated?.kind === 'importedMesh') {
      expect(updated.heightUnits).toBe(5);
    }
  });

  it('width stepper updates the envelope', () => {
    render(<ImportedMeshPanel />);
    const input = screen
      .getAllByLabelText('Width (units)')
      .find((el) => el.tagName === 'INPUT') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2.5' } });
    fireEvent.blur(input);
    expect(useDesignerStore.getState().envelope?.width).toBe(2.5);
  });

  it('renders nothing for a bin design', () => {
    useDesignerStore.setState({ itemKind: 'bin', envelope: null, structure: null });
    const { container } = render(<ImportedMeshPanel />);
    expect(container).toBeEmptyDOMElement();
  });
});
