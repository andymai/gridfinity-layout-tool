import type { UserSettings } from '@/core/store/settings';
import type { TFunction } from '@/i18n';

export type UrlProblem = 'invalid' | 'scheme';

export interface UrlTarget {
  url: URL;
  headerName: string;
  headerValue: string;
}

export type SendFailure =
  | { ok: false; reason: 'http'; status: number }
  | { ok: false; reason: 'cors' | 'mixed' | 'network' };

export type SendResult = { ok: true } | SendFailure;

type UrlSettings = Pick<UserSettings, 'exportUrl' | 'exportUrlHeaderName' | 'exportUrlHeaderValue'>;

const HEADER_NAME = /^[\w!#$%&'*+.^`|~-]+$/;
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const UPLOAD_TIMEOUT_MS = 120_000;
const PROBE_TIMEOUT_MS = 10_000;

const FAILURE_KEYS = {
  cors: 'exportDestination.fail.cors',
  mixed: 'exportDestination.fail.mixed',
  network: 'exportDestination.fail.network',
} as const;

export function checkExportUrl(raw: string): UrlProblem | null {
  try {
    const { protocol } = new URL(raw.trim());
    return protocol === 'http:' || protocol === 'https:' ? null : 'scheme';
  } catch {
    return 'invalid';
  }
}

export function isValidHeaderName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed === '' || HEADER_NAME.test(trimmed);
}

/** Browsers refuse http:// requests from an https:// page, except to this machine. */
export function isMixedContent(url: URL): boolean {
  return (
    typeof location !== 'undefined' &&
    location.protocol === 'https:' &&
    url.protocol === 'http:' &&
    !LOOPBACK_HOSTS.includes(url.hostname)
  );
}

export function readUrlTarget(settings: UrlSettings): UrlTarget | null {
  if (checkExportUrl(settings.exportUrl) || !isValidHeaderName(settings.exportUrlHeaderName)) {
    return null;
  }
  return {
    url: new URL(settings.exportUrl.trim()),
    headerName: settings.exportUrlHeaderName.trim(),
    headerValue: settings.exportUrlHeaderValue,
  };
}

export async function sendToUrl(
  blob: Blob,
  fileName: string,
  target: UrlTarget
): Promise<SendResult> {
  const form = new FormData();
  form.append('file', blob, fileName);
  form.append('filename', fileName);
  form.append('format', /\.(\w+)$/.exec(fileName)?.[1].toLowerCase() ?? '');
  form.append('source', 'gridfinity-layout-tool');

  try {
    const response = await fetch(target.url, {
      method: 'POST',
      body: form,
      headers: target.headerName ? { [target.headerName]: target.headerValue } : {},
      credentials: 'omit',
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
    return response.ok ? { ok: true } : { ok: false, reason: 'http', status: response.status };
  } catch {
    if (isMixedContent(target.url)) return { ok: false, reason: 'mixed' };
    // fetch rejects the same way for a refused origin and a dead host. A
    // no-cors request resolves whenever the server answers at all, so it tells
    // the two apart.
    const reachable = await fetch(target.url, {
      mode: 'no-cors',
      credentials: 'omit',
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
    }).then(
      () => true,
      () => false
    );
    return { ok: false, reason: reachable ? 'cors' : 'network' };
  }
}

export function sendFailureMessage(failure: SendFailure, host: string, t: TFunction): string {
  if (failure.reason !== 'http') return t(FAILURE_KEYS[failure.reason], { host });
  const auth = failure.status === 401 || failure.status === 403;
  return t(auth ? 'exportDestination.fail.auth' : 'exportDestination.fail.http', {
    host,
    status: failure.status,
  });
}
