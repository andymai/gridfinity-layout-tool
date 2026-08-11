import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, CheckboxRow, IconButton, cn } from '@/design-system';
import { ChevronDownIcon, XIcon } from '@/design-system/Icon';
import { useGapFitStore } from '@/core/store/gapFit';
import { useSessionStore } from '@/core/sync/session/useSession';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import type { CommunityCard, CommunityCategory } from '@/shared/types/community';
import { COMMUNITY_CATEGORIES } from '@/shared/types/community';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import { hasActiveBrowseFilters, useBrowseStore } from '../../store/browseStore';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';
import { formatUnits } from '../CommunityCard/cardDims';
import { CommunitySignInPrompt } from '../SignInPrompt';
import { CommunityTechniquePills } from './CommunityTechniquePills';
import { DimensionFilters } from './DimensionFilters';
import { summariseDimensionFilters } from './dimensionSummary';
import type { FacetCounts } from './facetCounts';
import type { FilterSectionId, FilterSectionState } from './filterSectionPrefs';
import { loadFilterSections, saveFilterSections } from './filterSectionPrefs';

export interface FilterPanelProps {
  items: readonly CommunityCard[];
  counts: FacetCounts;
  /** Roomier rows and 44px targets for the mobile in-place view. */
  touchSize?: boolean;
}

const SECTION_TITLE_CLASS = 'text-xs font-semibold uppercase tracking-wide text-content-tertiary';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className={SECTION_TITLE_CLASS}>{title}</h3>
      {children}
    </section>
  );
}

interface CollapsibleSectionProps {
  title: string;
  /**
   * What the section is currently holding, shown on the header at all times.
   * A folded section must never be able to hide a filter it is applying.
   */
  summary: string;
  expanded: boolean;
  onToggle: () => void;
  touchSize: boolean;
  testId: string;
  children: ReactNode;
}

/**
 * A panel section that folds away. Hand-rolled rather than the design system's
 * Collapsible for one reason: the trigger has to sit inside the section's own
 * h3, or the panel loses the heading that lets a screen reader jump between
 * its sections. The design-system component owns its trigger markup.
 */
function CollapsibleSection({
  title,
  summary,
  expanded,
  onToggle,
  touchSize,
  testId,
  children,
}: CollapsibleSectionProps) {
  const contentId = useId();
  const triggerId = useId();

  return (
    <section>
      <h3>
        <Button
          variant="ghost"
          id={triggerId}
          aria-expanded={expanded}
          aria-controls={contentId}
          onClick={onToggle}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-md p-1.5 -mx-1.5 text-left font-normal',
            touchSize && 'min-h-11'
          )}
          data-testid={testId}
        >
          <ChevronDownIcon
            size="xs"
            aria-hidden="true"
            className={cn(
              'shrink-0 text-content-tertiary transition-transform duration-200',
              !expanded && '-rotate-90'
            )}
          />
          <span className={SECTION_TITLE_CLASS}>{title}</span>
          <span className="ml-auto min-w-0 truncate text-xs text-content-secondary">{summary}</span>
        </Button>
      </h3>
      {/* `hidden`, not a height animation: a collapsed section has to leave the
          tab order and the accessibility tree, and the sliders inside it are
          focusable controls. */}
      <div
        id={contentId}
        role="group"
        aria-labelledby={triggerId}
        hidden={!expanded}
        className="pt-2"
      >
        {children}
      </div>
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

  const sizeSummary = summariseDimensionFilters(filters, {
    width: t('community.gallery.widthAbbrev'),
    depth: t('community.gallery.depthAbbrev'),
    height: t('community.gallery.heightAbbrev'),
  });
  const sizeActive = sizeSummary !== null;
  const techniqueActive = filters.technique !== null;

  // Seeded from the stored preference, but a filter that is already applied on
  // arrival (a shared URL, another tab) opens its section regardless: a stored
  // "collapsed" is a preference about an idle section, not an instruction to
  // fold a live filter out of sight.
  const [sections, setSections] = useState<FilterSectionState>(() => {
    const stored = loadFilterSections();
    return { size: stored.size || sizeActive, technique: stored.technique || techniqueActive };
  });
  const [lastSizeActive, setLastSizeActive] = useState(sizeActive);
  const [lastTechniqueActive, setLastTechniqueActive] = useState(techniqueActive);

  // Adjusted during render rather than in an effect, the same way the rail's
  // own open state is: React re-runs this component before committing, so the
  // folded frame never reaches the DOM.
  //
  // Only the rising edge opens a section, and the opening is not written back
  // to storage: the user's own clicks are the preference, this is a nudge.
  // Functional updates, not `{ ...sections }`: clearing every filter at once
  // flips both flags in the same render, and the second spread of a value
  // captured before the first would drop it.
  if (lastSizeActive !== sizeActive) {
    setLastSizeActive(sizeActive);
    if (sizeActive) setSections((prev) => (prev.size ? prev : { ...prev, size: true }));
  }
  if (lastTechniqueActive !== techniqueActive) {
    setLastTechniqueActive(techniqueActive);
    if (techniqueActive)
      setSections((prev) => (prev.technique ? prev : { ...prev, technique: true }));
  }

  const toggleSection = (id: FilterSectionId): void => {
    const next = { ...sections, [id]: !sections[id] };
    setSections(next);
    saveFilterSections(next);
  };

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
    <div className="space-y-4" data-testid="community-filter-panel">
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

      <CollapsibleSection
        title={t('community.gallery.sizeLabel')}
        summary={sizeSummary ?? t('community.gallery.dimensionAny')}
        expanded={sections.size}
        onToggle={() => toggleSection('size')}
        touchSize={touchSize}
        testId="community-filter-section-size"
      >
        <DimensionFilters items={items} counts={counts} touchSize={touchSize} />
      </CollapsibleSection>

      <CollapsibleSection
        title={t('community.gallery.techniqueLabel')}
        summary={
          filters.technique === null
            ? t('community.gallery.techniqueAll')
            : t(TECHNIQUE_CONFIG[filters.technique].labelKey)
        }
        expanded={sections.technique}
        onToggle={() => toggleSection('technique')}
        touchSize={touchSize}
        testId="community-filter-section-technique"
      >
        <CommunityTechniquePills
          selected={filters.technique}
          onChange={setTechnique}
          counts={counts.techniques}
          allCount={counts.techniqueAll}
          touchSize={touchSize}
        />
      </CollapsibleSection>

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
