// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { probeCommunityDesign } from './communityClient';
import { FORCED_SIGN_OUT_EVENT } from '@/core/sync/apiFetch';
import { expectOk, expectErr } from '@/test/testUtils';

describe('probeCommunityDesign', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns live for a 200 response', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"design":{}}', { status: 200 }));
    expect(expectOk(await probeCommunityDesign('AbCdEf123456'))).toBe('live');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/community/AbCdEf123456');
  });

  it('returns missing for a 404 response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(expectOk(await probeCommunityDesign('AbCdEf123456'))).toBe('missing');
  });

  it('returns an error (not missing) for a 5xx response', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    expectErr(await probeCommunityDesign('AbCdEf123456'));
  });

  it('returns an error (not missing) when fetch throws', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('network down'));
    expectErr(await probeCommunityDesign('AbCdEf123456'));
  });

  it('does not trigger forced sign-out on a 401', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 401 }));
    const handler = vi.fn();
    window.addEventListener(FORCED_SIGN_OUT_EVENT, handler);
    expectErr(await probeCommunityDesign('AbCdEf123456'));
    expect(handler).not.toHaveBeenCalled();
    window.removeEventListener(FORCED_SIGN_OUT_EVENT, handler);
  });

  it('URL-encodes the id', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    await probeCommunityDesign('a/b c');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/community/a%2Fb%20c');
  });
});
