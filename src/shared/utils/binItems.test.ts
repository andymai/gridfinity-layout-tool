import { describe, expect, it } from 'vitest';
import { CONSTRAINTS } from '@/core/constants';
import type { BinItem } from '@/core/types';
import { mergeBinItems, sanitizeBinItems, withSanitizedItems } from './binItems';

describe('sanitizeBinItems', () => {
  it('keeps well-formed items as they are', () => {
    const items = [
      { id: 'i1', name: 'M3 screws', qty: 40, note: '8 mm' },
      { id: 'i2', name: 'Washers' },
    ];
    expect(sanitizeBinItems(items)).toEqual(items);
  });

  it('drops each malformed item alone and a malformed qty or note from a kept one', () => {
    expect(
      sanitizeBinItems([
        { id: '', name: 'No id' },
        { id: 'a', name: '  ' },
        'screws',
        { id: 'b', name: 'Kept', qty: 2.5, note: 9 },
      ])
    ).toEqual([{ id: 'b', name: 'Kept' }]);
  });

  it('trims and caps names and notes, and keeps the first of two shared ids', () => {
    const [item, ...rest] =
      sanitizeBinItems([
        { id: 'a', name: ` ${'n'.repeat(80)} `, note: 'x'.repeat(200) },
        { id: 'a', name: 'Second' },
      ]) ?? [];
    expect(rest).toEqual([]);
    expect(item.name).toHaveLength(CONSTRAINTS.ITEM_NAME_MAX_LENGTH);
    expect(item.note).toHaveLength(CONSTRAINTS.ITEM_NOTE_MAX_LENGTH);
  });

  it('caps a bin at the per-bin maximum', () => {
    const many = Array.from({ length: CONSTRAINTS.ITEMS_PER_BIN_MAX + 5 }, (_, i) => ({
      id: `i${i}`,
      name: `Item ${i}`,
    }));
    expect(sanitizeBinItems(many)).toHaveLength(CONSTRAINTS.ITEMS_PER_BIN_MAX);
  });

  it('is absent when nothing survives', () => {
    expect(sanitizeBinItems([])).toBeUndefined();
    expect(sanitizeBinItems('screws')).toBeUndefined();
  });
});

describe('withSanitizedItems', () => {
  it('leaves a bin without an items key untouched', () => {
    const bin = { id: 'b', label: 'x' };
    expect(withSanitizedItems(bin)).toBe(bin);
  });

  it('removes the key when no item survives', () => {
    expect(withSanitizedItems({ id: 'b', items: [{ id: '' }] })).toEqual({ id: 'b' });
  });
});

describe('mergeBinItems', () => {
  const item = (id: string, name: string): BinItem => ({ id, name });

  it('keeps everything the sources held, in order', () => {
    expect(
      mergeBinItems([{ items: [item('a', 'Screws')] }, {}, { items: [item('b', 'Nuts')] }])
    ).toEqual([item('a', 'Screws'), item('b', 'Nuts')]);
  });

  it('gives a clashing id a fresh one and keeps the item', () => {
    const merged = mergeBinItems([
      { items: [item('a', 'Screws')] },
      { items: [item('a', 'Nuts')] },
    ]);
    expect(merged?.map((i) => i.name)).toEqual(['Screws', 'Nuts']);
    expect(new Set(merged?.map((i) => i.id)).size).toBe(2);
  });

  it('is absent when no source held anything', () => {
    expect(mergeBinItems([{}, { items: [] }])).toBeUndefined();
  });
});
