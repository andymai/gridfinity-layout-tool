import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import { findAssemblyPart } from '@/features/bin-designer/utils/assemblyTree';
import type { AssemblyPartNode } from '@/shared/types/assembly';
import { CutterProfileSection } from './CutterProfileSection';

function cutterNode(): Extract<AssemblyPartNode, { type: 'cutter' }> {
  const s = useDesignerStore.getState();
  if (s.structure?.kind !== 'assembly') throw new Error('no assembly');
  const node = s.structure.parts[0];
  if (!node || node.type !== 'cutter') throw new Error('no cutter');
  return node;
}

describe('CutterProfileSection', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().newDesign('assembly');
    useDesignerStore.getState().addAssemblyPart('cutter', null);
  });

  it('switches to a fresh slot profile', () => {
    render(<CutterProfileSection node={cutterNode()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Slot' }));
    const s = useDesignerStore.getState();
    if (s.structure?.kind !== 'assembly') throw new Error('no assembly');
    const node = findAssemblyPart(s.structure.parts, cutterNode().id);
    expect(node?.type === 'cutter' && node.params.profile).toEqual({
      shape: 'slot',
      length: 40,
      width: 3.5,
    });
  });

  it('edits the active profile dimension', () => {
    render(<CutterProfileSection node={cutterNode()} />);
    const field = screen.getByRole('spinbutton', { name: 'Diameter' });
    fireEvent.change(field, { target: { value: '9' } });
    fireEvent.blur(field);
    const node = cutterNode();
    expect(node.params.profile.shape === 'circle' && node.params.profile.diameter).toBe(9);
  });
});
