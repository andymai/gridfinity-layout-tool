import { useEffect } from 'react';
import { useTranslation } from '@/i18n';
import { useCommunityDigestStore } from '@/core/store/communityDigest';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useMineStore } from '../../store/mineStore';
import { commitDigestSeen } from '../../utils/communityDigest';

/**
 * The "+N likes, +N remixes, +N prints since your last visit" line, plus the
 * seen-commit side effect: mounting this with a computed digest is what
 * counts as "Mine was actually viewed", so it commits the seen baseline and
 * clears the entry-point dot. The summary itself stays up for the visit that
 * consumed it (markSeen keeps it in the seam store).
 */
export function MineDigestSummary() {
  const t = useTranslation();
  const userId = useSessionStore((s) =>
    s.status === 'authenticated' ? (s.user?.userId ?? null) : null
  );
  const summary = useCommunityDigestStore((s) => s.summary);
  const markSeen = useCommunityDigestStore((s) => s.markSeen);
  const mineFetchedAt = useMineStore((s) => s.fetchedAt);

  const hasSummary = summary !== null;
  useEffect(() => {
    if (userId === null || !hasSummary) return;
    // Re-commit whenever a fresh mine fetch lands while this view is open:
    // the fetch wrote new latest counts and the owner is looking at them, so
    // committing here keeps the seen baseline from lagging what the cards
    // display (which would re-announce the same deltas next app open).
    void mineFetchedAt;
    // Idempotent pair, safe under StrictMode double-invoke: the commit copies
    // latest onto seen and markSeen only clears the dot flag.
    commitDigestSeen(userId);
    markSeen();
  }, [userId, hasSummary, markSeen, mineFetchedAt]);

  if (userId === null || summary === null || !summary.hasDelta) return null;

  const parts: string[] = [];
  if (summary.likesDelta > 0) {
    parts.push(
      summary.likesDelta === 1
        ? t('community.mine.digest.likesOne')
        : t('community.mine.digest.likes', { count: summary.likesDelta })
    );
  }
  if (summary.remixesDelta > 0) {
    parts.push(
      summary.remixesDelta === 1
        ? t('community.mine.digest.remixesOne')
        : t('community.mine.digest.remixes', { count: summary.remixesDelta })
    );
  }
  if (summary.exportsDelta > 0) {
    parts.push(
      summary.exportsDelta === 1
        ? t('community.mine.digest.printsOne')
        : t('community.mine.digest.prints', { count: summary.exportsDelta })
    );
  }

  return (
    <p
      role="status"
      data-testid="community-mine-digest"
      className="mb-3 rounded-lg border border-accent/20 bg-accent/5 px-3 py-2 text-sm text-content-secondary"
    >
      {t('community.mine.digest.summary', { parts: parts.join(', ') })}
    </p>
  );
}
