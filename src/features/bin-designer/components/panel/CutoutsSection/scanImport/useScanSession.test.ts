import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScanSession } from './useScanSession';

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};

describe('useScanSession', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('creates a session and exposes its URL while waiting', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, { token: 't', url: '/scan/t' }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useScanSession(true, vi.fn()));
    await flush();

    expect(result.current.phase).toBe('waiting');
    expect(result.current.url).toBe('/scan/t');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/scan-session',
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('hands the uploaded SVG to onSvg once polling sees it ready', async () => {
    const onSvg = vi.fn();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, { token: 't', url: '/scan/t' }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'pending' }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'ready', svg: '<svg/>' }));
    vi.stubGlobal('fetch', fetchMock);

    renderHook(() => useScanSession(true, onSvg));
    await flush();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(onSvg).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(onSvg).toHaveBeenCalledWith('<svg/>');
  });

  it('falls back to unavailable when the session cannot be created', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(503, { error: 'nope' })));

    const { result } = renderHook(() => useScanSession(true, vi.fn()));
    await flush();

    expect(result.current.phase).toBe('unavailable');
  });

  it('marks the session expired when polling 404s', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(201, { token: 't', url: '/scan/t' }))
      .mockResolvedValueOnce(jsonResponse(404, { error: 'expired' }));
    vi.stubGlobal('fetch', fetchMock);

    const { result } = renderHook(() => useScanSession(true, vi.fn()));
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });

    expect(result.current.phase).toBe('expired');
  });

  it('does nothing while inactive', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderHook(() => useScanSession(false, vi.fn()));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
