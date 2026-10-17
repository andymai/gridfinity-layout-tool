import { describe, expect, it } from 'vitest';

import { sanitizeBinItems } from './binItemsValidation.js';

describe('sanitizeBinItems', () => {
  it('keeps well-formed items in order', () => {
    const items = [
      { id: 'i1', name: 'M3 screws', qty: 40, note: '8 mm' },
      { id: 'i2', name: 'Washers' },
    ];
    expect(sanitizeBinItems(items)).toEqual(items);
  });

  it('is absent for a non-array or an array with nothing usable', () => {
    expect(sanitizeBinItems(undefined)).toBeUndefined();
    expect(sanitizeBinItems({ id: 'i1', name: 'x' })).toBeUndefined();
    expect(sanitizeBinItems([{ id: 'i1', name: '   ' }, 'screws'])).toBeUndefined();
  });

  it('drops each malformed item alone', () => {
    expect(
      sanitizeBinItems([
        { id: '', name: 'No id' },
        { id: 'x'.repeat(65), name: 'Long id' },
        { name: 'Missing id' },
        { id: 'i1', name: 42 },
        { id: 'i2', name: 'Kept' },
      ])
    ).toEqual([{ id: 'i2', name: 'Kept' }]);
  });

  it('drops a malformed quantity or note and keeps the item', () => {
    expect(
      sanitizeBinItems([
        { id: 'a', name: 'Half', qty: 1.5 },
        { id: 'b', name: 'Negative', qty: -1 },
        { id: 'c', name: 'Huge', qty: 100_000 },
        { id: 'd', name: 'Blank note', note: '  ' },
        { id: 'e', name: 'Odd note', note: 7 },
      ])
    ).toEqual([
      { id: 'a', name: 'Half' },
      { id: 'b', name: 'Negative' },
      { id: 'c', name: 'Huge' },
      { id: 'd', name: 'Blank note' },
      { id: 'e', name: 'Odd note' },
    ]);
  });

  it('trims and truncates names and notes, and strips control characters', () => {
    const [item] =
      sanitizeBinItems([{ id: 'a', name: `  ${'n'.repeat(60)}\u0000`, note: 'x'.repeat(200) }]) ??
      [];
    expect(item.name).toHaveLength(48);
    expect(item.note).toHaveLength(120);
  });

  it('keeps the first of two items sharing an id', () => {
    expect(
      sanitizeBinItems([
        { id: 'a', name: 'First' },
        { id: 'a', name: 'Second' },
      ])
    ).toEqual([{ id: 'a', name: 'First' }]);
  });

  it('caps a bin at a hundred items', () => {
    const many = Array.from({ length: 120 }, (_, i) => ({ id: `i${i}`, name: `Item ${i}` }));
    expect(sanitizeBinItems(many)).toHaveLength(100);
  });

  it('drops keys an item does not define', () => {
    expect(sanitizeBinItems([{ id: 'a', name: 'A', photo: 'blob:x' }])).toEqual([
      { id: 'a', name: 'A' },
    ]);
  });
});
