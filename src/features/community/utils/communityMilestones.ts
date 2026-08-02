/**
 * One-time community milestones (plan §2.6): each fires at most once per
 * user, recorded in localStorage keyed by userId. `claimMilestone` is the
 * single gate: read and write happen in one synchronous block so a re-run
 * (StrictMode double-invoke, two mounted entry points) cannot double-fire.
 */

import type { CommunityMilestoneKind } from '@/shared/types/community';
import { COMMUNITY_MILESTONE_KINDS } from '@/shared/types/community';
import type { CommunityDigest, DigestCounts } from './communityDigest';

const MILESTONES_KEY = 'gridfinity-community-milestones-v1';

export const TEN_REMIXES_THRESHOLD = 10;
export const HUNDRED_PRINTS_THRESHOLD = 100;

function isMilestoneKind(value: unknown): value is CommunityMilestoneKind {
  return (
    typeof value === 'string' && (COMMUNITY_MILESTONE_KINDS as readonly string[]).includes(value)
  );
}

function loadAll(): Record<string, CommunityMilestoneKind[]> {
  try {
    const stored = localStorage.getItem(MILESTONES_KEY);
    if (stored === null) return {};
    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    const records: Record<string, CommunityMilestoneKind[]> = {};
    for (const [userId, kinds] of Object.entries(parsed)) {
      if (Array.isArray(kinds)) records[userId] = kinds.filter(isMilestoneKind);
    }
    return records;
  } catch {
    return {};
  }
}

export function hasFiredMilestone(userId: string, kind: CommunityMilestoneKind): boolean {
  return (loadAll()[userId] ?? []).includes(kind);
}

/**
 * Records the milestone and reports whether the caller may celebrate it.
 * Returns false when it already fired, and also when the record cannot be
 * persisted: an unpersistable claim would re-celebrate on every visit, which
 * is worse than never celebrating.
 *
 * The read-modify-write is atomic only within one JS context (StrictMode
 * double-invoke, multiple mounted entry points). Two tabs running the
 * app-open check concurrently can both claim and toast the same kind; the
 * window is narrow and a duplicate toast is harmless, so this is accepted
 * rather than synchronized cross-tab.
 */
export function claimMilestone(userId: string, kind: CommunityMilestoneKind): boolean {
  const all = loadAll();
  const fired = all[userId] ?? [];
  if (fired.includes(kind)) return false;
  try {
    localStorage.setItem(MILESTONES_KEY, JSON.stringify({ ...all, [userId]: [...fired, kind] }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Milestones the current mine-list data has earned, before the once-only
 * claim filter. `first_remix_of_yours` requires the unseen delta to account
 * for every known remix: a bare positive delta would also fire on a fresh
 * device (empty per-device claim record) when an established design gains
 * remix #51, which is not anyone's first. The two threshold milestones read
 * totals, which are news whenever crossed.
 */
export function dueAggregateMilestones(
  latest: Record<string, DigestCounts>,
  digest: CommunityDigest
): CommunityMilestoneKind[] {
  let totalRemixes = 0;
  let totalExports = 0;
  for (const counts of Object.values(latest)) {
    totalRemixes += counts.remixes;
    totalExports += counts.exports;
  }
  const due: CommunityMilestoneKind[] = [];
  if (digest.remixesDelta > 0 && totalRemixes === digest.remixesDelta) {
    due.push('first_remix_of_yours');
  }
  if (totalRemixes >= TEN_REMIXES_THRESHOLD) due.push('ten_published_remixes');
  if (totalExports >= HUNDRED_PRINTS_THRESHOLD) due.push('hundred_prints');
  return due;
}
