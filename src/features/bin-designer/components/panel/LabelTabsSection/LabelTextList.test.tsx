import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LabelTextList } from './LabelTextList';
import type { LabelTextRowModel } from './LabelTextList';

function rows(...values: string[]): LabelTextRowModel[] {
  return values.map((value, i) => ({
    index: i,
    displayNumber: i + 1,
    value,
    overflows: false,
  }));
}

function renderList(overrides: Partial<Parameters<typeof LabelTextList>[0]> = {}) {
  const props = {
    rows: rows('SCREWS', '', ''),
    spanning: false,
    onToggleSpan: vi.fn(),
    onCommit: vi.fn(),
    onClearAll: vi.fn(),
    ...overrides,
  };
  render(<LabelTextList {...props} />);
  return props;
}

describe('LabelTextList', () => {
  it('renders every row, including the filled ones', () => {
    renderList();
    // Filled rows are dimmed, never removed: the row number is only meaningful
    // because it matches the compartment grid, and hiding rows breaks that map.
    expect(screen.getByLabelText('Engraved text for compartment 1')).toHaveValue('SCREWS');
    expect(screen.getByLabelText('Engraved text for compartment 2')).toHaveValue('');
    expect(screen.getByLabelText('Engraved text for compartment 3')).toHaveValue('');
  });

  it('counts how many tabs will print blank', () => {
    renderList();
    expect(screen.getByText('2 tabs will print blank')).toBeInTheDocument();
    expect(screen.getByText('1 of 3 filled')).toBeInTheDocument();
  });

  it('says nothing about blanks when every row is filled', () => {
    renderList({ rows: rows('A', 'B') });
    expect(screen.queryByText(/will print blank/)).not.toBeInTheDocument();
  });

  it('drops the number column for a single compartment', () => {
    renderList({ rows: rows('') });
    // Nothing to count against, so the "1" would be pure noise.
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('flags an overflowing caption and offers the widen fix', () => {
    const onWiden = vi.fn();
    renderList({
      rows: [{ index: 0, displayNumber: 1, value: 'A VERY LONG CAPTION', overflows: true }],
      onWiden,
    });
    const input = screen.getByLabelText('Engraved text for compartment 1');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Too long to print at a legible size.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Widen tabs' }));
    expect(onWiden).toHaveBeenCalled();
  });

  it('omits the widen fix when there is nothing left to widen', () => {
    renderList({
      rows: [{ index: 0, displayNumber: 1, value: 'LONG', overflows: true }],
    });
    expect(screen.getByText('Too long to print at a legible size.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Widen tabs' })).not.toBeInTheDocument();
  });

  it('Enter commits and moves to the next row', () => {
    const props = renderList();
    const first = screen.getByLabelText('Engraved text for compartment 1');
    fireEvent.change(first, { target: { value: 'BOLTS' } });
    fireEvent.keyDown(first, { key: 'Enter' });
    expect(props.onCommit).toHaveBeenCalledWith(0, 'BOLTS');
    expect(screen.getByLabelText('Engraved text for compartment 2')).toHaveFocus();
  });

  it('Enter on the last row stays put rather than wrapping', () => {
    renderList();
    const last = screen.getByLabelText('Engraved text for compartment 3');
    fireEvent.keyDown(last, { key: 'Enter' });
    expect(last).toHaveFocus();
  });

  it('jumps to the next blank row', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Next blank' }));
    expect(screen.getByLabelText('Engraved text for compartment 2')).toHaveFocus();
  });

  it('clears a single row without touching the others', () => {
    const props = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Clear label text for 1' }));
    expect(props.onCommit).toHaveBeenCalledWith(0, '');
  });

  it('keeps the clear buttons out of the tab order', () => {
    renderList();
    // Tab must step input to input — that is the fast path for a long list.
    expect(screen.getByRole('button', { name: 'Clear label text for 1' })).toHaveAttribute(
      'tabindex',
      '-1'
    );
  });

  it('offers clear-all only when something is filled', () => {
    const props = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(props.onClearAll).toHaveBeenCalled();
  });

  it('hides clear-all when the list is empty', () => {
    renderList({ rows: rows('', '') });
    expect(screen.queryByRole('button', { name: 'Clear all' })).not.toBeInTheDocument();
  });

  it('switches the list between per-compartment and per-row', () => {
    const props = renderList();
    fireEvent.click(screen.getByRole('button', { name: 'One per row' }));
    expect(props.onToggleSpan).toHaveBeenCalledWith(true);
  });

  it('labels rows by row number in span mode', () => {
    renderList({ spanning: true, rows: rows('', '') });
    expect(screen.getByLabelText('Label text for row 1')).toBeInTheDocument();
  });

  it('follows a compartment picked on the grid', () => {
    const { rerender } = render(
      <LabelTextList
        rows={rows('SCREWS', '', '')}
        spanning={false}
        onToggleSpan={vi.fn()}
        onCommit={vi.fn()}
        onClearAll={vi.fn()}
        focusIndex={null}
      />
    );
    // "Pick on grid" is a picker INTO this list, not a second editor: the grid
    // click moves focus here rather than opening a field of its own.
    rerender(
      <LabelTextList
        rows={rows('SCREWS', '', '')}
        spanning={false}
        onToggleSpan={vi.fn()}
        onCommit={vi.fn()}
        onClearAll={vi.fn()}
        focusIndex={2}
      />
    );
    expect(screen.getByLabelText('Engraved text for compartment 3')).toHaveFocus();
  });

  it('reports its own navigation back so the grid highlight follows', () => {
    const onFocusChange = vi.fn();
    renderList({ onFocusChange });
    fireEvent.click(screen.getByRole('button', { name: 'Next blank' }));
    expect(onFocusChange).toHaveBeenCalledWith(1);
  });

  it('carries the plate width and icon on the SAME row as the text', () => {
    const onPlateWidthChange = vi.fn();
    renderList({
      rows: [
        {
          index: 0,
          displayNumber: 1,
          value: 'SCREWS',
          overflows: false,
          plate: { fittingWidthsU: [1, 2], autoWidthU: 1, overrideU: null, icon: null },
        },
      ],
      onPlateWidthChange,
      onPlateIconChange: vi.fn(),
    });
    // One compartment, one row: text and plate hardware were two lists over the
    // same compartments, so row 3 meant different things in each.
    expect(screen.getByLabelText('Engraved text for compartment 1')).toHaveValue('SCREWS');
    fireEvent.change(screen.getByLabelText('Plate width for compartment 1'), {
      target: { value: '2' },
    });
    expect(onPlateWidthChange).toHaveBeenCalledWith(0, 2);
  });

  it('says so when no standard plate fits the compartment', () => {
    renderList({
      rows: [
        {
          index: 0,
          displayNumber: 1,
          value: '',
          overflows: false,
          plate: { fittingWidthsU: [], autoWidthU: null, overrideU: null, icon: null },
        },
      ],
      onPlateWidthChange: vi.fn(),
      onPlateIconChange: vi.fn(),
    });
    expect(screen.getByText('No standard plate fits')).toBeInTheDocument();
    expect(screen.queryByLabelText('Plate width for compartment 1')).not.toBeInTheDocument();
  });

  it('shows no plate controls in text mode', () => {
    renderList();
    expect(screen.queryByLabelText('Plate width for compartment 1')).not.toBeInTheDocument();
  });

  it('offers the linked bin name as a starting caption', () => {
    const onApplySuggestedName = vi.fn();
    renderList({
      rows: rows(''),
      suggestedName: 'SCREWS',
      onApplySuggestedName,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use bin name “SCREWS”' }));
    expect(onApplySuggestedName).toHaveBeenCalled();
  });

  it('shows no suggestion when none was offered', () => {
    renderList({ rows: rows('') });
    expect(screen.queryByRole('button', { name: /Use bin name/ })).not.toBeInTheDocument();
  });

  it('renders nothing when no tab can host text', () => {
    const { container } = render(
      <LabelTextList
        rows={[]}
        spanning={false}
        onToggleSpan={vi.fn()}
        onCommit={vi.fn()}
        onClearAll={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
