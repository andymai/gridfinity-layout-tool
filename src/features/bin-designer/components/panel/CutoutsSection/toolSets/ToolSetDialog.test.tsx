import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { Cutout, ToolSetSpec } from '@/features/bin-designer/types';
import { ToolSetDialog } from './ToolSetDialog';

const SPEC: ToolSetSpec = {
  family: 'combinationWrench',
  units: 'metric',
  sizes: ['13'],
  style: 'flat',
  clearanceMm: 0.4,
  labelSizeMm: 5,
  fingerChannel: true,
};

const POCKET: Cutout = {
  id: 'p13',
  shape: 'rectangle',
  x: 5,
  y: 5,
  width: 20,
  depth: 20,
  cutDepth: 5,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
};

describe('ToolSetDialog', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('adds the picked sizes as a set and closes', () => {
    const onClose = vi.fn();
    render(<ToolSetDialog setId={null} onClose={onClose} />);
    expect(screen.getByTestId('tool-set-preview')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '8', pressed: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Add set' }));

    const sets = Object.values(useDesignerStore.getState().params.cutoutToolSets ?? {});
    expect(sets).toHaveLength(1);
    expect(sets[0]?.sizes).not.toContain('8');
    expect(onClose).toHaveBeenCalled();
  });

  it('switches to the SAE table and its first preset', () => {
    render(<ToolSetDialog setId={null} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: 'SAE' }));
    expect(screen.getByRole('button', { name: '1/2', pressed: true })).toBeInTheDocument();
  });

  it('cannot add a set with no sizes', () => {
    render(<ToolSetDialog setId={null} onClose={vi.fn()} />);
    for (const on of screen.getAllByRole('button', { pressed: true })) fireEvent.click(on);
    expect(screen.getByRole('button', { name: 'Add set' })).toBeDisabled();
    expect(screen.getByText('Pick at least one size.')).toBeInTheDocument();
  });

  it('edits an existing set with a warning that its pockets are rebuilt', () => {
    useDesignerStore.getState().setParams({ cutoutToolSets: { g1: SPEC } });
    render(<ToolSetDialog setId="g1" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: '13', pressed: true })).toBeInTheDocument();
    expect(screen.getByText(/rebuilds the set/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update set' })).toBeEnabled();
  });

  it('says before Add when the set does not fit, and cannot add it', () => {
    useDesignerStore.getState().setParams({
      width: 2,
      depth: 2,
      cellMask: { cols: 2, rows: 2, cells: [1, 1, 1, 0] },
    });
    render(<ToolSetDialog setId={null} onClose={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/does not fit this bin/);
    expect(screen.getByRole('button', { name: 'Add set' })).toBeDisabled();
  });

  it('cannot update a set with a locked pocket, and says why', () => {
    useDesignerStore.getState().setParams({
      cutoutToolSets: { g1: SPEC },
      cutouts: [{ ...POCKET, parentGroups: ['g1'], toolSetPart: 'pocket:13', locked: true }],
    });
    render(<ToolSetDialog setId="g1" onClose={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Unlock the pockets/);
    expect(screen.getByRole('button', { name: 'Update set' })).toBeDisabled();
  });

  it('stays an edit when the set recipe goes away while it is open', () => {
    useDesignerStore.getState().setParams({
      cutoutToolSets: { g1: SPEC },
      cutouts: [{ ...POCKET, parentGroups: ['g1'], toolSetPart: 'pocket:13' }],
    });
    render(<ToolSetDialog setId="g1" onClose={vi.fn()} />);
    act(() => useDesignerStore.getState().setParams({ cutoutToolSets: undefined }));
    expect(screen.getByRole('button', { name: 'Update set' })).toBeInTheDocument();
  });

  it('says the bin prints in pieces when the planned bin is larger than the bed', () => {
    render(<ToolSetDialog setId={null} onClose={vi.fn()} />);
    expect(screen.getByText(/so it prints in pieces/)).toBeInTheDocument();
  });

  it('only says the bin is larger when splitting is off', () => {
    useDesignerStore.getState().setParams({ splitToFitBed: false });
    render(<ToolSetDialog setId={null} onClose={vi.fn()} />);
    expect(
      screen.getByText('With this set, the bin is larger than your print bed.')
    ).toBeInTheDocument();
  });

  it('has no bed note for a set whose bin fits the bed', () => {
    render(<ToolSetDialog setId={null} onClose={vi.fn()} />);
    for (const on of screen.getAllByRole('button', { pressed: true })) fireEvent.click(on);
    fireEvent.click(screen.getByRole('button', { name: '10', pressed: false }));
    expect(screen.queryByText(/larger than your print bed/)).not.toBeInTheDocument();
  });
});
