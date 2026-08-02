/**
 * The OAuth callback always lands on `/`, so a like or report started from
 * /community or /community/d/<id> would drop the visitor into the layout
 * planner on return. CommunitySignInPrompt stashes the originating URL here
 * before the redirect and the boot-time return hook navigates back to it.
 * Restricted to same-origin community paths: never a full URL, so the record
 * cannot become an open redirect.
 */

const RETURN_PATH_KEY = 'gridfinity-community-return-path-v1';

// The OAuth round trip through a provider consent screen can take minutes,
// unlike the 30s reload window ephemeralState uses.
const MAX_AGE_MS = 10 * 60 * 1000;

interface StoredReturnPath {
  path: string;
  savedAt: number;
}

function isCommunityPath(path: string): boolean {
  return path === '/community' || path.startsWith('/community/') || path.startsWith('/community?');
}

function isStoredReturnPath(value: unknown): value is StoredReturnPath {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.path === 'string' &&
    isCommunityPath(record.path) &&
    typeof record.savedAt === 'number' &&
    Number.isFinite(record.savedAt)
  );
}

/**
 * Companion slot for the gallery-tab surface, where there is no community URL
 * to return to: a like or report started from the detail overlay on `/`
 * stashes the open design's id here, and the boot-time return hook reopens
 * the gallery and that detail so the user can finish what they started
 * (a report in particular is deliberately never auto-submitted).
 */
const REOPEN_DESIGN_KEY = 'gridfinity-community-reopen-design-v1';

interface StoredReopenDesign {
  designId: string;
  savedAt: number;
}

function isStoredReopenDesign(value: unknown): value is StoredReopenDesign {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.designId === 'string' &&
    record.designId.length > 0 &&
    record.designId.length <= 64 &&
    typeof record.savedAt === 'number' &&
    Number.isFinite(record.savedAt)
  );
}

export function saveCommunityReopenDesign(designId: string): void {
  try {
    const record: StoredReopenDesign = { designId, savedAt: Date.now() };
    sessionStorage.setItem(REOPEN_DESIGN_KEY, JSON.stringify(record));
  } catch {
    // Private browsing or quota: the visitor reopens the design manually.
  }
}

/**
 * One-shot: the key is removed before validation so a malformed or stale
 * record can never replay on a later boot.
 */
export function loadCommunityReopenDesign(): string | null {
  try {
    const stored = sessionStorage.getItem(REOPEN_DESIGN_KEY);
    if (stored === null) return null;
    sessionStorage.removeItem(REOPEN_DESIGN_KEY);
    const parsed: unknown = JSON.parse(stored);
    if (!isStoredReopenDesign(parsed)) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed.designId;
  } catch {
    try {
      sessionStorage.removeItem(REOPEN_DESIGN_KEY);
    } catch {
      // best-effort
    }
    return null;
  }
}

/** No-op for anything but a community path (e.g. the in-app gallery tab on `/`). */
export function saveCommunityReturnPath(path: string): void {
  if (!isCommunityPath(path)) return;
  try {
    const record: StoredReturnPath = { path, savedAt: Date.now() };
    sessionStorage.setItem(RETURN_PATH_KEY, JSON.stringify(record));
  } catch {
    // Private browsing or quota: the visitor navigates back manually.
  }
}

/**
 * One-shot: the key is removed before validation so a malformed or stale
 * record can never replay on a later boot.
 */
export function loadCommunityReturnPath(): string | null {
  try {
    const stored = sessionStorage.getItem(RETURN_PATH_KEY);
    if (stored === null) return null;
    sessionStorage.removeItem(RETURN_PATH_KEY);
    const parsed: unknown = JSON.parse(stored);
    if (!isStoredReturnPath(parsed)) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed.path;
  } catch {
    try {
      sessionStorage.removeItem(RETURN_PATH_KEY);
    } catch {
      // best-effort
    }
    return null;
  }
}
