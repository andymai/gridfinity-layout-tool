import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isPulledCopy,
  noteOpenLayoutSaved,
  noteOpenLayoutWrite,
  notePulledCopy,
  readOpenLayout,
  savedLaterCopy,
} from './openLayoutSaves';
import { useLayoutStore } from './layout';
import { createDefaultLayout } from '@/core/constants';
import { resetAllStores } from '@/test/testUtils';
import { layoutId } from '@/core/types';
import type { Layout } from '@/core/types';

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

  describe('a pulled copy', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    function readAt(id: string, time: number): ReturnType<typeof readOpenLayout> {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(time);
      open(id);
      return readOpenLayout();
    }

    it('counts against an earlier read when its modifiedAt is newer', () => {
      const read = readAt('pull-newer', 1_000);
      notePulledCopy('pull-newer', 2_000);

      expect(savedLaterCopy(read)).toBe(true);
    });

    it('does not count when its modifiedAt is older or equal, as in sync', () => {
      const older = readAt('pull-older', 1_000);
      notePulledCopy('pull-older', 999);
      const equal = readAt('pull-equal', 1_000);
      notePulledCopy('pull-equal', 1_000);

      expect(savedLaterCopy(older)).toBe(false);
      expect(savedLaterCopy(equal)).toBe(false);
    });

    it('does not count against a read made after it landed', () => {
      readAt('pull-first', 1_000);
      notePulledCopy('pull-first', 5_000);
      const after = readOpenLayout();

      expect(savedLaterCopy(after)).toBe(false);
    });
  });

  describe('the open layout a pull put in the store', () => {
    function pullInto(id: string): Layout {
      open(id);
      const pulled = createDefaultLayout();
      useLayoutStore.getState().importLayout(pulled, layoutId(id), 'remote');
      const inStore = useLayoutStore.getState().layout;
      notePulledCopy(id, 1_000, inStore);
      return inStore;
    }

    it('is the pulled copy until it is edited', () => {
      pullInto('pulled');
      expect(isPulledCopy(readOpenLayout())).toBe(true);

      useLayoutStore.getState().setName('edited');
      expect(isPulledCopy(readOpenLayout())).toBe(false);
    });

    it('is not the pulled copy once a write of another copy starts, even if the store returns to it', () => {
      const pulled = pullInto('undone');
      useLayoutStore.getState().setName('edited');
      noteOpenLayoutWrite(readOpenLayout());

      useLayoutStore.getState().importLayout(pulled, layoutId('undone'), 'local');
      expect(isPulledCopy(readOpenLayout())).toBe(false);
    });

    it('does not count a pull that did not reach the store, or another layout', () => {
      open('closed');
      notePulledCopy('closed', 1_000);
      expect(isPulledCopy(readOpenLayout())).toBe(false);

      pullInto('first');
      open('second');
      expect(isPulledCopy(readOpenLayout())).toBe(false);
    });
  });
});
