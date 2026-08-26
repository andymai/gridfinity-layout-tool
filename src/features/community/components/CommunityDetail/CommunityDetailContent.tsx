import { useState } from 'react';
import type { ReactNode } from 'react';
import { Badge, Button, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import type {
  CommunityDesign,
  CommunityDesignCounts,
  CommunityHiddenReason,
  CommunityReportReason,
} from '@/shared/types/community';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import { SupporterBadge } from '@/shared/components/SupporterBadge';
import { HeartGlyph } from '../CommunityCard/CommunityCard';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';
import type { DesignImage } from '../../utils/designMedia';
import { REPORT_REASON_LABEL_KEYS } from '../../utils/reportReasonLabels';
import { DesignMediaPanel } from './DesignMediaPanel';
import { DirectRemixList } from './DirectRemixList';
import { RemixLineage } from './RemixLineage';
import { SimilarRail } from './SimilarRail';
import { formatMm } from '@/shared/utils/format';

/**
 * Live-name resolution state for the lineage line: snapshot names render
 * immediately, then upgrade to the parent's live name, or degrade to the
 * "no longer published" suffix when the parent 404s.
 */
export type ParentResolution =
  { kind: 'snapshot' } | { kind: 'live'; name: string; authorName: string } | { kind: 'gone' };

/** Like-toggle wiring for the stats row; null hides the heart (no browse-store card to patch). */
export interface DetailLikeState {
  likedByMe: boolean;
  onToggle: () => void;
}

/**
 * Owner-facing hidden-state explanation, passed only when the caller owns
 * the design and it is hidden. `hiddenReason` null reads as a report
 * auto-hide (the pre-field default).
 */
export interface OwnerModeration {
  hiddenReason: CommunityHiddenReason | null;
  hiddenReasonCategory: CommunityReportReason | null;
}

interface CommunityDetailContentProps {
  design: CommunityDesign;
  /** Read-only counts from the browse card; null when opened by bare id. */
  counts: CommunityDesignCounts | null;
  isMobile: boolean;
  parentResolution: ParentResolution;
  /** Every render and print photo, in the order the lightbox steps through them. */
  images: readonly DesignImage[];
  /** Opens the enlarged view on an index of `images`. */
  onOpenLightbox: (index: number) => void;
  /**
   * The design-acting buttons (remix, place, edit original). They sit in the
   * rail under the author rather than in the dialog footer: the decision button
   * should not be the thing you scroll past.
   */
  primaryActions?: ReactNode;
  /** Optional so fixtures without like wiring keep compiling; absent hides the heart. */
  like?: DetailLikeState | null;
  /** Filters the gallery to this design's author (the author-view entry point). */
  onFilterByAuthor?: () => void;
  /** Whether this design's author is a badged Ko-fi supporter. */
  authorIsSupporter?: boolean;
  /** Present only for the owner of a hidden design; renders the hidden-state notice. */
  ownerModeration?: OwnerModeration | null;
  /** The prints section, which carries its own post/edit CTA; absent while prints are unavailable. */
  printsSlot?: ReactNode;
  /** Print cost and bed fit; sits with the dimensions, which is the same question. */
  costSlot?: ReactNode;
  /** Navigates to an ancestor design; absent renders the lineage read-only. */
  onOpenDesign?: (designId: string) => void;
}

interface HiddenNoticeCopy {
  readonly tone: 'error' | 'warning';
  readonly frameClass: string;
  readonly badgeTestId: string;
  readonly badgeKey: string;
  readonly body: string;
  /** "A moderator will review it.", so only a hide that still awaits one. */
  readonly reviewNote: boolean;
}

function hiddenNoticeCopy(
  moderation: OwnerModeration,
  t: ReturnType<typeof useTranslation>
): HiddenNoticeCopy {
  switch (moderation.hiddenReason) {
    case 'denylist':
      return {
        tone: 'error',
        frameClass: 'border-error/30 bg-error/5',
        badgeTestId: 'community-denylisted-badge',
        badgeKey: 'community.mine.badge.accountRestricted',
        body: t('community.detail.hidden.restricted'),
        reviewNote: false,
      };
    case 'moderation':
      // A manual takedown already had its review: no report reason and no
      // "a moderator will review it" promise.
      return {
        tone: 'warning',
        frameClass: 'border-warning/30 bg-warning-muted',
        badgeTestId: 'community-moderation-badge',
        badgeKey: 'community.mine.badge.hiddenModeration',
        body: t('community.detail.hidden.moderation'),
        reviewNote: false,
      };
    default:
      return {
        tone: 'warning',
        frameClass: 'border-warning/30 bg-warning-muted',
        badgeTestId: 'community-hidden-badge',
        badgeKey: 'community.mine.badge.hiddenReports',
        body:
          moderation.hiddenReasonCategory !== null
            ? t('community.detail.hidden.explanationWithReason', {
                reason: t(REPORT_REASON_LABEL_KEYS[moderation.hiddenReasonCategory]),
              })
            : t('community.detail.hidden.explanation'),
        reviewNote: true,
      };
  }
}

interface StatTileDisclosure {
  readonly expanded: boolean;
  readonly label: string;
  readonly onToggle: () => void;
  readonly testId: string;
}

interface StatTileProps {
  label: string;
  value: number;
  /** Makes the tile a button; the count reads the same either way. */
  disclosure?: StatTileDisclosure;
  isMobile: boolean;
  testId?: string;
}

/**
 * A zero is rendered, not hidden: the row's width would otherwise change as a
 * design gains its first like. It drops to the tertiary colour instead, so a
 * new design does not read as a wall of bold noughts.
 */
function StatTile({ label, value, disclosure, isMobile, testId }: StatTileProps) {
  const body = (
    <>
      <span
        className={cn(
          'block text-lg font-semibold leading-tight',
          value > 0 ? 'text-content' : 'text-content-tertiary'
        )}
      >
        {value}
      </span>
      <span className="block text-xs text-content-secondary">{label}</span>
    </>
  );

  if (disclosure === undefined) {
    return (
      <div className="p-1" data-testid={testId}>
        {body}
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      // A tile is small by design, so the hit area has to be asked for
      // explicitly. The sentence-fragment button this replaced had it.
      touchTarget={isMobile}
      aria-expanded={disclosure.expanded}
      aria-label={disclosure.label}
      onClick={disclosure.onToggle}
      className="h-auto flex-col gap-0 p-1 font-normal underline-offset-2 hover:underline"
      data-testid={disclosure.testId}
    >
      {body}
    </Button>
  );
}

function HiddenNotice({ moderation }: { moderation: OwnerModeration }) {
  const t = useTranslation();
  const copy = hiddenNoticeCopy(moderation, t);

  return (
    <div
      role="status"
      className={cn('space-y-1 rounded-lg border px-3 py-2', copy.frameClass)}
      data-testid="community-detail-hidden-notice"
    >
      <Badge tone={copy.tone} data-testid={copy.badgeTestId}>
        {t(copy.badgeKey)}
      </Badge>
      <p className="text-sm text-content-secondary">{copy.body}</p>
      {copy.reviewNote && (
        // Deliberately no ETA or imminence: "A moderator will review it." verbatim.
        <p className="text-xs text-content-tertiary">{t('community.detail.hidden.reviewNote')}</p>
      )}
    </div>
  );
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function CommunityDetailContent({
  design,
  counts,
  isMobile,
  parentResolution,
  images,
  onOpenLightbox,
  primaryActions,
  like = null,
  onFilterByAuthor,
  authorIsSupporter,
  ownerModeration = null,
  printsSlot,
  costSlot,
  onOpenDesign,
}: CommunityDetailContentProps) {
  const t = useTranslation();
  const [remixListOpen, setRemixListOpen] = useState(false);

  const { params, metrics, lineage } = design;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto scrollbar-thin md:flex-row md:overflow-hidden">
      <DesignMediaPanel
        design={design}
        images={images}
        isMobile={isMobile}
        onOpenLightbox={onOpenLightbox}
      />

      {/* Details rail */}
      {/* `scrollbar-thin` is a plain CSS class, not a Tailwind utility, so it
          takes no `md:` prefix. Harmless unprefixed: it only styles a scrollbar
          that exists, and this rail only scrolls at md and up. */}
      <div className="space-y-4 p-6 scrollbar-thin md:w-80 md:shrink-0 md:overflow-y-auto md:border-l md:border-stroke-subtle">
        {ownerModeration !== null && <HiddenNotice moderation={ownerModeration} />}

        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            {onFilterByAuthor !== undefined ? (
              <Button
                variant="ghost"
                // 44px hit area on touch layouts, mirroring the card's author
                // button: a mis-tap in the fullscreen sheet falls through to
                // surrounding content.
                touchTarget={isMobile}
                aria-label={t('community.authorFilterAria', { author: design.authorName })}
                onClick={onFilterByAuthor}
                className="h-auto justify-start p-0 text-sm font-normal text-content-secondary underline-offset-2 hover:underline"
                data-testid="community-detail-author"
              >
                {t('community.detail.byAuthor', { author: design.authorName })}
              </Button>
            ) : (
              <p className="text-sm text-content-secondary">
                {t('community.detail.byAuthor', { author: design.authorName })}
              </p>
            )}
            {authorIsSupporter === true && <SupporterBadge source="community_detail" />}
          </div>
          <p className="mt-1 text-xs text-content-tertiary">
            {t('community.detail.publishedOn', { date: formatDate(design.createdAt) })}
            {design.updatedAt > design.createdAt && (
              <> · {t('community.detail.updatedOn', { date: formatDate(design.updatedAt) })}</>
            )}
          </p>
        </div>

        {primaryActions !== undefined && (
          <div className="flex flex-col gap-2" data-testid="community-detail-primary-actions">
            {primaryActions}
          </div>
        )}

        {counts !== null && (
          <>
            {/* The tiles only report; the one thing a visitor can do about them
                is the like button of its own underneath. */}
            <div
              className={cn(
                'grid gap-2 text-center',
                // Absent (not zero) means the card snapshot predates the field,
                // and an unknown count must not read as a measured zero. The
                // print list below is the full account either way.
                counts.prints === undefined ? 'grid-cols-3' : 'grid-cols-4'
              )}
              data-testid="community-detail-stats"
            >
              <StatTile
                label={t('community.detail.stats.likes')}
                value={counts.likes}
                isMobile={isMobile}
              />
              <StatTile
                label={t('community.detail.stats.remixes')}
                value={counts.remixes}
                isMobile={isMobile}
                // The tile is the only route to the remix list.
                disclosure={
                  counts.remixes > 0
                    ? {
                        expanded: remixListOpen,
                        label: t('community.detail.buildsOnThis', { count: counts.remixes }),
                        onToggle: () => setRemixListOpen((open) => !open),
                        testId: 'community-detail-remixes',
                      }
                    : undefined
                }
              />
              {/* Downloads, not prints. counts.exports is file downloads, and
                  labelling it "Prints" put a hard 0 beside a design whose own
                  print list was rendering below it. */}
              <StatTile
                label={t('community.detail.stats.downloads')}
                value={counts.exports}
                isMobile={isMobile}
              />
              {counts.prints !== undefined && (
                <StatTile
                  label={t('community.detail.stats.prints')}
                  value={counts.prints}
                  isMobile={isMobile}
                  testId="community-detail-prints-stat"
                />
              )}
            </div>

            {like !== null && (
              <Button
                variant={like.likedByMe ? 'secondary' : 'ghost'}
                touchTarget={isMobile}
                aria-pressed={like.likedByMe}
                onClick={like.onToggle}
                className={cn(
                  'w-full justify-center gap-2',
                  like.likedByMe ? 'text-accent' : undefined
                )}
                data-testid="community-detail-like"
              >
                <HeartGlyph filled={like.likedByMe} />
                {t(like.likedByMe ? 'community.like.unlike' : 'community.like.like')}
              </Button>
            )}

            {remixListOpen && counts.remixes > 0 && (
              <DirectRemixList designId={design.id} remixCount={counts.remixes} />
            )}
          </>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-surface-secondary px-2 py-1 text-xs uppercase tracking-wide text-content-secondary">
            {t(CATEGORY_LABEL_KEYS[design.category])}
          </span>
          {design.techniques.map((technique) => (
            <span
              key={technique}
              className="rounded bg-surface-secondary px-2 py-1 text-xs uppercase tracking-wide text-content-tertiary"
            >
              {t(TECHNIQUE_CONFIG[technique].labelKey)}
            </span>
          ))}
        </div>

        <div>
          <h3 className="mb-1 text-sm font-medium text-content">
            {t('community.detail.descriptionTitle')}
          </h3>
          {design.description.trim() === '' ? (
            <p className="text-sm text-content-tertiary">{t('community.detail.noDescription')}</p>
          ) : (
            <p className="whitespace-pre-line break-words text-sm text-content-secondary">
              {design.description}
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-1 text-sm font-medium text-content">
            {t('community.detail.dimensionsTitle')}
          </h3>
          <p className="text-sm text-content-secondary">
            {t('community.detail.gridUnits', {
              width: params?.width ?? design.envelope?.width ?? 0,
              depth: params?.depth ?? design.envelope?.depth ?? 0,
              height:
                params?.height ??
                Math.max(1, Math.ceil(metrics.height / (design.envelope?.heightUnitMm ?? 7))),
            })}
          </p>
          <p className="text-xs text-content-tertiary">
            {t('community.detail.millimeters', {
              width: formatMm(metrics.width),
              depth: formatMm(metrics.depth),
              height: formatMm(metrics.height),
            })}
          </p>
        </div>

        {costSlot}

        {lineage !== null && (
          <RemixLineage
            lineage={lineage}
            parentResolution={parentResolution}
            designName={design.name}
            onOpenDesign={onOpenDesign}
          />
        )}

        {/* Sits above the similar rail: whether this printed for other people
            is a decision input, and the rail is where attention goes next. */}
        {printsSlot}

        <SimilarRail design={design} />

        <p className="text-xs text-content-tertiary">{t('community.detail.license')}</p>
      </div>
    </div>
  );
}
