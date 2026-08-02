import { COMMUNITY_CATEGORIES } from '@/shared/types/community';
import type { CommunityPublishDraft } from '@/shared/types/community';

const PENDING_PUBLISH_KEY = 'gridfinity-community-pending-publish-v1';

// The OAuth round trip through a provider consent screen can take minutes,
// unlike the 30s reload window ephemeralState uses.
const MAX_AGE_MS = 10 * 60 * 1000;

const RETURN_SURFACES = ['designer', 'gallery', 'route'] as const;

export type PublishReturnSurface = (typeof RETURN_SURFACES)[number];

export interface PendingPublishAction {
  designId: string;
  returnSurface: PublishReturnSurface;
  savedAt: number;
  draft?: CommunityPublishDraft | null;
}

function isPublishReturnSurface(value: unknown): value is PublishReturnSurface {
  return (RETURN_SURFACES as readonly unknown[]).includes(value);
}

function isPublishDraft(value: unknown): value is CommunityPublishDraft {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.name === 'string' &&
    typeof record.description === 'string' &&
    (record.category === null ||
      (COMMUNITY_CATEGORIES as readonly unknown[]).includes(record.category))
  );
}

function isPendingPublishAction(value: unknown): value is PendingPublishAction {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.designId === 'string' &&
    record.designId.length > 0 &&
    isPublishReturnSurface(record.returnSurface) &&
    typeof record.savedAt === 'number' &&
    Number.isFinite(record.savedAt) &&
    (record.draft === undefined || record.draft === null || isPublishDraft(record.draft))
  );
}

export function savePendingPublishAction(action: Omit<PendingPublishAction, 'savedAt'>): void {
  try {
    const withTimestamp: PendingPublishAction = { ...action, savedAt: Date.now() };
    sessionStorage.setItem(PENDING_PUBLISH_KEY, JSON.stringify(withTimestamp));
  } catch {
    // Private browsing or quota: the user re-opens the dialog manually.
  }
}

/**
 * One-shot: the key is removed before validation so a malformed or stale
 * record can never replay on a later boot. The OAuth callback always lands
 * on `/`, so callers read this on app boot rather than on a return URL.
 */
export function loadPendingPublishAction(): PendingPublishAction | null {
  try {
    const stored = sessionStorage.getItem(PENDING_PUBLISH_KEY);
    if (stored === null) return null;
    sessionStorage.removeItem(PENDING_PUBLISH_KEY);
    const parsed: unknown = JSON.parse(stored);
    if (!isPendingPublishAction(parsed)) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    try {
      sessionStorage.removeItem(PENDING_PUBLISH_KEY);
    } catch {
      // best-effort
    }
    return null;
  }
}

/**
 * Non-consuming read for surfaces that only need to know where the flow
 * should resume (e.g. app boot navigating back to the designer). The record
 * stays in place for `loadPendingPublishAction` to consume on the resume
 * surface.
 */
export function peekPendingPublishAction(): PendingPublishAction | null {
  try {
    const stored = sessionStorage.getItem(PENDING_PUBLISH_KEY);
    if (stored === null) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!isPendingPublishAction(parsed)) return null;
    if (Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingPublishAction(): void {
  try {
    sessionStorage.removeItem(PENDING_PUBLISH_KEY);
  } catch {
    // best-effort
  }
}
