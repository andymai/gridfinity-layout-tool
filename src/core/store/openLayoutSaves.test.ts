import { describe, it, expect, beforeEach } from 'vitest';
import { noteOpenLayoutSaved, readOpenLayout, savedLaterCopy } from './openLayoutSaves';
import { useLayoutStore } from './layout';
import { createDefaultLayout } from '@/core/constants';
import { resetAllStores } from '@/test/testUtils';
import { layoutId } from '@/core/types';

function open(id: string): void {
  useLayoutStore.getState().importLayout(createDefaultLayout(), layoutId(id), 'init');
}

describe('open layout saves', () => {
  beforeEach(() => {
    resetAllStores();
  });

  it('orders two reads of the open layout', () => {
    open('first');
    const earlier = readOpenLayout();
    const later = readOpenLayout();

    expect(earlier.id).toBe('first');
    expect(later.readAt).toBeGreaterThan(earlier.readAt);
  });

  it('tells a read that a later copy of its layout is saved', () => {
    open('later-copy');
    const earlier = readOpenLayout();
    const later = readOpenLayout();

    noteOpenLayoutSaved(later);

    expect(savedLaterCopy(earlier)).toBe(true);
    expect(savedLaterCopy(later)).toBe(false);
  });

  it('does not count an earlier copy, or a copy of another layout', () => {
    open('kept');
    const earlier = readOpenLayout();
    const read = readOpenLayout();
    noteOpenLayoutSaved(earlier);
    open('other');
    noteOpenLayoutSaved(readOpenLayout());

    expect(savedLaterCopy(read)).toBe(false);
  });
});
