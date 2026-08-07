import { useState } from 'react';
import type { ReactNode } from 'react';
import { Badge, Button, IconButton, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import type {
  CommunityDesign,
  CommunityDesignCounts,
  CommunityHiddenReason,
  CommunityReportReason,
} from '@/shared/types/community';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import { HeartGlyph } from '../CommunityCard/CommunityCard';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';
import type { DesignImage } from '../../utils/designMedia';
import { REPORT_REASON_LABEL_KEYS } from '../../utils/reportReasonLabels';
import { DesignMediaPanel } from './DesignMediaPanel';
import { DirectRemixList } from './DirectRemixList';
import { RemixLineage } from './RemixLineage';
import { SimilarRail } from './SimilarRail';

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
  /** Present only for the owner of a hidden design; renders the hidden-state notice. */
  ownerModeration?: OwnerModeration | null;
  /** Opens the print-report dialog; absent hides the CTA entirely. */
  onAddPrint?: () => void;
  /** Switches the CTA between posting a first print and editing an existing one. */
  hasOwnPrint?: boolean;
  /** Rendered below the CTA; absent while prints are unavailable. */
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

function formatMm(value: number): string {
  return String(Number(value.toFixed(1)));
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
  ownerModeration = null,
  onAddPrint,
  hasOwnPrint = false,
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
            <div className="flex items-center gap-4 text-sm text-content-secondary">
              <span className="inline-flex items-center gap-1">
                {like !== null && (
                  <IconButton
                    aria-label={t(like.likedByMe ? 'community.like.unlike' : 'community.like.like')}
                    pressed={like.likedByMe}
                    size="sm"
                    touchTarget={isMobile}
                    onClick={like.onToggle}
                    className={cn(like.likedByMe && 'text-accent')}
                    data-testid="community-detail-like"
                  >
                    <HeartGlyph filled={like.likedByMe} />
                  </IconButton>
                )}
                {t('community.detail.stats.likes')}{' '}
                <span className="font-semibold text-content">{counts.likes}</span>
              </span>
              {counts.remixes > 0 ? (
                <Button
                  variant="ghost"
                  touchTarget={isMobile}
                  aria-expanded={remixListOpen}
                  aria-label={t('community.detail.buildsOnThis', { count: counts.remixes })}
                  onClick={() => setRemixListOpen((open) => !open)}
                  className="h-auto p-0 text-sm font-normal text-content-secondary underline-offset-2 hover:underline"
                  data-testid="community-detail-remixes"
                >
                  {t('community.detail.stats.remixes')}{' '}
                  <span className="font-semibold text-content">{counts.remixes}</span>
                </Button>
              ) : (
                <span>
                  {t('community.detail.stats.remixes')}{' '}
                  <span className="font-semibold text-content">{counts.remixes}</span>
                </span>
              )}
              <span>
                {t('community.detail.stats.exports')}{' '}
                <span className="font-semibold text-content">{counts.exports}</span>
              </span>
            </div>
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
              width: params.width,
              depth: params.depth,
              height: params.height,
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
        {onAddPrint !== undefined && (
          <Button
            variant={hasOwnPrint ? 'ghost' : 'secondary'}
            touchTarget={isMobile}
            onClick={onAddPrint}
            className="w-full justify-center"
            data-testid="community-detail-add-print"
          >
            {t(hasOwnPrint ? 'community.print.editCta' : 'community.print.cta')}
          </Button>
        )}

        {printsSlot}

        <SimilarRail design={design} />

        <p className="text-xs text-content-tertiary">{t('community.detail.license')}</p>
      </div>
    </div>
  );
}
