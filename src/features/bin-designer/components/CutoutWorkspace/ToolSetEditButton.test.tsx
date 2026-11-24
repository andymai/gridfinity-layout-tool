import { describe, expect, it, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { Cutout } from '@/features/bin-designer/types';
import { ToolSetEditButton } from './ToolSetEditButton';
import { toolSetOf } from './toolSetOf';

const spec = {
  family: 'combinationWrench',
  units: 'metric',
  sizes: ['13'],
  style: 'flat',
  clearanceMm: 0.4,
  labelSizeMm: 5,
  fingerChannel: true,
} as const;

function pocket(id: string, parentGroups?: string[]): Cutout {
  return {
    id,
    shape: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    depth: 10,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    ...(parentGroups ? { parentGroups } : {}),
  };
}

describe('ToolSetEditButton', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
    useDesignerStore.getState().setParams({ cutoutToolSets: { g1: { ...spec, sizes: ['13'] } } });
  });

  it('opens the set dialog for a whole selected set', () => {
    render(<ToolSetEditButton selected={[pocket('a', ['g1']), pocket('b', ['g1'])]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit set' }));
    expect(useDesignerStore.getState().ui.toolSetDialog).toEqual({ setId: 'g1' });
  });

  it('shows for one selected pocket of a set, such as a one-wrench set', () => {
    render(<ToolSetEditButton selected={[pocket('a', ['outer', 'g1'])]} />);
    expect(screen.getByRole('button', { name: 'Edit set' })).toBeInTheDocument();
  });

  it('renders nothing for shapes outside a set, or a mix', () => {
    const { container } = render(
      <ToolSetEditButton selected={[pocket('a', ['g1']), pocket('b')]} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('toolSetOf', () => {
  it('names the set every selected cutout sits in', () => {
    const sets = { g1: { ...spec, sizes: ['13'] } };
    expect(toolSetOf([pocket('a', ['x', 'g1'])], sets)).toBe('g1');
    expect(toolSetOf([pocket('a', ['x'])], sets)).toBeNull();
    expect(toolSetOf([], sets)).toBeNull();
  });
});
