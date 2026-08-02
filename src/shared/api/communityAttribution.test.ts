// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCommunityClientId, recordCommunityExport } from '@/shared/api/communityAttribution';
import { apiFetch } from '@/core/sync/apiFetch';

vi.mock('@/core/sync/apiFetch', () => ({
  apiFetch: vi.fn(),
}));

const mockApiFetch = vi.mocked(apiFetch);

const CLIENT_ID_KEY = 'gridfinity-community-client-id';

describe('getCommunityClientId', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists a stable id in localStorage', () => {
    const first = getCommunityClientId();
    expect(localStorage.getItem(CLIENT_ID_KEY)).toBe(first);
    expect(getCommunityClientId()).toBe(first);
  });

  it('matches the server-side clientId pattern', () => {
    expect(getCommunityClientId()).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
  });

  it('reuses a valid pre-existing stored id', () => {
    localStorage.setItem(CLIENT_ID_KEY, 'valid_preexisting-id');
    expect(getCommunityClientId()).toBe('valid_preexisting-id');
  });

  it('regenerates a stored id that fails the server pattern', () => {
    localStorage.setItem(CLIENT_ID_KEY, 'too short!');
    const id = getCommunityClientId();
    expect(id).not.toBe('too short!');
    expect(id).toMatch(/^[A-Za-z0-9_-]{16,64}$/);
    expect(localStorage.getItem(CLIENT_ID_KEY)).toBe(id);
  });
});

describe('recordCommunityExport', () => {
  beforeEach(() => {
    localStorage.clear();
    mockApiFetch.mockReset();
    mockApiFetch.mockResolvedValue(new Response('{}', { status: 200 }));
  });

  it('posts the export action with the persisted client id', async () => {
    await recordCommunityExport('parent-design-id');

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockApiFetch.mock.calls[0];
    expect(url).toBe('/api/community/parent-design-id');
    expect(init?.method).toBe('POST');
    expect(init?.suppressForcedSignOut).toBe(true);
    const body: unknown = JSON.parse(init?.body as string);
    expect(body).toEqual({
      action: 'export',
      clientId: localStorage.getItem(CLIENT_ID_KEY),
    });
  });

  it('sends the same client id across calls', async () => {
    await recordCommunityExport('design-a');
    await recordCommunityExport('design-b');

    const firstBody: unknown = JSON.parse(mockApiFetch.mock.calls[0][1]?.body as string);
    const secondBody: unknown = JSON.parse(mockApiFetch.mock.calls[1][1]?.body as string);
    expect((firstBody as { clientId: string }).clientId).toBe(
      (secondBody as { clientId: string }).clientId
    );
  });

  it('swallows network failures', async () => {
    mockApiFetch.mockRejectedValue(new Error('offline'));
    await expect(recordCommunityExport('parent-design-id')).resolves.toBeUndefined();
  });

  it('swallows error responses', async () => {
    mockApiFetch.mockResolvedValue(new Response('{}', { status: 404 }));
    await expect(recordCommunityExport('deleted-parent')).resolves.toBeUndefined();
  });
});
