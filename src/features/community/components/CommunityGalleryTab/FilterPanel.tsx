import { useState } from 'react';
import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, CheckboxRow, IconButton, cn } from '@/design-system';
import { XIcon } from '@/design-system/Icon';
import { useGapFitStore } from '@/core/store/gapFit';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import type { CommunityCard, CommunityCategory } from '@/shared/types/community';
import { COMMUNITY_CATEGORIES } from '@/shared/types/community';
import { hasActiveBrowseFilters, useBrowseStore } from '../../store/browseStore';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';
import { formatUnits } from '../CommunityCard/cardDims';
import { CommunitySignInPrompt } from '../SignInPrompt';
import { CommunityTechniquePills } from './CommunityTechniquePills';
import { DimensionFilters } from './DimensionFilters';
import type { FacetCounts } from './facetCounts';

export interface FilterPanelProps {
  items: readonly CommunityCard[];
  counts: FacetCounts;
  /** Roomier rows and 44px targets for the mobile in-place view. */
  touchSize?: boolean;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
        {title}
      </h3>
      {children}
    </section>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="shrink-0 text-xs tabular-nums text-content-tertiary" aria-hidden="true">
      {count}
    </span>
  );
}

export function FilterPanel({ items, counts, touchSize = false }: FilterPanelProps) {
  const t = useTranslation();
  const [likedSignInOpen, setLikedSignInOpen] = useState(false);

  const { filters, fitsGapContext } = useBrowseStore(
    useShallow((s) => ({ filters: s.filters, fitsGapContext: s.fitsGapContext }))
  );
  const setCategory = useBrowseStore((s) => s.setCategory);
  const setTechnique = useBrowseStore((s) => s.setTechnique);
  const setAuthor = useBrowseStore((s) => s.setAuthor);
  const setLikedOnly = useBrowseStore((s) => s.setLikedOnly);
  const setRecentOnly = useBrowseStore((s) => s.setRecentOnly);
  const setFeaturedOnly = useBrowseStore((s) => s.setFeaturedOnly);
  const setMineOnly = useBrowseStore((s) => s.setMineOnly);
  const setFitsGapContext = useBrowseStore((s) => s.setFitsGapContext);
  const clearFilters = useBrowseStore((s) => s.clearFilters);
  const signedIn = useSessionStore((s) => s.status) === 'authenticated';

  // Mirrors CheckboxRow's own row metrics so the single-select category list
  // sits on the same rhythm as the multi-select rows above it.
  const rowClass = (active: boolean): string =>
    cn(
      'flex w-full items-center justify-between gap-2 rounded-md p-1.5 -mx-1.5 text-left text-sm font-normal',
      touchSize && 'min-h-11',
      active ? 'bg-accent-muted font-medium text-content' : 'text-content-tertiary'
    );

  const toggleRow = (
    key: string,
    label: string,
    active: boolean,
    // `null` where a count is not computable from the public index — Mine
    // swaps the card source rather than filtering it.
    count: number | null,
    onToggle: () => void
  ) => (
    <CheckboxRow
      key={key}
      label={label}
      checked={active}
      onChange={onToggle}
      className={cn(touchSize && 'min-h-11')}
      trailing={count === null ? undefined : <CountBadge count={count} />}
      data-testid={`community-filter-${key}`}
    />
  );

  const authorLabel =
    filters.author !== null && filters.author.name !== ''
      ? filters.author.name
      : t('community.gallery.authorFallback');

  // Clearing the gap ends the whole fits-gap context, core handoff included:
  // browsing returns to normal and the detail view's "Place in layout" action
  // disappears with it.
  const clearFitsGap = () => {
    setFitsGapContext(null);
    useGapFitStore.getState().clear();
  };

  const viewingRow = (label: string, ariaLabel: string, onClear: () => void, testId: string) => (
    <div
      className="flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent-muted px-2 py-1.5 text-sm text-content"
      data-testid={testId}
    >
      <span className="min-w-0 flex-1 break-words">{label}</span>
      <IconButton aria-label={ariaLabel} size="sm" touchTarget={touchSize} onClick={onClear}>
        <XIcon className="h-3 w-3" />
      </IconButton>
    </div>
  );

  const hasViewingContext = filters.author !== null || fitsGapContext !== null;

  const viewingRows: ReactNode[] = [];
  if (filters.author !== null) {
    viewingRows.push(
      viewingRow(
        t('community.gallery.filteredByAuthor', { author: authorLabel }),
        t('community.gallery.clearAuthorFilter'),
        () => setAuthor(null),
        'community-viewing-author'
      )
    );
  }
  if (fitsGapContext !== null) {
    viewingRows.push(
      viewingRow(
        t('community.gallery.fitsGapBanner', {
          width: formatUnits(fitsGapContext.widthMax),
          depth: formatUnits(fitsGapContext.depthMax),
        }),
        t('community.gallery.clearFitsGap'),
        clearFitsGap,
        'community-viewing-fits-gap'
      )
    );
  }

  const handleLikedToggle = () => {
    // Signed out, the row explains itself through the sign-in prompt rather
    // than sitting disabled: a dead control with only a title tooltip is
    // unexplained on touch.
    if (!signedIn) {
      trackEvent('community_signin_prompt_shown', { intent: 'liked-filter' });
      setLikedSignInOpen(true);
      return;
    }
    setLikedOnly(!filters.likedOnly);
  };

  const showRows: ReactNode[] = [
    toggleRow(
      'liked',
      t('community.gallery.likedFilter'),
      filters.likedOnly,
      counts.liked,
      handleLikedToggle
    ),
  ];
  // No signed-out branch, unlike Liked: a signed-out visitor structurally has
  // no published designs, so the row is absent rather than dead.
  if (signedIn) {
    showRows.push(
      toggleRow('mine', t('community.gallery.mineFilter'), filters.mineOnly, null, () =>
        setMineOnly(!filters.mineOnly)
      )
    );
  }
  showRows.push(
    toggleRow(
      'recent',
      t('community.gallery.recentFilter'),
      filters.recentOnly,
      counts.recent,
      () => setRecentOnly(!filters.recentOnly)
    ),
    toggleRow(
      'featured',
      t('community.shelves.featured'),
      filters.featuredOnly,
      counts.featured,
      () => setFeaturedOnly(!filters.featuredOnly)
    )
  );

  return (
    <div className="space-y-5" data-testid="community-filter-panel">
      {hasViewingContext && (
        <Section title={t('community.gallery.viewingSection')}>
          <div className="space-y-1.5">{viewingRows}</div>
        </Section>
      )}

      <Section title={t('community.gallery.showSection')}>
        <div className="space-y-0.5">{showRows}</div>
        <CommunitySignInPrompt
          open={likedSignInOpen}
          message={t('community.gallery.likedFilterSignedOut')}
          onClose={() => setLikedSignInOpen(false)}
        />
      </Section>

      <Section title={t('community.gallery.categoryLabel')}>
        <div role="radiogroup" aria-label={t('community.gallery.categoryLabel')}>
          <Button
            variant="ghost"
            role="radio"
            aria-checked={filters.category === null}
            onClick={() => setCategory(null)}
            className={rowClass(filters.category === null)}
            data-testid="community-filter-category-all"
          >
            <span className="min-w-0 truncate">{t('community.gallery.categoryAll')}</span>
            <CountBadge count={counts.categoryAll} />
          </Button>
          {COMMUNITY_CATEGORIES.map((category: CommunityCategory) => {
            const count = counts.categories.get(category) ?? 0;
            const selected = filters.category === category;
            // A zero-count option is a guaranteed empty grid; keeping the
            // current selection enabled preserves the way back out of one.
            const unavailable = count === 0 && !selected;
            return (
              <Button
                variant="ghost"
                key={category}
                role="radio"
                aria-checked={selected}
                disabled={unavailable}
                onClick={() => setCategory(selected ? null : category)}
                className={cn(rowClass(selected), unavailable && 'opacity-40')}
                data-testid={`community-filter-category-${category}`}
              >
                <span className="min-w-0 truncate">{t(CATEGORY_LABEL_KEYS[category])}</span>
                <CountBadge count={count} />
              </Button>
            );
          })}
        </div>
      </Section>

      <Section title={t('community.gallery.sizeLabel')}>
        <DimensionFilters items={items} counts={counts} touchSize={touchSize} />
      </Section>

      <Section title={t('community.gallery.techniqueLabel')}>
        <CommunityTechniquePills
          selected={filters.technique}
          onChange={setTechnique}
          counts={counts.techniques}
          allCount={counts.techniqueAll}
          touchSize={touchSize}
        />
      </Section>

      <div className="border-t border-stroke-subtle pt-3">
        <Button
          variant="ghost"
          disabled={!hasActiveBrowseFilters(filters) && fitsGapContext === null}
          onClick={() => {
            clearFilters();
            clearFitsGap();
          }}
          className={cn('w-full justify-center text-sm', touchSize && 'min-h-11')}
          data-testid="community-filter-clear-all"
        >
          {t('community.gallery.clearAll')}
        </Button>
      </div>
    </div>
  );
}
