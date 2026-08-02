/**
 * Signed-in app-open digest check (plan §2.6). Fetches the owner's mine list
 * at most once per session and never more often than the persisted 30-minute
 * floor, computes latest-minus-seen deltas, publishes them to the core
 * communityDigest seam store (the entry-point dot), and reports which
 * aggregate milestones the data has earned.
 *
 * When the floor skips the fetch, the digest is still recomputed from the
 * stored counts, so unseen deltas keep lighting the dot across app opens.
 *
 * The per-user promise cache makes concurrent calls (StrictMode double
 * effects, several mounted entry points) share one fetch and one result.
 * Milestone claiming stays with the caller: it pairs the once-only claim
 * with the toast in one synchronous block.
 */

import { isOk } from '@/core/result';
import { useCommunityDigestStore } from '@/core/store/communityDigest';
import type { CommunityMilestoneKind } from '@/shared/types/community';
import { fetchMineIndex } from '../api/client';
import {
  computeDigest,
  countsFromCards,
  isDigestCheckDue,
  loadUserDigestRecord,
  saveFetchedCounts,
} from './communityDigest';
import { dueAggregateMilestones, hasFiredMilestone } from './communityMilestones';

const checks = new Map<string, Promise<CommunityMilestoneKind[]>>();

export function runCommunityDigestCheck(userId: string): Promise<CommunityMilestoneKind[]> {
  const existing = checks.get(userId);
  if (existing !== undefined) return existing;
  const run = doCheck(userId);
  checks.set(userId, run);
  return run;
}

async function doCheck(userId: string): Promise<CommunityMilestoneKind[]> {
  let record = loadUserDigestRecord(userId);
  const now = Date.now();
  if (isDigestCheckDue(record, now)) {
    const result = await fetchMineIndex();
    if (isOk(result)) {
      saveFetchedCounts(userId, countsFromCards(result.value.items), now);
      record = loadUserDigestRecord(userId);
    }
    // On a failed fetch lastCheckedAt stays put, so the next app open retries
    // instead of waiting out a floor that never bought a fetch.
  }
  const digest = computeDigest(record);
  useCommunityDigestStore.getState().setDigest(digest);
  return dueAggregateMilestones(record.latest, digest).filter(
    (kind) => !hasFiredMilestone(userId, kind)
  );
}

/** The session-once cache would leak state between vitest cases otherwise. */
export function resetCommunityDigestCheckForTests(): void {
  checks.clear();
}
