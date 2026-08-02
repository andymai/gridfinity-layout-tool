/**
 * Fire-and-forget export attribution for designs carrying community lineage.
 *
 * Lives in shared/ so the bin designer's export hook can reach the community
 * API without a cross-feature import (same seam as communityPendingAction).
 * Deliberately not Result-typed: the download already succeeded by the time
 * this fires, so there is no caller-visible error path to model.
 */

import { apiFetch } from '@/core/sync/apiFetch';
import { generateUUID } from '@/shared/utils/uuid';

const CLIENT_ID_KEY = 'gridfinity-community-client-id';

// Mirrors COMMUNITY_CLIENT_ID_REGEX in api/community/[id].ts. A stored value
// that no longer matches (hand-edited storage) is regenerated rather than
// sent, so the server never 400s on a corrupt id.
const CLIENT_ID_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

let ephemeralClientId: string | null = null;

/**
 * Anonymous per-install id used only for server-side dedupe of engagement
 * counters. Persisted to localStorage; falls back to a per-session id when
 * storage is blocked (private mode) so repeat exports from one tab still
 * collapse.
 */
export function getCommunityClientId(): string {
  try {
    const existing = localStorage.getItem(CLIENT_ID_KEY);
    if (existing !== null && CLIENT_ID_PATTERN.test(existing)) return existing;
    const id = generateUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
    return id;
  } catch {
    ephemeralClientId ??= generateUUID();
    return ephemeralClientId;
  }
}

/**
 * Credit a community design with one export. The server walks the credited
 * design's own lineage, so callers pass the immediate parent id and the root
 * gets credited transitively.
 */
export async function recordCommunityExport(designId: string): Promise<void> {
  try {
    await apiFetch(`/api/community/${designId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'export', clientId: getCommunityClientId() }),
      // Anonymous exporters are the norm here; a 401 must not force-sign-out
      // every open tab (same rationale as communityFetch in
      // features/community/api/client.ts).
      suppressForcedSignOut: true,
    });
  } catch {
    // A failed attribution ping must never surface to the exporting user or
    // block the download that already completed.
  }
}
