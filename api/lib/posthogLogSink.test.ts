import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitUntil } from '@vercel/functions';
import { sendLogToPostHog } from './posthogLogSink';
import type { LogEntry } from './posthogLogSink';

vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }));

interface SentRecord {
  timeUnixNano: string;
  severityNumber: number;
  severityText: string;
  body: { stringValue: string };
  attributes: { key: string; value: Record<string, unknown> }[];
}

interface SentRequest {
  resourceLogs: {
    resource: { attributes: { key: string; value: Record<string, unknown> }[] };
    scopeLogs: { logRecords: SentRecord[] }[];
  }[];
}

const TIMESTAMP = '2026-11-17T12:00:00.000Z';
const fetchMock = vi.fn<typeof fetch>();

function entry(overrides: Partial<LogEntry> = {}): LogEntry {
  return { level: 'error', message: 'handler failed', timestamp: TIMESTAMP, ...overrides };
}

function sentBody(): string {
  const body = fetchMock.mock.calls[0][1]?.body;
  if (typeof body !== 'string') throw new Error('expected a JSON string body');
  return body;
}

function sentRequest(): SentRequest {
  return JSON.parse(sentBody()) as SentRequest;
}

function sentRecord(): SentRecord {
  return sentRequest().resourceLogs[0].scopeLogs[0].logRecords[0];
}

describe('sendLogToPostHog', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(waitUntil).mockReset();
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VITE_PUBLIC_POSTHOG_KEY', 'phc_test');
    vi.stubEnv('VERCEL_GIT_COMMIT_SHA', 'abc123');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('sends one OTLP record with the level, message, context and commit', () => {
    sendLogToPostHog(
      entry({
        level: 'warn',
        message: 'sync/layouts rejected the payload',
        context: { status: 409, resolved: true, code: 'CONFLICT', stack: undefined },
      })
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://us.i.posthog.com/i/v1/logs');
    expect(init?.headers).toEqual({
      Authorization: 'Bearer phc_test',
      'Content-Type': 'application/json',
    });
    expect(sentRecord()).toEqual({
      timeUnixNano: `${Date.parse(TIMESTAMP)}000000`,
      severityNumber: 13,
      severityText: 'WARN',
      body: { stringValue: 'sync/layouts rejected the payload' },
      attributes: [
        { key: 'status', value: { doubleValue: 409 } },
        { key: 'resolved', value: { boolValue: true } },
        { key: 'code', value: { stringValue: 'CONFLICT' } },
      ],
    });
    expect(sentRequest().resourceLogs[0].resource.attributes).toContainEqual({
      key: 'service.version',
      value: { stringValue: 'abc123' },
    });
    expect(waitUntil).toHaveBeenCalledOnce();
  });

  it('keeps account IDs out of the request', () => {
    sendLogToPostHog(
      entry({
        message: 'read failed for users/acct_42/layouts/a.json',
        context: {
          userId: 'acct_42',
          error: 'blobStore.getJson failed: 403 users/acct_42/designs/b.json',
        },
      })
    );

    expect(sentBody()).not.toContain('acct_42');
    expect(sentRecord().body.stringValue).toBe('read failed for users/[account]/layouts/a.json');
    expect(sentRecord().attributes).toEqual([
      {
        key: 'error',
        value: { stringValue: 'blobStore.getJson failed: 403 users/[account]/designs/b.json' },
      },
      { key: 'dropped_keys', value: { stringValue: 'userId' } },
    ]);
  });

  it('keeps text that users type out of the request', () => {
    sendLogToPostHog(
      entry({
        level: 'warn',
        message: 'Community design reported',
        context: {
          id: 'd1',
          reason: 'spam',
          note: 'mail me at maker@example.com',
          reasonText: 'Jane Doe, jane@example.com',
        },
      })
    );

    expect(sentBody()).not.toContain('@example.com');
    expect(sentBody()).not.toContain('Jane Doe');
    expect(sentRecord().attributes).toEqual([
      { key: 'id', value: { stringValue: 'd1' } },
      { key: 'reason', value: { stringValue: 'spam' } },
      { key: 'dropped_keys', value: { stringValue: 'note,reasonText' } },
    ]);
  });

  it('sends nothing outside production', () => {
    vi.stubEnv('VERCEL_ENV', 'preview');
    sendLogToPostHog(entry());

    expect(fetchMock).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it('sends nothing without a project token', () => {
    vi.stubEnv('VITE_PUBLIC_POSTHOG_KEY', '');
    sendLogToPostHog(entry());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('settles the kept-alive promise when the send fails', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    sendLogToPostHog(entry());

    const kept = vi.mocked(waitUntil).mock.calls[0][0];
    await expect(kept).resolves.toBeUndefined();
  });

  it('sends values without a JSON form as strings', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    sendLogToPostHog(entry({ context: { error: { a: 1 }, indexed: 10n, field: circular } }));

    expect(sentRecord().attributes).toEqual([
      { key: 'error', value: { stringValue: '{"a":1}' } },
      { key: 'indexed', value: { stringValue: '10' } },
      { key: 'field', value: { stringValue: '[object Object]' } },
    ]);
  });
});
