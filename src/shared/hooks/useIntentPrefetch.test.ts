import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useIntentPrefetch,
  prefetchOnIntent,
  resetIntentPrefetchForTests,
} from './useIntentPrefetch';

function setConnection(value: unknown): void {
  Object.defineProperty(navigator, 'connection', {
    value,
    configurable: true,
    writable: true,
  });
}

describe('useIntentPrefetch', () => {
  let original: unknown;

  beforeEach(() => {
    original = (navigator as unknown as Record<string, unknown>).connection;
    setConnection(undefined);
    resetIntentPrefetchForTests();
  });

  afterEach(() => {
    setConnection(original);
  });

  it.each(['onPointerEnter', 'onPointerDown', 'onFocus'] as const)(
    'warms the destination on %s',
    (handler) => {
      const warm = vi.fn();
      const { result } = renderHook(() => useIntentPrefetch('a', warm));
      result.current[handler]();
      expect(warm).toHaveBeenCalledTimes(1);
    }
  );

  // Hovering across a row of tabs, or hovering the same one repeatedly, must
  // not re-request a chunk the browser is already fetching.
  it('warms a destination at most once per session', () => {
    const warm = vi.fn();
    const { result } = renderHook(() => useIntentPrefetch('a', warm));
    result.current.onPointerEnter();
    result.current.onPointerDown();
    result.current.onFocus();
    expect(warm).toHaveBeenCalledTimes(1);
  });

  it('tracks each destination separately', () => {
    const a = vi.fn();
    const b = vi.fn();
    renderHook(() => useIntentPrefetch('a', a)).result.current.onPointerEnter();
    renderHook(() => useIntentPrefetch('b', b)).result.current.onPointerEnter();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('spends no bandwidth under data-saver', () => {
    setConnection({ saveData: true });
    const warm = vi.fn();
    renderHook(() => useIntentPrefetch('a', warm)).result.current.onPointerEnter();
    expect(warm).not.toHaveBeenCalled();
  });

  // A refused prefetch must stay refused rather than being marked done, so the
  // destination is still warmable once the connection recovers.
  it('retries after a skip once the connection is no longer constrained', () => {
    setConnection({ saveData: true });
    const warm = vi.fn();
    const { result } = renderHook(() => useIntentPrefetch('a', warm));
    result.current.onPointerEnter();
    setConnection(undefined);
    result.current.onPointerEnter();
    expect(warm).toHaveBeenCalledTimes(1);
  });

  // Handler identity is stable across renders (call sites pass inline arrows),
  // so the ref has to be what carries the current closure.
  it('calls the latest warm function after a re-render', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { result, rerender } = renderHook(({ warm }) => useIntentPrefetch('a', warm), {
      initialProps: { warm: first },
    });
    rerender({ warm: second });
    result.current.onPointerEnter();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('keeps a throwing warm function from reaching the click handler', () => {
    expect(() =>
      prefetchOnIntent('a', () => {
        throw new Error('chunk server down');
      })
    ).not.toThrow();
  });

  it('swallows a rejected async warm rather than leaving it unhandled', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    prefetchOnIntent('a', () => Promise.reject(new Error('chunk 404')));
    await new Promise((r) => setTimeout(r, 0));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  // The one-shot mark means a session gets one attempt per destination, so
  // spending it on a failure would leave that route cold for good.
  it.each([
    [
      'throws',
      () => {
        throw new Error('chunk server down');
      },
    ],
    ['rejects', () => Promise.reject(new Error('chunk 404'))],
  ])('releases the destination when the warm %s', async (_label, failing) => {
    prefetchOnIntent('a', failing);
    await new Promise((r) => setTimeout(r, 0));
    const retry = vi.fn();
    prefetchOnIntent('a', retry);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keeps the mark when the warm starts cleanly', async () => {
    prefetchOnIntent('a', () => Promise.resolve());
    await new Promise((r) => setTimeout(r, 0));
    const retry = vi.fn();
    prefetchOnIntent('a', retry);
    expect(retry).not.toHaveBeenCalled();
  });
});
