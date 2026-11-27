// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  hideYearReviewRow,
  markYearReviewSeen,
  readDockRowState,
  rememberYearWork,
  resetDockRowCache,
  subscribeDockRow,
} from './dockRow';

describe('dockRow', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDockRowCache();
  });

  afterEach(() => vi.restoreAllMocks());

  it('starts unseen, shown and unchecked', () => {
    expect(readDockRowState()).toEqual({ seen: false, hidden: false, hasWork: false });
  });

  it('keeps each change across a reload', () => {
    markYearReviewSeen();
    hideYearReviewRow();
    rememberYearWork();
    resetDockRowCache();
    expect(readDockRowState()).toEqual({ seen: true, hidden: true, hasWork: true });
  });

  it('tells listeners about a change', () => {
    const listener = vi.fn();
    const stop = subscribeDockRow(listener);
    markYearReviewSeen();
    markYearReviewSeen();
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    hideYearReviewRow();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('reads garbage in storage as a fresh start', () => {
    localStorage.setItem('gridfinity-year-review-2026', '{not json');
    expect(readDockRowState()).toEqual({ seen: false, hidden: false, hasWork: false });
  });

  it('still hides for the session when storage refuses writes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    hideYearReviewRow();
    expect(readDockRowState().hidden).toBe(true);
  });

  it('picks up a hide from another tab after every dock unmounted', () => {
    subscribeDockRow(() => undefined)();
    expect(readDockRowState().hidden).toBe(false);
    otherTabWrites({ seen: false, hidden: true, hasWork: true });
    expect(readDockRowState().hidden).toBe(true);
  });

  it('keeps another tab’s hide when this tab writes next', () => {
    expect(readDockRowState().hidden).toBe(false);
    localStorage.setItem(KEY, JSON.stringify({ seen: false, hidden: true, hasWork: false }));
    markYearReviewSeen();
    expect(JSON.parse(localStorage.getItem(KEY) ?? '{}')).toMatchObject({
      seen: true,
      hidden: true,
    });
  });

  it('keeps a change storage refused when another tab writes', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });
    hideYearReviewRow();
    setItem.mockRestore();
    otherTabWrites({ seen: true, hidden: false, hasWork: false });
    expect(readDockRowState()).toMatchObject({ seen: true, hidden: true });
  });
});

const KEY = 'gridfinity-year-review-2026';

function otherTabWrites(state: Record<string, boolean>): void {
  localStorage.setItem(KEY, JSON.stringify(state));
  window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
}
