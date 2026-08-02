import { useCallback, useState } from 'react';
import { Badge, Button, IconButton, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import { GlbViewer } from '@/shared/components/GlbViewer';
import { GradientBackground } from '@/shared/components/preview/GradientBackground';
import type {
  CommunityDesign,
  CommunityDesignCounts,
  CommunityHiddenReason,
  CommunityReportReason,
} from '@/shared/types/community';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import { HeartGlyph } from '../CommunityCard/CommunityCard';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';
import { REPORT_REASON_LABEL_KEYS } from '../../utils/reportReasonLabels';
import { DirectRemixList } from './DirectRemixList';
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
  /** Optional so fixtures without like wiring keep compiling; absent hides the heart. */
  like?: DetailLikeState | null;
  /** Filters the gallery to this design's author (the author-view entry point). */
  onFilterByAuthor?: () => void;
  /** Present only for the owner of a hidden design; renders the hidden-state notice. */
  ownerModeration?: OwnerModeration | null;
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
  like = null,
  onFilterByAuthor,
  ownerModeration = null,
}: CommunityDetailContentProps) {
  const t = useTranslation();
  const [angleIndex, setAngleIndex] = useState(0);
  const [viewerReady, setViewerReady] = useState(false);
  const [remixListOpen, setRemixListOpen] = useState(false);
  const handleModelReady = useCallback(() => setViewerReady(true), []);

  const poster = design.thumbnails.at(angleIndex) ?? design.thumbnails.at(0) ?? '';
  const { params, metrics, lineage } = design;
  const parentName =
    parentResolution.kind === 'live' ? parentResolution.name : (lineage?.parentName ?? '');
  const parentAuthorName =
    parentResolution.kind === 'live'
      ? parentResolution.authorName
      : (lineage?.parentAuthorName ?? '');

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      {/* Viewer column */}
      <div className="flex flex-col items-center gap-3 bg-surface p-4 md:flex-1 md:justify-center md:overflow-y-auto">
        <div
          className="relative w-full max-w-xl"
          style={{ aspectRatio: '1 / 1', maxHeight: isMobile ? '45vh' : '55vh' }}
        >
          <GlbViewer
            meshUrl={design.meshUrl}
            posterUrl={poster}
            alt={design.name}
            loadBehavior={isMobile ? 'tap' : 'auto'}
            onModelReady={handleModelReady}
            className="h-full w-full"
          >
            <GradientBackground />
          </GlbViewer>
        </div>

        {/* Angle selection swaps the poster, which the loaded canvas covers;
            hide the strip once the model is live so it cannot appear inert. */}
        {!viewerReady && design.thumbnails.length > 1 && (
          <div
            role="group"
            aria-label={t('community.detail.anglesLabel')}
            className="flex items-center gap-2"
          >
            {design.thumbnails.map((thumbnail, index) => (
              <Button
                key={thumbnail}
                variant="ghost"
                touchTarget={false}
                onClick={() => setAngleIndex(index)}
                aria-label={t('community.detail.angleAria', { index: index + 1 })}
                aria-pressed={index === angleIndex}
                className={cn(
                  'h-12 w-12 overflow-hidden rounded-lg border p-0',
                  index === angleIndex ? 'border-accent' : 'border-stroke-subtle'
                )}
              >
                <img src={thumbnail} alt="" className="h-full w-full object-cover" />
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Details rail */}
      <div className="space-y-4 p-4 md:w-80 md:shrink-0 md:overflow-y-auto md:border-l md:border-stroke-subtle">
        {ownerModeration !== null &&
          (ownerModeration.hiddenReason === 'denylist' ? (
            <div
              role="status"
              className="space-y-1 rounded-lg border border-error/30 bg-error/5 px-3 py-2"
              data-testid="community-detail-hidden-notice"
            >
              <Badge tone="error" data-testid="community-denylisted-badge">
                {t('community.mine.badge.accountRestricted')}
              </Badge>
              <p className="text-sm text-content-secondary">
                {t('community.detail.hidden.restricted')}
              </p>
            </div>
          ) : ownerModeration.hiddenReason === 'moderation' ? (
            // A manual takedown already had its review: no report reason and
            // no "a moderator will review it" promise.
            <div
              role="status"
              className="space-y-1 rounded-lg border border-warning/30 bg-warning-muted px-3 py-2"
              data-testid="community-detail-hidden-notice"
            >
              <Badge tone="warning" data-testid="community-moderation-badge">
                {t('community.mine.badge.hiddenModeration')}
              </Badge>
              <p className="text-sm text-content-secondary">
                {t('community.detail.hidden.moderation')}
              </p>
            </div>
          ) : (
            <div
              role="status"
              className="space-y-1 rounded-lg border border-warning/30 bg-warning-muted px-3 py-2"
              data-testid="community-detail-hidden-notice"
            >
              <Badge tone="warning" data-testid="community-hidden-badge">
                {t('community.mine.badge.hiddenReports')}
              </Badge>
              <p className="text-sm text-content-secondary">
                {ownerModeration.hiddenReasonCategory !== null
                  ? t('community.detail.hidden.explanationWithReason', {
                      reason: t(REPORT_REASON_LABEL_KEYS[ownerModeration.hiddenReasonCategory]),
                    })
                  : t('community.detail.hidden.explanation')}
              </p>
              {/* Deliberately no ETA or imminence: "A moderator will review it." verbatim. */}
              <p className="text-xs text-content-tertiary">
                {t('community.detail.hidden.reviewNote')}
              </p>
            </div>
          ))}

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

        {lineage !== null && (
          <p className="text-xs text-content-tertiary">
            {t('community.detail.lineageRemixOf', {
              parent: parentName,
              author: parentAuthorName,
            })}
            {lineage.rootId !== lineage.parentId && (
              <> · {t('community.detail.lineageRoot', { author: lineage.rootAuthorName })}</>
            )}
            {parentResolution.kind === 'gone' && <> · {t('community.detail.lineageGoneSuffix')}</>}
          </p>
        )}

        <SimilarRail design={design} />

        <p className="text-xs text-content-tertiary">{t('community.detail.license')}</p>
      </div>
    </div>
  );
}
