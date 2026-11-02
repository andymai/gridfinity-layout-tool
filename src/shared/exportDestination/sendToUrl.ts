import type { UserSettings } from '@/core/store/settings';
import { err, OK } from '@/core/result';
import type { Result } from '@/core/result';
import type { TFunction } from '@/i18n';

export type UrlProblem = 'invalid' | 'scheme';

export interface UrlTarget {
  url: URL;
  headerName: string;
  headerValue: string;
}

export type SendFailure =
  | { reason: 'http'; status: number }
  | { reason: 'cors' | 'mixed' | 'network' | 'timeout' | 'redirect' };

type UrlSettings = Pick<UserSettings, 'exportUrl' | 'exportUrlHeaderName' | 'exportUrlHeaderValue'>;

const HEADER_NAME = /^[\w!#$%&'*+.^`|~-]+$/;
// fetch throws before sending a header value outside printable ISO-8859-1.
const HEADER_VALUE = /^[\x20-\x7e\xa0-\xff]*$/;
const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const UPLOAD_TIMEOUT_MS = 120_000;
const PROBE_TIMEOUT_MS = 10_000;

const FAILURE_KEYS = {
  cors: 'exportDestination.fail.cors',
  mixed: 'exportDestination.fail.mixed',
  network: 'exportDestination.fail.network',
  timeout: 'exportDestination.fail.timeout',
  redirect: 'exportDestination.fail.redirect',
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

export function isValidHeaderValue(value: string): boolean {
  return HEADER_VALUE.test(value);
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
  if (
    checkExportUrl(settings.exportUrl) ||
    !isValidHeaderName(settings.exportUrlHeaderName) ||
    !isValidHeaderValue(settings.exportUrlHeaderValue)
  ) {
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
): Promise<Result<void, SendFailure>> {
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
      // A followed 301 or 302 turns the POST into a GET without the file.
      redirect: 'manual',
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
    if (response.type === 'opaqueredirect') return err({ reason: 'redirect' });
    return response.ok ? OK : err({ reason: 'http', status: response.status });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return err({ reason: 'timeout' });
    }
    if (isMixedContent(target.url)) return err({ reason: 'mixed' });
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
    return err({ reason: reachable ? 'cors' : 'network' });
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
