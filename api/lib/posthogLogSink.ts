import { waitUntil } from '@vercel/functions';

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
}

type OtlpValue = { stringValue: string } | { boolValue: boolean } | { doubleValue: number };

interface OtlpAttribute {
  key: string;
  value: OtlpValue;
}

const LOGS_URL = 'https://us.i.posthog.com/i/v1/logs';
// waitUntil keeps the function alive, and billed, until the send settles.
const SEND_TIMEOUT_MS = 2000;
const SEVERITY_NUMBER: Record<LogLevel, number> = { info: 9, warn: 13, error: 17 };

// The privacy policy keeps account IDs out of PostHog logs. The server cannot
// see a user's analytics switch, so nothing it sends may name an account.
const DROPPED_KEYS = new Set(['userId']);
const ACCOUNT_PATH = /\busers\/[^/\s"'`]+/g;

function redact(text: string): string {
  return text.replace(ACCOUNT_PATH, 'users/[account]');
}

function stringify(value: unknown): string {
  if (typeof value === 'function' || typeof value === 'symbol') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function otlpValue(value: unknown): OtlpValue {
  if (typeof value === 'boolean') return { boolValue: value };
  if (typeof value === 'number' && Number.isFinite(value)) return { doubleValue: value };
  return { stringValue: redact(typeof value === 'string' ? value : stringify(value)) };
}

export function sendLogToPostHog(entry: LogEntry): void {
  const token = process.env.VITE_PUBLIC_POSTHOG_KEY;
  if (process.env.VERCEL_ENV !== 'production' || !token) return;

  const attributes: OtlpAttribute[] = Object.entries(entry.context ?? {})
    .filter(([key, value]) => !DROPPED_KEYS.has(key) && value !== undefined)
    .map(([key, value]) => ({ key, value: otlpValue(value) }));
  const resource: OtlpAttribute[] = [
    { key: 'service.name', value: { stringValue: 'gridfinity-api' } },
  ];
  const commit = process.env.VERCEL_GIT_COMMIT_SHA;
  if (commit) resource.push({ key: 'service.version', value: { stringValue: commit } });

  const body = JSON.stringify({
    resourceLogs: [
      {
        resource: { attributes: resource },
        scopeLogs: [
          {
            logRecords: [
              {
                timeUnixNano: `${Date.parse(entry.timestamp)}000000`,
                severityNumber: SEVERITY_NUMBER[entry.level],
                severityText: entry.level.toUpperCase(),
                body: { stringValue: redact(entry.message) },
                attributes,
              },
            ],
          },
        ],
      },
    ],
  });

  waitUntil(
    fetch(LOGS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body,
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    }).then(
      () => undefined,
      () => undefined
    )
  );
}
