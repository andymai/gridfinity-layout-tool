import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { resetAllStores } from '@/test/testUtils';
import { useDesignerStore } from '@/features/bin-designer/store';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants';
import { CustomGridEditor } from './CustomGridEditor';

function seedCustom(cols: number, rows: number, cells: number[]) {
  useDesignerStore.setState({
    params: {
      ...DEFAULT_BIN_PARAMS,
      style: 'slotted',
      width: 3,
      depth: 2,
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        layout: 'custom',
        customGrid: { cols, rows, cells },
      },
    },
  });
}

describe('CustomGridEditor', () => {
  beforeEach(() => {
    resetAllStores();
    vi.clearAllMocks();
  });

  it('renders dimension steppers, merge/split, and a piece count', () => {
    seedCustom(2, 2, [0, 1, 2, 3]);
    render(<CustomGridEditor />);
    expect(screen.getByText(/columns/i)).toBeInTheDocument();
    expect(screen.getByText(/rows/i)).toBeInTheDocument();
    expect(screen.getByText(/merge/i)).toBeInTheDocument();
    expect(screen.getByText(/split/i)).toBeInTheDocument();
    expect(screen.getByText(/\d+ pieces/i)).toBeInTheDocument();
  });

  it('merges a selected rectangle via setParam', () => {
    const setParam = vi.fn();
    seedCustom(2, 2, [0, 1, 2, 3]);
    useDesignerStore.setState({ setParam });
    render(<CustomGridEditor />);

    // Select two adjacent cells (a valid 1x2 rectangle) then merge.
    fireEvent.click(screen.getByLabelText('cell 0,0'));
    fireEvent.click(screen.getByLabelText('cell 1,0'));
    fireEvent.click(screen.getByText(/merge/i));

    expect(setParam).toHaveBeenCalledWith(
      'slotConfig',
      expect.objectContaining({ customGrid: expect.objectContaining({ cols: 2, rows: 2 }) })
    );
  });

  it('splits every selected compartment in one stable pass', () => {
    const setParam = vi.fn();
    // Two horizontal bars: top row = compartment 0, bottom row = compartment 1.
    seedCustom(2, 2, [0, 0, 1, 1]);
    useDesignerStore.setState({ setParam });
    render(<CustomGridEditor />);

    // Select one cell from each merged compartment, then split.
    fireEvent.click(screen.getByLabelText('cell 0,1')); // top bar
    fireEvent.click(screen.getByLabelText('cell 0,0')); // bottom bar
    fireEvent.click(screen.getByText(/split/i));

    const call = setParam.mock.calls.find(([k]) => k === 'slotConfig');
    const cells: number[] = call?.[1].customGrid.cells;
    // Both compartments fully split → four distinct single-cell compartments.
    expect(new Set(cells).size).toBe(4);
  });

  it('surfaces a friction warning for an unanchored interior piece', () => {
    // col0 & col2 full; col1 split → a lone horizontal friction piece.
    seedCustom(3, 3, [0, 1, 2, 0, 3, 2, 0, 3, 2]);
    render(<CustomGridEditor />);
    expect(screen.getByText(/friction-held/i)).toBeInTheDocument();
  });
});
