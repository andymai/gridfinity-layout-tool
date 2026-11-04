import { describe, it, expect, beforeEach } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useDesignerStore } from '@/features/bin-designer/store/designer';
import type { Cutout } from '@/features/bin-designer/types';
import { binBoard } from '../panel/CutoutsSection/packIntoBin';
import { getOffBoardCutoutIds } from '../panel/CutoutsSection/offBoardCutouts';
import { PhoneToolList } from './PhoneToolList';

const rect = (id: string, x: number, y: number, width: number, depth: number): Cutout => ({
  id,
  shape: 'rectangle',
  x,
  y,
  width,
  depth,
  cutDepth: 10,
  rotation: 0,
  cornerRadius: 0,
  label: '',
  groupId: null,
});

function seed(
  cutouts: Cutout[],
  size: { width: number; depth: number } = { width: 2, depth: 2 }
): void {
  act(() => {
    const s = useDesignerStore.getState();
    useDesignerStore.setState({ params: { ...s.params, ...size, style: 'solid', cutouts } });
  });
}

const cutouts = () => useDesignerStore.getState().params.cutouts;

describe('PhoneToolList', () => {
  beforeEach(() => {
    useDesignerStore.setState(useDesignerStore.getInitialState());
  });

  it('shows nothing for a bin without pockets', () => {
    const { container } = render(<PhoneToolList />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each pocket and deletes one', () => {
    seed([rect('a', 2, 2, 30, 20), rect('b', 40, 2, 20, 20)]);
    render(<PhoneToolList />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);

    fireEvent.click(screen.getAllByTitle('Delete')[0]);
    expect(cutouts().map((c) => c.id)).toEqual(['b']);
  });

  it('turns a pocket a quarter and packs the bin around it, growing it to fit', () => {
    // 110 mm fits across a 3-wide bin but not along its 2-deep floor.
    seed([rect('a', 2, 2, 110, 20), rect('b', 2, 30, 40, 20)], { width: 3, depth: 2 });
    render(<PhoneToolList />);
    const before = useDesignerStore.getState().history.past.length;

    fireEvent.click(screen.getAllByTitle('Rotate 90°')[0]);
    const { params, history } = useDesignerStore.getState();
    const turned = params.cutouts.find((c) => c.id === 'a');
    expect(turned?.rotation).toBe(90);
    expect(turned?.width).toBe(110);
    expect(params.depth).toBeGreaterThan(2);
    expect(getOffBoardCutoutIds(params.cutouts, binBoard(params)).size).toBe(0);
    expect(history.past.length).toBe(before + 1);
  });

  it('keeps a turn when packing again', () => {
    seed([rect('a', 2, 2, 30, 10)]);
    render(<PhoneToolList />);
    fireEvent.click(screen.getByTitle('Rotate 90°'));
    fireEvent.click(screen.getByText('Auto-arrange'));
    expect(cutouts()[0].rotation).toBe(90);
  });

  it('packs the pockets again in one undo step', () => {
    seed([rect('a', 50, 50, 20, 20), rect('b', 10, 60, 20, 20)]);
    const before = useDesignerStore.getState().history.past.length;
    render(<PhoneToolList />);

    fireEvent.click(screen.getByText('Auto-arrange'));
    expect(cutouts().some((c) => c.x !== 50 && c.x !== 10)).toBe(true);
    expect(useDesignerStore.getState().history.past.length).toBe(before + 1);
  });
});
