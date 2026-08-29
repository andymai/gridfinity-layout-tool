/**
 * Derived portrait shown while the gallery is filtered to one author.
 *
 * No self-authored bio by design: a bio answers "how does this person present
 * themselves", where the useful question is "what do they make, and does it
 * work". Everything here is derived from cards already loaded, so it adds no
 * request and no moderation surface.
 */

import { useMemo } from 'react';
import { useFormatting, useTranslation } from '@/i18n';
import type { CommunityCard } from '@/shared/types/community';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';
import { buildAuthorSummary } from '../../utils/authorSummary';

export interface AuthorSummaryProps {
  items: readonly CommunityCard[];
  authorPublicId: string;
  authorName: string;
  /**
   * The loaded index hit its cap, so older designs by this author may be
   * absent. Surfaced rather than hidden: an understated count that looks
   * authoritative is worse than one that admits its own limits.
   */
  indexCapped: boolean;
}

export function AuthorSummary({
  items,
  authorPublicId,
  authorName,
  indexCapped,
}: AuthorSummaryProps) {
  const t = useTranslation();
  // The app's locale, not the OS one: an in-app language switch must move
  const { formatDate } = useFormatting();
  const summary = useMemo(() => buildAuthorSummary(items, authorPublicId), [items, authorPublicId]);

  if (summary.designCount === 0) return null;

  const facts: string[] = [
    summary.designCount === 1
      ? t('community.author.designsOne')
      : t('community.author.designsOther', { count: summary.designCount }),
  ];

  if (summary.firstPublishedAt !== null) {
    // Hoisted rather than inlined: the interpolation check parses t() args
    // with a regex and reads a nested options object as extra params.
    const since = formatDate(summary.firstPublishedAt, { year: 'numeric', month: 'long' });
    facts.push(t('community.author.since', { date: since }));
  }

  if (summary.topCategories.length > 0) {
    facts.push(
      t('community.author.makes', {
        categories: summary.topCategories.map((c) => t(CATEGORY_LABEL_KEYS[c])).join(', '),
      })
    );
  }

  // Proof signals only when non-zero: "built on 0 times" is a way of saying
  // nothing while looking like a measurement.
  const proof: string[] = [];
  if (summary.printsOfTheirWork > 0) {
    proof.push(
      summary.printsOfTheirWork === 1
        ? t('community.author.printedOne')
        : t('community.author.printedOther', { count: summary.printsOfTheirWork })
    );
  }
  if (summary.remixesOfTheirWork > 0) {
    proof.push(
      summary.remixesOfTheirWork === 1
        ? t('community.author.remixedOne')
        : t('community.author.remixedOther', { count: summary.remixesOfTheirWork })
    );
  }

  return (
    <div
      className="mb-3 rounded-lg border border-stroke-subtle bg-surface-secondary px-3 py-2"
      data-testid="author-summary"
    >
      <p className="text-sm font-medium text-content">{authorName}</p>
      <p className="mt-0.5 text-xs text-content-secondary" data-testid="author-summary-facts">
        {facts.join(' · ')}
      </p>

      {proof.length > 0 && (
        <p className="mt-1 text-xs text-content" data-testid="author-summary-proof">
          {proof.join(' · ')}
        </p>
      )}

      {summary.topTechniques.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1" data-testid="author-summary-techniques">
          {summary.topTechniques.map((technique) => (
            <span
              key={technique}
              className="rounded bg-surface px-1.5 py-0.5 text-label uppercase tracking-wide text-content-tertiary"
            >
              {t(TECHNIQUE_CONFIG[technique].labelKey)}
            </span>
          ))}
        </div>
      )}

      {indexCapped && (
        <p className="mt-1 text-label text-content-tertiary" data-testid="author-summary-partial">
          {t('community.author.partial')}
        </p>
      )}
    </div>
  );
}
