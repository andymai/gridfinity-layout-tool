import { describe, expect, it } from 'vitest';
import { offeredKinds } from './folderKinds';

describe('offeredKinds', () => {
  it('offers the other kinds, and a place only at the top of the tree', () => {
    expect(offeredKinds('area', true)).toEqual(['place', 'unit']);
    expect(offeredKinds('area', false)).toEqual(['unit']);
    expect(offeredKinds('place', true)).toEqual(['area', 'unit']);
    expect(offeredKinds('unit', false)).toEqual(['area']);
  });
});
