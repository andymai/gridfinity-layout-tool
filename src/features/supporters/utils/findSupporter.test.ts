import { describe, expect, it } from 'vitest';
import { findSupporter } from './findSupporter';
import type { SupporterBin } from './supportersData';

const bin = (id: string, name: string | null): SupporterBin => ({ id, name, isNewest: false });
const bins = [
  bin('1', 'Max'),
  bin('2', 'Maxine'),
  bin('3', 'max'),
  bin('4', null),
  bin('5', 'Ada'),
];

describe('findSupporter', () => {
  it('prefers an exact name, ignoring case, and counts the namesakes', () => {
    expect(findSupporter(bins, 'MAX')).toMatchObject({ exactMatches: 2 });
    expect(findSupporter(bins, 'MAX')?.bin.name.toLowerCase()).toBe('max');
  });

  it('falls back to the shortest name containing the query', () => {
    expect(findSupporter(bins, 'axi')?.bin.id).toBe('2');
    expect(findSupporter(bins, 'd')?.bin.id).toBe('5');
  });

  it('finds nothing for a blank query or an unknown name', () => {
    expect(findSupporter(bins, '   ')).toBeNull();
    expect(findSupporter(bins, 'Zed')).toBeNull();
  });
});
