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
  const spools = Math.round(percentage / 10) / 10; // Round to 1 decimal
  return `${spools} spools`;
}

/**
 * Summary footer showing aggregated print list statistics.
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
        <div className="flex justify-between text-sm font-medium">
          <span className="text-content-tertiary">{t('print.summary.total')}</span>
          <span className="text-content">
            {hasAnySplits
              ? t('print.summary.binsAndPieces', { bins: totalBins, pieces: totalPieces })
              : t('print.summary.bins', { count: totalBins })}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stroke-subtle text-xs">
          <div
            className="flex justify-between"
            title={t('print.summary.filamentTooltip')}
          >
            <span className="text-content-tertiary">{t('print.summary.filamentLabel')}</span>
            <span className="text-content">{totalFilament}m</span>
          </div>
          <div className="flex justify-between" title={t('print.summary.costTooltip')}>
            <span className="text-content-tertiary">{t('print.summary.costLabel')}</span>
            <span className="text-content">{formatCost(totalCost)}</span>
          </div>
          <div
            className="flex justify-between"
            title={t('print.summary.printTimeTooltip')}
          >
            <span className="text-content-tertiary">{t('print.summary.timeLabel')}</span>
            <span className="text-content">~{formatPrintTime(totalPrintTimeHours)}</span>
          </div>
          <div className="flex justify-between" title={t('print.summary.spoolTooltip')}>
            <span className="text-content-tertiary">{t('print.summary.spoolLabel')}</span>
            <span className="text-content">{formatSpoolUsage(spoolPercentage)}</span>
          </div>
        </div>
      </div>
    );
  }

  // Desktop layout
  return (
    <div className="px-4 py-3 border-t border-stroke-subtle bg-surface-elevated">
      <div className="flex justify-between font-medium mb-2 text-sm text-content">
        <span>{t('print.summary.title')}</span>
        <span>
          {t('print.summary.totalBins', { count: totalBins })}{hasAnySplits ? `, ${t('print.summary.pieces', { count: totalPieces })}` : ''}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-stroke-subtle text-xs">
        <div
          className="flex justify-between text-content-secondary"
          title={t('print.summary.filamentTooltip')}
        >
          <span className="text-content-tertiary">{t('print.summary.filament', { meters: totalFilament })}</span>
          <span>{totalFilament}m</span>
        </div>
        <div
          className="flex justify-between text-content-secondary"
          title={t('print.summary.costTooltip')}
        >
          <span className="text-content-tertiary">{t('print.summary.cost', { cost: formatCost(totalCost) })}</span>
          <span>{formatCost(totalCost)}</span>
        </div>
        <div
          className="flex justify-between text-content-secondary"
          title={t('print.summary.printTimeTooltip')}
        >
          <span className="text-content-tertiary">{t('print.summary.printTime', { hours: formatPrintTime(totalPrintTimeHours) })}</span>
          <span>~{formatPrintTime(totalPrintTimeHours)}</span>
        </div>
        <div
          className="flex justify-between text-content-secondary"
          title={t('print.summary.spoolTooltip')}
        >
          <span className="text-content-tertiary">{t('print.summary.spoolLabel')}</span>
          <span>{formatSpoolUsage(spoolPercentage)}</span>
        </div>
      </div>
    </div>
  );
}
