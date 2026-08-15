import { apiFetch } from '@/core/sync/apiFetch';

/** The caller's own supporter record, as served by `GET /api/supporters/me`. */
export interface SupporterStatus {
  supporter: boolean;
  badgePublic: boolean;
  /** null is the anonymous bin — a real bin on the wall with no name on the tape. */
  name: string | null;
  message: string | null;
  joinedAt?: string;
}

export interface SupporterProfilePatch {
  /** Empty or null switches the bin to anonymous, clearing the message with it. */
  name?: string | null;
  message?: string | null;
  badgePublic?: boolean;
}

export type SupporterEditError =
  | { kind: 'blocked'; message: string }
  | { kind: 'unauthorized' }
  | { kind: 'rateLimited' }
  | { kind: 'network' };

const ENDPOINT = '/api/supporters/me';

const ANONYMOUS: SupporterStatus = {
  supporter: false,
  badgePublic: false,
  name: null,
  message: null,
};

function parseStatus(value: unknown): SupporterStatus {
  if (typeof value !== 'object' || value === null) return ANONYMOUS;
  const record = value as Record<string, unknown>;
  if (record.supporter !== true) return ANONYMOUS;
  return {
    supporter: true,
    badgePublic: record.badgePublic !== false,
    name: typeof record.name === 'string' && record.name ? record.name : null,
    message: typeof record.message === 'string' && record.message ? record.message : null,
    ...(typeof record.joinedAt === 'string' ? { joinedAt: record.joinedAt } : {}),
  };
}

/**
 * Read the caller's supporter status.
 *
 * Never throws and never rejects: an anonymous visitor, a signed-out session,
 * and a failed request all mean the same thing to the page — show the ask
 * rather than the controls.
 */
export async function fetchSupporterStatus(signal?: AbortSignal): Promise<SupporterStatus> {
  try {
    // The community 401 rationale applies here too: an expired session on this
    // page must not flip every tab anonymous and drain the sync outbox.
    const response = await apiFetch(ENDPOINT, {
      method: 'GET',
      signal,
      suppressForcedSignOut: true,
    });
    if (!response.ok) return ANONYMOUS;
    return parseStatus(await response.json());
  } catch {
    return ANONYMOUS;
  }
}

/**
 * Rewrite the caller's own bin.
 *
 * The server is the authority on what a name or message may say — it re-runs
 * the same filter the Ko-fi webhook does — so a rejection here carries the
 * reason back rather than being pre-empted client-side.
 */
export async function updateSupporterProfile(
  patch: SupporterProfilePatch
): Promise<SupporterStatus | SupporterEditError> {
  let response: Response;
  try {
    response = await apiFetch(ENDPOINT, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
      suppressForcedSignOut: true,
    });
  } catch {
    return { kind: 'network' };
  }

  if (response.ok) {
    try {
      return parseStatus(await response.json());
    } catch {
      return { kind: 'network' };
    }
  }
  if (response.status === 401 || response.status === 403) return { kind: 'unauthorized' };
  if (response.status === 429) return { kind: 'rateLimited' };

  let message = '';
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { error?: unknown }).error === 'string'
    ) {
      message = (body as { error: string }).error;
    }
  } catch {
    /* a body-less 4xx still reports as blocked, just without the server's wording */
  }
  return { kind: 'blocked', message };
}

export function isSupporterEditError(
  value: SupporterStatus | SupporterEditError
): value is SupporterEditError {
  return 'kind' in value;
}
