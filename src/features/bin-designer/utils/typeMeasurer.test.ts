import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  areTypeFontsLoaded,
  ensureTypeFonts,
  getTypeMeasurer,
  resetTypeFontsForTest,
  subscribeTypeFonts,
  typeFontsVersion,
} from './typeMeasurer';

/**
 * The registry's contract is about ABSENCE: a preview drawn from a face that
 * has not arrived reports a size and a position no geometry will honour, so
 * every accessor has to answer honestly before the fetch lands.
 */
describe('designer type font registry', () => {
  beforeEach(() => {
    resetTypeFontsForTest();
    vi.restoreAllMocks();
  });

  it('has no measurer before any face registers', () => {
    expect(getTypeMeasurer()).toBeNull();
    expect(areTypeFontsLoaded(['atkinson'])).toBe(false);
  });

  it('treats a partially loaded set as not loaded', () => {
    // The caller asked for two faces; one is not an answer to that question.
    expect(areTypeFontsLoaded(['atkinson', 'poppins'])).toBe(false);
    expect(areTypeFontsLoaded([])).toBe(true);
  });

  it('survives a failed fetch without wedging, so a preview is absent not broken', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline')))
    );
    ensureTypeFonts(['atkinson']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(areTypeFontsLoaded(['atkinson'])).toBe(false);
    expect(getTypeMeasurer()).toBeNull();
  });

  it('retries a family whose fetch failed rather than marking it in flight forever', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchMock);
    ensureTypeFonts(['atkinson']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    // One flaky fetch must not cost the preview for the rest of the session:
    // `loads` tracks what is in flight, not what has been attempted.
    ensureTypeFonts(['atkinson']);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });

  it('notifies subscribers so a preview can redraw when a face lands', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeTypeFonts(listener);
    const before = typeFontsVersion();
    resetTypeFontsForTest();
    expect(listener).toHaveBeenCalled();
    expect(typeFontsVersion()).not.toBe(before);
    unsubscribe();
  });

  it('stops notifying after unsubscribe', () => {
    const listener = vi.fn();
    subscribeTypeFonts(listener)();
    resetTypeFontsForTest();
    expect(listener).not.toHaveBeenCalled();
  });
});
