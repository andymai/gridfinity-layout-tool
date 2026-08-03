import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isErr, isOk } from '@/core/result';
import { deletePrint, fetchPrints, reportPrint, savePrint } from './printsClient';
import type { CommunityPrintInput } from './printsClient';

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock('@/core/sync/apiFetch', () => ({ apiFetch }));

const PRINT = {
  id: 'abc123def456:aaa',
  designId: 'abc123def456',
  authorPublicId: 'a'.repeat(32),
  authorName: 'Casey',
  photos: [],
  settings: {
    material: 'pla',
    nozzleMm: 0.4,
    layerHeightMm: 0.2,
    printMinutes: 120,
    printer: 'bambu-p1s',
  },
  fitVerdict: 'as-designed',
  note: '',
  createdAt: 1,
  updatedAt: 1,
  status: 'live',
};

const INPUT: CommunityPrintInput = {
  authorName: 'Casey',
  material: 'pla',
  nozzleMm: 0.4,
  layerHeightMm: 0.2,
  printMinutes: 120,
  filamentGrams: null,
  printer: 'bambu-p1s',
  fitVerdict: 'as-designed',
  note: '',
  photos: [],
};

function respond(status: number, body: unknown): void {
  apiFetch.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchPrints', () => {
  it('requests the design and parses a page', async () => {
    respond(200, { items: [PRINT], nextCursor: null, summary: { count: 1 }, mine: PRINT });

    const result = await fetchPrints('abc123def456');

    expect(isOk(result)).toBe(true);
    if (!isOk(result)) return;
    expect(result.value.items).toHaveLength(1);
    expect(result.value.mine).not.toBeNull();
    const [url] = apiFetch.mock.calls[0] as [string];
    expect(url).toBe('/api/community/prints?design=abc123def456');
  });

  it('passes a cursor through', async () => {
    respond(200, { items: [], nextCursor: null, summary: null, mine: null });
    await fetchPrints('abc123def456', '24');
    const [url] = apiFetch.mock.calls[0] as [string];
    expect(url).toContain('cursor=24');
  });

  it('suppresses the app-wide forced sign-out', async () => {
    respond(200, { items: [], nextCursor: null, summary: null, mine: null });
    await fetchPrints('abc123def456');
    // A community 401 is handled locally; the global event would flip every
    // tab anonymous and clear the sync outbox.
    const [, init] = apiFetch.mock.calls[0] as [string, { suppressForcedSignOut?: boolean }];
    expect(init.suppressForcedSignOut).toBe(true);
  });

  it('rejects a malformed page rather than trusting it', async () => {
    respond(200, { items: [{ nope: true }], nextCursor: null, summary: null, mine: null });
    const result = await fetchPrints('abc123def456');
    expect(isErr(result) && result.error.kind).toBe('server');
  });
});

describe('savePrint', () => {
  it('PUTs the input and returns the record with the new count', async () => {
    respond(201, { print: PRINT, count: 3 });

    const result = await savePrint('abc123def456', INPUT);

    expect(isOk(result) && result.value.count).toBe(3);
    const [url, init] = apiFetch.mock.calls[0] as [string, { method: string; body: string }];
    expect(url).toBe('/api/community/prints?design=abc123def456');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(init.body)).toMatchObject({ printer: 'bambu-p1s' });
  });

  it.each([
    [401, 'needsAuth'],
    [403, 'forbidden'],
    [404, 'notFound'],
    [429, 'rateLimited'],
    [503, 'disabled'],
    [500, 'server'],
  ])('maps %s to %s', async (status, kind) => {
    respond(status, { error: 'no', code: 'X' });
    const result = await savePrint('abc123def456', INPUT);
    expect(isErr(result) && result.error.kind).toBe(kind);
  });

  it('routes a blocked note through the content-filter channel', async () => {
    respond(400, { error: 'nope', code: 'CONTENT_BLOCKED' });
    const result = await savePrint('abc123def456', INPUT);
    expect(isErr(result) && result.error.kind).toBe('contentBlocked');
  });

  it('surfaces a validation code the dialog can branch on', async () => {
    respond(400, { error: 'bad', code: 'INVALID_PHOTOS' });
    const result = await savePrint('abc123def456', INPUT);
    expect(isErr(result) && result.error.kind === 'validation' && result.error.code).toBe(
      'INVALID_PHOTOS'
    );
  });

  it('maps a thrown fetch to a network error', async () => {
    apiFetch.mockRejectedValue(new Error('offline'));
    const result = await savePrint('abc123def456', INPUT);
    expect(isErr(result) && result.error.kind).toBe('network');
  });
});

describe('deletePrint', () => {
  it('DELETEs and returns the remaining count', async () => {
    respond(200, { deleted: true, count: 0 });
    const result = await deletePrint('abc123def456');
    expect(isOk(result) && result.value.count).toBe(0);
    const [, init] = apiFetch.mock.calls[0] as [string, { method: string }];
    expect(init.method).toBe('DELETE');
  });
});

describe('reportPrint', () => {
  it('POSTs the report action with the target printer', async () => {
    respond(200, { reported: true, hidden: false });

    const result = await reportPrint('abc123def456', 'b'.repeat(32), 'spam', 'note');

    expect(isOk(result) && result.value.hidden).toBe(false);
    const [, init] = apiFetch.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({
      action: 'report',
      printer: 'b'.repeat(32),
      reason: 'spam',
      note: 'note',
    });
  });

  it('reports when the threshold hid the print', async () => {
    respond(200, { reported: true, hidden: true });
    const result = await reportPrint('abc123def456', 'b'.repeat(32), 'inappropriate', '');
    expect(isOk(result) && result.value.hidden).toBe(true);
  });
});
