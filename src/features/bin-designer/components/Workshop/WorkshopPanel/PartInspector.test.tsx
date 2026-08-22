import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { findAssemblyPart } from '@/features/bin-designer/utils/assemblyTree';
import { PartInspector } from './PartInspector';

function selectedNode() {
  const s = useDesignerStore.getState();
  if (s.structure?.kind !== 'assembly' || !s.ui.selectedAssemblyPartId) {
    throw new Error('no selection');
  }
  const node = findAssemblyPart(s.structure.parts, s.ui.selectedAssemblyPartId);
  if (!node) throw new Error('missing node');
  return node;
}

describe('PartInspector', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().newDesign('assembly');
  });

  it('deletes the part', () => {
    useDesignerStore.getState().addAssemblyPart('post', null);
    render(<PartInspector node={selectedNode()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete part' }));
    const s = useDesignerStore.getState();
    expect(s.structure?.kind === 'assembly' && s.structure.parts).toEqual([]);
  });

  it('renders per-type fields for a cradle including groove style', () => {
    useDesignerStore.getState().addAssemblyPart('cradle', null);
    render(<PartInspector node={selectedNode()} />);
    expect(screen.getByText('Groove style')).toBeInTheDocument();
    expect(screen.getByText('Groove width')).toBeInTheDocument();
  });
});
