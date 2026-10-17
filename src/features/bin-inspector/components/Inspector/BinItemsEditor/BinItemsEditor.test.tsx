import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CONSTRAINTS } from '@/core/constants';
import type { BinItem } from '@/core/types';
import { BinItemsEditor } from './BinItemsEditor';

function setup(items: BinItem[] = [], label = '') {
  const onChange = vi.fn<(items: BinItem[]) => void>();
  render(<BinItemsEditor items={items} label={label} onChange={onChange} variant="desktop" />);
  return { onChange, last: () => onChange.mock.calls.at(-1)?.[0] ?? [] };
}

const addField = () => screen.getByLabelText('Add an item');

describe('BinItemsEditor', () => {
  it('offers the bin label as the first item', () => {
    const { last } = setup([], '  M3 screws ');
    fireEvent.click(screen.getByRole('button', { name: 'Add “M3 screws” as an item' }));
    expect(last().map((i) => i.name)).toEqual(['M3 screws']);
  });

  it('stops offering the label once the bin holds something', () => {
    setup([{ id: 'i1', name: 'Nuts' }], 'M3 screws');
    expect(screen.queryByRole('button', { name: /as an item/ })).toBeNull();
  });

  it('adds a typed item on Enter and ignores a blank one', () => {
    const { onChange, last } = setup();
    fireEvent.change(addField(), { target: { value: '   ' } });
    fireEvent.keyDown(addField(), { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(addField(), { target: { value: ' Hex keys ' } });
    fireEvent.keyDown(addField(), { key: 'Enter' });
    expect(last().map((i) => i.name)).toEqual(['Hex keys']);
  });

  it('adds one item per line of a pasted list', () => {
    const { last } = setup([{ id: 'i1', name: 'Nuts' }]);
    fireEvent.paste(addField(), {
      clipboardData: { getData: () => 'Washers\r\n\nSpacers\nM3 screws' },
    });
    expect(last().map((i) => i.name)).toEqual(['Nuts', 'Washers', 'Spacers', 'M3 screws']);
    expect(new Set(last().map((i) => i.id)).size).toBe(4);
  });

  it('renames on blur and removes an item whose name is cleared', () => {
    const { last } = setup([
      { id: 'i1', name: 'Nuts', qty: 3 },
      { id: 'i2', name: 'Bolts' },
    ]);
    const nuts = screen.getByLabelText('Nuts');
    fireEvent.change(nuts, { target: { value: 'M3 nuts' } });
    fireEvent.blur(nuts);
    expect(last()[0]).toEqual({ id: 'i1', name: 'M3 nuts', qty: 3 });

    const bolts = screen.getByLabelText('Bolts');
    fireEvent.change(bolts, { target: { value: '  ' } });
    fireEvent.keyDown(bolts, { key: 'Enter' });
    expect(last().map((i) => i.id)).toEqual(['i1']);
  });

  it('commits a quantity once, on blur or Enter, capped, and clears it', () => {
    const { onChange, last } = setup([{ id: 'i1', name: 'Nuts', qty: 3 }]);
    const qty = screen.getByLabelText('Quantity of Nuts');
    fireEvent.change(qty, { target: { value: '25' } });
    fireEvent.change(qty, { target: { value: '250000' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(qty);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(last()[0].qty).toBe(CONSTRAINTS.ITEM_QTY_MAX);

    fireEvent.change(qty, { target: { value: '' } });
    fireEvent.keyDown(qty, { key: 'Enter' });
    expect(last()[0]).not.toHaveProperty('qty');
  });

  it('leaves an unchanged row alone, and follows a saved change made elsewhere', () => {
    const onChange = vi.fn<(items: BinItem[]) => void>();
    const { rerender } = render(
      <BinItemsEditor
        items={[{ id: 'i1', name: 'Nuts', qty: 3 }]}
        label=""
        onChange={onChange}
        variant="desktop"
      />
    );
    fireEvent.change(screen.getByLabelText('Nuts'), { target: { value: ' Nuts ' } });
    fireEvent.blur(screen.getByLabelText('Nuts'));
    fireEvent.blur(screen.getByLabelText('Quantity of Nuts'));
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <BinItemsEditor
        items={[{ id: 'i1', name: 'Hex nuts', qty: 8 }]}
        label=""
        onChange={onChange}
        variant="desktop"
      />
    );
    expect(screen.getByLabelText('Hex nuts')).toHaveValue('Hex nuts');
    expect(screen.getByLabelText('Quantity of Hex nuts')).toHaveValue(8);
  });

  it('removes an item', () => {
    const { last } = setup([{ id: 'i1', name: 'Nuts' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Nuts' }));
    expect(last()).toEqual([]);
  });

  it('replaces the add field with a note once the bin is full', () => {
    const full = Array.from({ length: CONSTRAINTS.ITEMS_PER_BIN_MAX }, (_, i) => ({
      id: `i${i}`,
      name: `Item ${i}`,
    }));
    setup(full);
    expect(screen.queryByLabelText('Add an item')).toBeNull();
    expect(
      screen.getByText(`This bin holds as many items as it can (${CONSTRAINTS.ITEMS_PER_BIN_MAX}).`)
    ).toBeInTheDocument();
  });
});
