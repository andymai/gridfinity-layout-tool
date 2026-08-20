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
 *
 * Every load here is awaited through `vi.waitFor`, never through a fixed number
 * of ticks. `loadFamily` awaits `import('brepjs/text')` BEFORE it reaches
 * `fetch`, and a dynamic import is not bounded by macrotask count: on a loaded
 * machine it can still be pending after several. A `setTimeout(0)` budget read
 * a `fetch` that had not happened yet and failed about 1 run in 3 in a full
 * suite while passing every time in isolation. Polling the observable condition
 * also keeps a load from outliving the test that started it, since
 * `resetTypeFontsForTest` can clear the registry but cannot cancel a promise.
 *
 * `WAIT` overrides `vi.waitFor`'s 1s default for the same reason. That budget is
 * generous for an import and stingy for a contended one, and the run that
 * exposed this reported 155s of aggregate import time across its workers. The
 * project's own `testTimeout` is 30s, so a wait that gives up at 1s is the
 * tighter bound and would just be the original bug with a longer fuse.
 */
const WAIT = { timeout: 15_000 } as const;

describe('designer type font registry', () => {
  beforeEach(() => {
    resetTypeFontsForTest();
    vi.restoreAllMocks();
    // `restoreAllMocks` does not undo `stubGlobal`, and neither the config nor
    // the shared setup enables `unstubGlobals`, so a rejecting `fetch` would
    // otherwise outlive the test that installed it.
    vi.unstubAllGlobals();
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
    const fetchMock = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchMock);
    ensureTypeFonts(['atkinson']);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled(), WAIT);
    expect(areTypeFontsLoaded(['atkinson'])).toBe(false);
    expect(getTypeMeasurer()).toBeNull();
  });

  it('retries a family whose fetch failed rather than marking it in flight forever', async () => {
    const fetchMock = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetchMock);
    ensureTypeFonts(['atkinson']);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1), WAIT);
    // One flaky fetch must not cost the preview for the rest of the session:
    // `loads` tracks what is in flight, not what has been attempted. The clear
    // happens in `loadFamily`'s `finally`, so ask the way a re-render does
    // (`ensureTypeFonts` is documented safe to call every render) rather than
    // assuming a single retry lands after the rejection has settled. If the
    // family were ever left marked in flight, this polls until it times out,
    // which is the regression the test exists to catch.
    await vi.waitFor(() => {
      ensureTypeFonts(['atkinson']);
      expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    }, WAIT);
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
