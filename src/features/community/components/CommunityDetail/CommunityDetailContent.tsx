import { useCallback, useState } from 'react';
import { Button, cn } from '@/design-system';
import { useTranslation } from '@/i18n';
import { GlbViewer } from '@/shared/components/GlbViewer';
import { GradientBackground } from '@/shared/components/preview/GradientBackground';
import type { CommunityDesign, CommunityDesignCounts } from '@/shared/types/community';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import { CATEGORY_LABEL_KEYS } from '../../utils/categoryLabels';

/**
 * Live-name resolution state for the lineage line: snapshot names render
 * immediately, then upgrade to the parent's live name, or degrade to the
 * "no longer published" suffix when the parent 404s.
 */
export type ParentResolution =
  { kind: 'snapshot' } | { kind: 'live'; name: string; authorName: string } | { kind: 'gone' };

interface CommunityDetailContentProps {
  design: CommunityDesign;
  /** Read-only counts from the browse card; null when opened by bare id. */
  counts: CommunityDesignCounts | null;
  isMobile: boolean;
  parentResolution: ParentResolution;
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
}: CommunityDetailContentProps) {
  const t = useTranslation();
  const [angleIndex, setAngleIndex] = useState(0);
  const [viewerReady, setViewerReady] = useState(false);
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
        <div>
          <p className="text-sm text-content-secondary">
            {t('community.detail.byAuthor', { author: design.authorName })}
          </p>
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
          <div className="flex gap-4 text-sm text-content-secondary">
            <span>
              {t('community.detail.stats.likes')}{' '}
              <span className="font-semibold text-content">{counts.likes}</span>
            </span>
            <span>
              {t('community.detail.stats.remixes')}{' '}
              <span className="font-semibold text-content">{counts.remixes}</span>
            </span>
            <span>
              {t('community.detail.stats.exports')}{' '}
              <span className="font-semibold text-content">{counts.exports}</span>
            </span>
          </div>
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

        <p className="text-xs text-content-tertiary">{t('community.detail.license')}</p>
      </div>
    </div>
  );
}
