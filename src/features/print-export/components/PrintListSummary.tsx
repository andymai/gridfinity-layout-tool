import { formatPrintTime, formatCost } from '@/features/print-export/utils/printEstimates';
import { useTranslation } from '@/i18n';

interface PrintListSummaryProps {
  totalBins: number;
  totalPieces: number;
  totalFilament: number;
  totalCost: number;
  totalPrintTimeHours: number;
  spoolPercentage: number;
  hasAnySplits: boolean;
  /** Compact mode for mobile */
  compact?: boolean;
}

/** Format spool usage: percentage if under 100%, spool count if over */
function formatSpoolUsage(percentage: number): string {
  if (percentage < 100) {
    return `${percentage}%`;
  }
  const spools = Math.round(percentage / 10) / 10;
  return spools === 1 ? '1 spool' : `${spools} spools`;
}

/** Get progress bar color based on spool usage level */
function getSpoolColor(percentage: number): string {
  if (percentage >= 80) return 'var(--color-warning)';
  return 'var(--color-info)';
}

/**
 * Summary footer showing aggregated print list statistics.
 * Compact layout with visual hierarchy: Time & Cost emphasized.
 */
export function PrintListSummary({
  totalBins,
  totalPieces,
  totalFilament,
  totalCost,
  totalPrintTimeHours,
  spoolPercentage,
  hasAnySplits,
  compact = false,
}: PrintListSummaryProps) {
  const t = useTranslation();

  if (compact) {
    // Mobile compact layout
    return (
      <div className="p-3 rounded-lg bg-surface-elevated space-y-2">
        {/* Primary row: Time & Cost (emphasized) + bins count */}
        <div className="flex justify-between items-baseline">
          <div className="flex items-baseline gap-3">
            <span
              className="text-sm font-semibold text-content tabular-nums"
              title={t('print.summary.printTimeTooltip')}
            >
              ~{formatPrintTime(totalPrintTimeHours)}
            </span>
            <span
              className="text-sm font-semibold text-content tabular-nums"
              title={t('print.summary.costTooltip')}
            >
              {formatCost(totalCost)}
            </span>
          </div>
          <span className="text-xs text-content tabular-nums">
            {t('print.summary.bins', { count: totalBins })}
            {hasAnySplits && (
              <span className="text-content-tertiary">
                {' → '}
                {t('print.summary.piecesShort', { count: totalPieces })}
              </span>
            )}
          </span>
        </div>

        {/* Secondary row: Filament + Spool with progress */}
        <div className="flex justify-between items-center text-xs pt-2 border-t border-stroke-subtle">
          <span
            className="text-content-tertiary tabular-nums"
            title={t('print.summary.filamentTooltip')}
          >
            {t('print.summary.filament', { meters: totalFilament })}
          </span>
          <div className="flex items-center gap-2" title={t('print.summary.spoolTooltip')}>
            <span className="text-content-tertiary">{t('print.summary.spoolLabel')}:</span>
            <span className="text-content tabular-nums">{formatSpoolUsage(spoolPercentage)}</span>
            {spoolPercentage < 100 && (
              <div
                className="w-12 h-1.5 rounded-full overflow-hidden bg-surface"
                role="progressbar"
                aria-label={t('print.summary.spoolLabel')}
                aria-valuenow={spoolPercentage}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${spoolPercentage}%`,
                    backgroundColor: getSpoolColor(spoolPercentage),
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout - compact rows with visual hierarchy
  return (
    <div className="px-4 py-3 border-t border-stroke-subtle bg-surface-elevated">
      {/* Primary row: Time & Cost (emphasized) + Bins */}
      <div className="flex justify-between items-baseline mb-2">
        <div className="flex items-baseline gap-4">
          <div title={t('print.summary.printTimeTooltip')}>
            <span className="text-xs text-content-tertiary mr-1">
              {t('print.summary.timeLabel')}
            </span>
            <span className="text-sm font-semibold text-content tabular-nums">
              ~{formatPrintTime(totalPrintTimeHours)}
            </span>
          </div>
          <div title={t('print.summary.costTooltip')}>
            <span className="text-xs text-content-tertiary mr-1">
              {t('print.summary.costLabel')}
            </span>
            <span className="text-sm font-semibold text-content tabular-nums">
              {formatCost(totalCost)}
            </span>
          </div>
        </div>
        <span className="text-sm text-content tabular-nums">
          {t('print.summary.bins', { count: totalBins })}
          {hasAnySplits && (
            <span className="text-content-tertiary">
              {' → '}
              {t('print.summary.piecesShort', { count: totalPieces })}
            </span>
          )}
        </span>
      </div>

      {/* Secondary row: Filament + Spool with progress bar */}
      <div className="flex justify-between items-center text-xs pt-2 border-t border-stroke-subtle">
        <span
          className="text-content-tertiary tabular-nums"
          title={t('print.summary.filamentTooltip')}
        >
          {t('print.summary.filament', { meters: totalFilament })}
        </span>
        <div className="flex items-center gap-2" title={t('print.summary.spoolTooltip')}>
          <span className="text-content-tertiary">{t('print.summary.spoolLabel')}</span>
          <span className="text-content tabular-nums">{formatSpoolUsage(spoolPercentage)}</span>
          {spoolPercentage < 100 && (
            <div
              className="w-16 h-1.5 rounded-full overflow-hidden bg-surface"
              role="progressbar"
              aria-label={t('print.summary.spoolLabel')}
              aria-valuenow={spoolPercentage}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${spoolPercentage}%`,
                  backgroundColor: getSpoolColor(spoolPercentage),
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
