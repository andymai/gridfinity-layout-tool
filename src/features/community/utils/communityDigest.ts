/**
 * Since-last-visit digest snapshots (plan §2.6): per-design count snapshots
 * in localStorage, keyed by userId so shared browsers never mix accounts.
 *
 * Two count maps per user make the deltas persist until actually seen:
 * `latest` is written on every mine-list fetch, `seen` only when the Mine
 * surface is really viewed. The digest is always latest-minus-seen, so a
 * reload (or a fetch skipped by the between-check floor) keeps showing the
 * same unseen deltas instead of silently zeroing them.
 */

import type { CommunityCard } from '@/shared/types/community';
import { isRecord } from '@/shared/utils/isRecord';

const DIGEST_KEY = 'gridfinity-community-digest-v1';

export const DIGEST_CHECK_FLOOR_MS = 30 * 60 * 1000;

export interface DigestCounts {
  readonly likes: number;
  readonly remixes: number;
  readonly exports: number;
}

export interface UserDigestRecord {
  /** Epoch ms of the last successful mine-list fetch; enforces the between-check floor. */
  readonly lastCheckedAt: number;
  /** Counts from the most recent fetch. */
  readonly latest: Record<string, DigestCounts>;
  /** Counts as of the last time Mine was actually viewed; the delta baseline. */
  readonly seen: Record<string, DigestCounts>;
}

export interface CommunityDigest {
  readonly likesDelta: number;
  readonly remixesDelta: number;
  readonly exportsDelta: number;
  readonly hasDelta: boolean;
}

export const EMPTY_USER_DIGEST_RECORD: UserDigestRecord = {
  lastCheckedAt: 0,
  latest: {},
  seen: {},
};

function isCounts(value: unknown): value is DigestCounts {
  return (
    isRecord(value) &&
    typeof value.likes === 'number' &&
    typeof value.remixes === 'number' &&
    typeof value.exports === 'number'
  );
}

function isCountsMap(value: unknown): value is Record<string, DigestCounts> {
  return isRecord(value) && Object.values(value).every(isCounts);
}

function isUserDigestRecord(value: unknown): value is UserDigestRecord {
  return (
    isRecord(value) &&
    typeof value.lastCheckedAt === 'number' &&
    isCountsMap(value.latest) &&
    isCountsMap(value.seen)
  );
}

function loadAll(): Record<string, UserDigestRecord> {
  try {
    const stored = localStorage.getItem(DIGEST_KEY);
    if (stored === null) return {};
    const parsed: unknown = JSON.parse(stored);
    if (!isRecord(parsed)) return {};
    const records: Record<string, UserDigestRecord> = {};
    for (const [userId, record] of Object.entries(parsed)) {
      if (isUserDigestRecord(record)) records[userId] = record;
    }
    return records;
  } catch {
    return {};
  }
}

function saveAll(records: Record<string, UserDigestRecord>): void {
  try {
    localStorage.setItem(DIGEST_KEY, JSON.stringify(records));
  } catch {
    // Private browsing or quota: the digest just resets next visit.
  }
}

export function loadUserDigestRecord(userId: string): UserDigestRecord {
  return loadAll()[userId] ?? EMPTY_USER_DIGEST_RECORD;
}

export function isDigestCheckDue(record: UserDigestRecord, now: number): boolean {
  return now - record.lastCheckedAt >= DIGEST_CHECK_FLOOR_MS;
}

/** Stores freshly fetched counts and the check timestamp; the seen baseline is untouched. */
export function saveFetchedCounts(
  userId: string,
  latest: Record<string, DigestCounts>,
  now: number
): void {
  const all = loadAll();
  const existing = all[userId] ?? EMPTY_USER_DIGEST_RECORD;
  saveAll({ ...all, [userId]: { lastCheckedAt: now, latest, seen: existing.seen } });
}

/** Commits the latest counts as seen; call only when Mine is actually viewed. */
export function commitDigestSeen(userId: string): void {
  const all = loadAll();
  const existing = all[userId] ?? EMPTY_USER_DIGEST_RECORD;
  saveAll({ ...all, [userId]: { ...existing, seen: existing.latest } });
}

export function countsFromCards(cards: readonly CommunityCard[]): Record<string, DigestCounts> {
  const counts: Record<string, DigestCounts> = {};
  for (const card of cards) {
    counts[card.id] = {
      likes: card.counts.likes,
      remixes: card.counts.remixes,
      exports: card.counts.exports,
    };
  }
  return counts;
}

/**
 * Latest-minus-seen across all designs. A design without a seen baseline
 * (published since the last Mine visit, or a brand-new browser) contributes
 * zero: its initial counts are not news the digest should announce.
 * `Math.max(0, ...)` guards unpublish/republish count corrections from ever
 * producing a negative delta.
 */
export function computeDigest(record: UserDigestRecord): CommunityDigest {
  let likesDelta = 0;
  let remixesDelta = 0;
  let exportsDelta = 0;
  for (const [id, latest] of Object.entries(record.latest)) {
    if (!Object.hasOwn(record.seen, id)) continue;
    const seen = record.seen[id];
    likesDelta += Math.max(0, latest.likes - seen.likes);
    remixesDelta += Math.max(0, latest.remixes - seen.remixes);
    exportsDelta += Math.max(0, latest.exports - seen.exports);
  }
  return {
    likesDelta,
    remixesDelta,
    exportsDelta,
    hasDelta: likesDelta > 0 || remixesDelta > 0 || exportsDelta > 0,
  };
}
