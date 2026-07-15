import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { FETCH_TIMEOUT_MS, useSupportersData } from './useSupportersData';
import { FALLBACK_SUPPORTERS } from '../utils/supportersData';

const jsonResponse = (body: unknown, ok = true) =>
  ({ ok, json: async () => body }) as unknown as Response;

describe('useSupportersData', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('starts on the bundled list before the fetch resolves', () => {
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSupportersData());
    expect(result.current.data).toEqual(FALLBACK_SUPPORTERS);
    expect(result.current.settled).toBe(false);
  });

  it('swaps in the live list', async () => {
    const live = { named: ['Ada'], anonymousCount: 4 };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(live));

    const { result } = renderHook(() => useSupportersData());
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.data).toEqual(live);
  });

  it('keeps the fallback when the request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useSupportersData());
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.data).toEqual(FALLBACK_SUPPORTERS);
  });

  it('keeps the fallback on a non-OK response', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ named: ['Ada'], anonymousCount: 0 }, false));

    const { result } = renderHook(() => useSupportersData());
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.data).toEqual(FALLBACK_SUPPORTERS);
  });

  it('keeps the fallback on a malformed payload', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ nope: true }));

    const { result } = renderHook(() => useSupportersData());
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.data).toEqual(FALLBACK_SUPPORTERS);
  });

  // An unseeded Redis would otherwise wipe the baseplate to nothing.
  it('keeps the fallback when the store is empty', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ named: [], anonymousCount: 0 }));

    const { result } = renderHook(() => useSupportersData());
    await waitFor(() => expect(result.current.settled).toBe(true));
    expect(result.current.data).toEqual(FALLBACK_SUPPORTERS);
  });

  it('settles on the fallback rather than hanging forever', async () => {
    // A fetch that never resolves, aborted by the hook's own timeout.
    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    vi.useFakeTimers();

    const { result } = renderHook(() => useSupportersData());
    expect(result.current.settled).toBe(false);

    // Drive the clock inside act(); waitFor polls on real timers and would
    // deadlock against the fake ones.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FETCH_TIMEOUT_MS + 100);
    });

    expect(result.current.settled).toBe(true);
    expect(result.current.data).toEqual(FALLBACK_SUPPORTERS);
  });
});
