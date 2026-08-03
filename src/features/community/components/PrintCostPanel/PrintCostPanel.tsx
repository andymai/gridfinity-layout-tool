/**
 * "What it takes to print" on the design detail.
 *
 * Every figure is labelled with where it came from. A model estimate and the
 * median of twelve real prints are different kinds of claim, and collapsing
 * them into one confident-looking number is the failure this whole feature
 * exists to avoid.
 */

import { useMemo } from 'react';
import { Badge } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useSettingsStore } from '@/core/store/settings';
import type { BinParams } from '@/shared/types/bin';
import type { CommunityDesignMetrics } from '@/shared/types/community';
import type { CommunityPrintSummary } from '@/shared/types/communityPrint';
import {
  estimateCommunityPrint,
  fitsPrintBed,
  resolvePrintCost,
} from '@/shared/utils/communityPrintCost';
import type { PrintCostFigure } from '@/shared/utils/communityPrintCost';
import { formatGrams, formatPrintDuration, roundSummaryMinutes } from '../../utils/printFormat';

export interface PrintCostPanelProps {
  params: BinParams;
  metrics: CommunityDesignMetrics;
  /** Null until the print list resolves; the panel shows estimates meanwhile. */
  summary: CommunityPrintSummary | null;
}

function SourceBadge({ source }: { source: PrintCostFigure['source'] }) {
  const t = useTranslation();
  if (source.kind === 'estimated') {
    return (
      <Badge size="sm" tone="neutral" data-testid="cost-source-estimated">
        {t('community.cost.estimated')}
      </Badge>
    );
  }
  return (
    <Badge size="sm" tone="success" data-testid="cost-source-observed">
      {source.sampleSize === 1
        ? t('community.cost.observedOne')
        : t('community.cost.observedOther', { count: source.sampleSize })}
    </Badge>
  );
}

export function PrintCostPanel({ params, metrics, summary }: PrintCostPanelProps) {
  const t = useTranslation();
  const bedWidth = useSettingsStore((s) => s.settings.defaultPrintBedSize);
  const bedDepth = useSettingsStore(
    (s) => s.settings.defaultPrintBedDepth ?? s.settings.defaultPrintBedSize
  );

  // The estimator walks the whole param tree, so it is memoised against the
  // params rather than recomputed on every summary refresh.
  const estimate = useMemo(() => {
    try {
      return estimateCommunityPrint(params);
    } catch {
      // A design published by an older client can carry params this build's
      // estimator does not understand. No estimate is honest; a wrong one is
      // not, and it must not take the detail view down with it.
      return null;
    }
  }, [params]);

  const { time, filament } = resolvePrintCost(estimate, summary);
  const bedFit = fitsPrintBed(metrics, bedWidth, bedDepth);

  if (time.minutes === null && filament.grams === null && bedFit === 'unknown') return null;

  const duration =
    time.minutes === null ? null : formatPrintDuration(roundSummaryMinutes(time.minutes));

  const showsEstimate =
    (duration !== null && time.source.kind === 'estimated') ||
    (filament.grams !== null && filament.source.kind === 'estimated');

  return (
    <div className="space-y-2" data-testid="print-cost-panel">
      <h3 className="text-sm font-medium text-content">{t('community.cost.title')}</h3>

      {duration !== null && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-content-secondary">{t('community.cost.timeLabel')}</span>
          <span className="flex items-center gap-2">
            <span className="font-medium text-content" data-testid="cost-time">
              {duration.hours === 0
                ? t('community.prints.durationMinutes', { minutes: duration.minutes })
                : duration.minutes === 0
                  ? t('community.prints.durationHoursExact', { hours: duration.hours })
                  : t('community.prints.durationHours', {
                      hours: duration.hours,
                      minutes: duration.minutes,
                    })}
            </span>
            <SourceBadge source={time.source} />
          </span>
        </div>
      )}

      {filament.grams !== null && (
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="text-content-secondary">{t('community.cost.filamentLabel')}</span>
          <span className="flex items-center gap-2">
            <span className="font-medium text-content" data-testid="cost-filament">
              {t('community.prints.filament', { grams: formatGrams(filament.grams) })}
            </span>
            <SourceBadge source={filament.source} />
          </span>
        </div>
      )}

      {bedFit !== 'unknown' && (
        <p
          className={bedFit === 'fits' ? 'text-xs text-content-secondary' : 'text-xs text-warning'}
          data-testid={`cost-bed-${bedFit}`}
        >
          {bedFit === 'fits'
            ? t('community.cost.bedFits')
            : t('community.cost.bedTooLarge', {
                width: Math.round(bedWidth),
                depth: Math.round(bedDepth),
              })}
        </p>
      )}

      {/* Only alongside a negative verdict: there it answers the obvious
          "but what if I turn it?", which the check already did. */}
      {bedFit === 'too-large' && (
        <p className="text-xs text-content-tertiary">{t('community.cost.bedHint')}</p>
      )}

      {/* Gated on a figure that is actually rendered, not merely on a source
          kind: with no estimate to show, the note would claim a model figure
          that is not there. Disappears once real reports have taken over. */}
      {showsEstimate && (
        <p className="text-xs text-content-tertiary" data-testid="cost-estimate-note">
          {t('community.cost.estimateNote')}
        </p>
      )}
    </div>
  );
}
