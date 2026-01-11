import { useTranslation } from 'react-i18next';
import { formatPrintTime, formatCost } from '../../utils/printEstimates';

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
  const { t } = useTranslation(['print']);

  /** Format spool usage: percentage if under 100%, spool count if over */
  const formatSpoolUsage = (percentage: number): string => {
    if (percentage < 100) {
      return t('print:summary.spoolPercentage', { percentage });
    }
    const spools = Math.round(percentage / 10) / 10; // Round to 1 decimal
    return t('print:summary.spoolCount', { count: spools });
  };
  if (compact) {
    // Mobile compact layout
    return (
      <div className="p-3 rounded-lg bg-surface-elevated space-y-2">
        <div className="flex justify-between text-sm font-medium">
          <span className="text-content-tertiary">{t('print:summary.total')}</span>
          <span className="text-content">
            {hasAnySplits
              ? t('print:summary.totalBinsWithPieces', { bins: totalBins, pieces: totalPieces })
              : t('print:summary.totalBinsShort', { count: totalBins })}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stroke-subtle text-xs">
          <div className="flex justify-between" title={t('print:summary.filamentHint')}>
            <span className="text-content-tertiary">{t('print:summary.filament')}</span>
            <span className="text-content">{t('print:summary.filamentValue', { meters: totalFilament })}</span>
          </div>
          <div className="flex justify-between" title={t('print:summary.costHint')}>
            <span className="text-content-tertiary">{t('print:summary.cost')}</span>
            <span className="text-content">{formatCost(totalCost)}</span>
          </div>
          <div className="flex justify-between" title={t('print:summary.printTimeHint')}>
            <span className="text-content-tertiary">{t('print:summary.time')}</span>
            <span className="text-content">~{formatPrintTime(totalPrintTimeHours)}</span>
          </div>
          <div className="flex justify-between" title={t('print:summary.spoolHint')}>
            <span className="text-content-tertiary">{t('print:summary.spool')}</span>
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
        <span>{t('print:summary.total')}</span>
        <span>
          {hasAnySplits
            ? t('print:summary.totalBinsWithPiecesFull', { bins: totalBins, pieces: totalPieces })
            : t('print:summary.totalBinsShort', { count: totalBins })}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-stroke-subtle text-xs">
        <div className="flex justify-between text-content-secondary" title={t('print:summary.filamentHint')}>
          <span className="text-content-tertiary">{t('print:summary.filament')}</span>
          <span>{t('print:summary.filamentValue', { meters: totalFilament })}</span>
        </div>
        <div className="flex justify-between text-content-secondary" title={t('print:summary.costHint')}>
          <span className="text-content-tertiary">{t('print:summary.estCost')}</span>
          <span>{formatCost(totalCost)}</span>
        </div>
        <div className="flex justify-between text-content-secondary" title={t('print:summary.printTimeHint')}>
          <span className="text-content-tertiary">{t('print:summary.printTime')}</span>
          <span>~{formatPrintTime(totalPrintTimeHours)}</span>
        </div>
        <div className="flex justify-between text-content-secondary" title={t('print:summary.spoolHint')}>
          <span className="text-content-tertiary">{t('print:summary.spool')}</span>
          <span>{formatSpoolUsage(spoolPercentage)}</span>
        </div>
      </div>
    </div>
  );
}
