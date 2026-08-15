import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchSupporterStatus,
  isSupporterEditError,
  updateSupporterProfile,
} from './supporterClient';

const apiFetch = vi.fn();
vi.mock('@/core/sync/apiFetch', () => ({
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('fetchSupporterStatus', () => {
  beforeEach(() => {
    // Block body on purpose: a concise arrow returns the mock, and vitest
    // treats a hook's return value as a teardown callback — it would then CALL
    // apiFetch after each test, firing a throwing implementation with nothing
    // awaiting it.
    apiFetch.mockReset();
  });

  it('reads a supporter record', async () => {
    apiFetch.mockResolvedValue(
      jsonResponse(200, {
        supporter: true,
        badgePublic: true,
        name: 'Jo',
        message: 'Nice tool',
        joinedAt: '2026-01-02T03:04:05.000Z',
      })
    );
    await expect(fetchSupporterStatus()).resolves.toEqual({
      supporter: true,
      badgePublic: true,
      name: 'Jo',
      message: 'Nice tool',
      joinedAt: '2026-01-02T03:04:05.000Z',
    });
  });

  it('reads an anonymous supporter as a supporter with no name', async () => {
    apiFetch.mockResolvedValue(
      jsonResponse(200, { supporter: true, badgePublic: false, name: null, message: null })
    );
    const status = await fetchSupporterStatus();
    expect(status).toMatchObject({ supporter: true, name: null, badgePublic: false });
  });

  it('narrows a hostile payload rather than trusting it', async () => {
    apiFetch.mockResolvedValue(
      jsonResponse(200, { supporter: 'yes', name: { toString: 'nope' }, badgePublic: 1 })
    );
    const status = await fetchSupporterStatus();
    expect(status).toEqual({ supporter: false, badgePublic: false, name: null, message: null });
  });

  it.each([
    [
      'a network failure',
      () =>
        apiFetch.mockImplementation(async () => {
          throw new Error('offline');
        }),
    ],
    ['a 500', () => apiFetch.mockResolvedValue(jsonResponse(500, {}))],
    ['a 429', () => apiFetch.mockResolvedValue(jsonResponse(429, {}))],
  ])('degrades to "not a supporter" on %s', async (_label, arrange) => {
    arrange();
    // The page shows the ask rather than an error: a failed status read is not
    // something a visitor can act on.
    await expect(fetchSupporterStatus()).resolves.toMatchObject({ supporter: false });
  });

  it('does not let an expired session flip every tab anonymous', async () => {
    apiFetch.mockResolvedValue(jsonResponse(401, {}));
    await fetchSupporterStatus();
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/supporters/me',
      expect.objectContaining({ suppressForcedSignOut: true })
    );
  });
});

describe('updateSupporterProfile', () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });

  it('returns the server-filtered record, not what was sent', async () => {
    apiFetch.mockResolvedValue(
      jsonResponse(200, { supporter: true, badgePublic: true, name: 'Jo', message: null })
    );
    const result = await updateSupporterProfile({ name: '  Jo  ' });
    expect(isSupporterEditError(result)).toBe(false);
    expect(result).toMatchObject({ name: 'Jo' });
  });

  it("carries the server's rejection reason back to the user", async () => {
    apiFetch.mockResolvedValue(
      jsonResponse(400, { error: "That name can't be shown on the wall.", code: 'CONTENT_BLOCKED' })
    );
    const result = await updateSupporterProfile({ name: 'kys' });
    expect(result).toEqual({ kind: 'blocked', message: "That name can't be shown on the wall." });
  });

  it('still reports blocked when the rejection has no readable body', async () => {
    apiFetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => {
        throw new Error('no body');
      },
    });
    expect(await updateSupporterProfile({ name: 'x' })).toEqual({ kind: 'blocked', message: '' });
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [429, 'rateLimited'],
  ])('maps %i to %s', async (status, kind) => {
    apiFetch.mockResolvedValue(jsonResponse(status, {}));
    expect(await updateSupporterProfile({ name: 'x' })).toEqual({ kind });
  });

  it('reports a network failure as such', async () => {
    apiFetch.mockImplementation(async () => {
      throw new Error('offline');
    });
    expect(await updateSupporterProfile({ name: 'x' })).toEqual({ kind: 'network' });
  });
});
