import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchNameSuggestions } from './suggestName';
import { expectOk, expectErr } from '@/test/testUtils';

describe('fetchNameSuggestions', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const validRequest = {
    labels: ['screwdriver', 'pliers'],
    drawerSize: { w: 4, d: 2, h: 6 },
    locale: 'en',
  };

  it('returns Ok with suggestions on success', async () => {
    const mockResponse = {
      suggestions: [
        { name: 'Tool Drawer', source: 'server_ml' },
        { name: 'Workshop Kit', source: 'server_ml' },
      ],
      cached: false,
    };

    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const result = await fetchNameSuggestions(validRequest);
    const value = expectOk(result);
    expect(value.suggestions).toHaveLength(2);
    expect(value.cached).toBe(false);
  });

  it('returns Ok for cached response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          suggestions: [{ name: 'Cached Name', source: 'server_ml' }],
          cached: true,
        }),
    } as Response);

    const result = await fetchNameSuggestions(validRequest);
    const value = expectOk(result);
    expect(value.cached).toBe(true);
  });

  it('maps RATE_LIMITED to ApiRateLimitedError', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Too many requests',
          code: 'RATE_LIMITED',
          retryAfter: 3600,
        }),
    } as Response);

    const result = await fetchNameSuggestions(validRequest);
    const error = expectErr(result);
    expect(error.code).toBe('API_RATE_LIMITED');
    if ('retryAfter' in error) {
      expect(error.retryAfter).toBe(3600);
    }
  });

  it('maps SERVICE_UNAVAILABLE to ApiServerError', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'LLM provider unavailable',
          code: 'SERVICE_UNAVAILABLE',
        }),
    } as Response);

    const result = await fetchNameSuggestions(validRequest);
    expect(expectErr(result).code).toBe('API_SERVER_ERROR');
  });

  it('returns ApiServerError for invalid response structure', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ invalid: true }),
    } as Response);

    const result = await fetchNameSuggestions(validRequest);
    expect(expectErr(result).code).toBe('API_SERVER_ERROR');
  });

  it('returns ApiNetworkError on fetch failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

    const result = await fetchNameSuggestions(validRequest);
    expect(expectErr(result).code).toBe('API_NETWORK_ERROR');
  });

  it('returns ApiTimeoutError on abort', async () => {
    const abortError = new Error('AbortError');
    abortError.name = 'AbortError';
    vi.mocked(fetch).mockRejectedValueOnce(abortError);

    const result = await fetchNameSuggestions(validRequest);
    expect(expectErr(result).code).toBe('API_TIMEOUT');
  });

  it('returns ApiServerError for unknown error codes', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      json: () =>
        Promise.resolve({
          error: 'Something weird',
          code: 'TOTALLY_UNKNOWN_CODE',
        }),
    } as Response);

    const result = await fetchNameSuggestions(validRequest);
    expect(expectErr(result).code).toBe('API_SERVER_ERROR');
  });
});
