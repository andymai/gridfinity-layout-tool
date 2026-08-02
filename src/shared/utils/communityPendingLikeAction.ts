/**
 * Sibling of communityPendingAction.ts for the like flow: a signed-out heart
 * tap stashes the intended toggle here before the OAuth redirect, and
 * useCommunityLikeReturn applies it once the session resolves. Deliberately a
 * separate sessionStorage slot so the publish and like flows cannot fight
 * over one record mid-redirect.
 */

const PENDING_LIKE_KEY = 'gridfinity-community-pending-like-v1';

// The OAuth round trip through a provider consent screen can take minutes,
// unlike the 30s reload window ephemeralState uses.
const MAX_AGE_MS = 10 * 60 * 1000;

export interface PendingLikeAction {
  designId: string;
  /** The toggle direction the tap intended. */
  liked: boolean;
  savedAt: number;
}

function isPendingLikeAction(value: unknown): value is PendingLikeAction {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.designId === 'string' &&
    record.designId.length > 0 &&
    typeof record.liked === 'boolean' &&
    typeof record.savedAt === 'number' &&
    Number.isFinite(record.savedAt)
  );
}

export function savePendingLikeAction(action: Omit<PendingLikeAction, 'savedAt'>): void {
  try {
    const withTimestamp: PendingLikeAction = { ...action, savedAt: Date.now() };
    sessionStorage.setItem(PENDING_LIKE_KEY, JSON.stringify(withTimestamp));
  } catch {
    // Private browsing or quota: the user taps the heart again after sign-in.
  }
}

/**
 * One-shot: the key is removed before validation so a malformed or stale
 * record can never replay on a later boot. The OAuth callback always lands
 * on `/`, so this is read on app boot rather than on a return URL.
 */
export function loadPendingLikeAction(): PendingLikeAction | null {
  try {
    const stored = sessionStorage.getItem(PENDING_LIKE_KEY);
    if (stored === null) return null;
    sessionStorage.removeItem(PENDING_LIKE_KEY);
    const parsed: unknown = JSON.parse(stored);
    if (!isPendingLikeAction(parsed)) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    try {
      sessionStorage.removeItem(PENDING_LIKE_KEY);
    } catch {
      // best-effort
    }
    return null;
  }
}

export function clearPendingLikeAction(): void {
  try {
    sessionStorage.removeItem(PENDING_LIKE_KEY);
  } catch {
    // best-effort
  }
}
