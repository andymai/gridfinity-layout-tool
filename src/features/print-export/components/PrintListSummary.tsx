import { formatPrintTime, formatCost } from '@/features/print-export/utils/printEstimates';

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
  if (compact) {
    // Mobile compact layout
    return (
      <div className="p-3 rounded-lg bg-surface-elevated space-y-2">
        <div className="flex justify-between text-sm font-medium">
          <span className="text-content-tertiary">Total</span>
          <span className="text-content">
            {totalBins} bins{hasAnySplits ? `, ${totalPieces} pcs` : ''}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stroke-subtle text-xs">
          <div
            className="flex justify-between"
            title="Estimated 1.75mm PLA usage based on bin dimensions"
          >
            <span className="text-content-tertiary">Filament</span>
            <span className="text-content">{totalFilament}m</span>
          </div>
          <div className="flex justify-between" title="Based on $15/kg filament cost">
            <span className="text-content-tertiary">Cost</span>
            <span className="text-content">{formatCost(totalCost)}</span>
          </div>
          <div
            className="flex justify-between"
            title="Based on 0.4mm nozzle, 0.2mm layer height, 15% infill"
          >
            <span className="text-content-tertiary">Time</span>
            <span className="text-content">~{formatPrintTime(totalPrintTimeHours)}</span>
          </div>
          <div className="flex justify-between" title="Based on 1kg spool (~330m of 1.75mm PLA)">
            <span className="text-content-tertiary">Spool</span>
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
        <span>Total</span>
        <span>
          {totalBins} bins{hasAnySplits ? `, ${totalPieces} pieces` : ''}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-2 border-t border-stroke-subtle text-xs">
        <div
          className="flex justify-between text-content-secondary"
          title="Estimated 1.75mm PLA usage based on bin dimensions"
        >
          <span className="text-content-tertiary">Filament</span>
          <span>{totalFilament}m</span>
        </div>
        <div
          className="flex justify-between text-content-secondary"
          title="Based on $15/kg filament cost"
        >
          <span className="text-content-tertiary">Est. Cost</span>
          <span>{formatCost(totalCost)}</span>
        </div>
        <div
          className="flex justify-between text-content-secondary"
          title="Based on 0.4mm nozzle, 0.2mm layer height, 15% infill"
        >
          <span className="text-content-tertiary">Print Time</span>
          <span>~{formatPrintTime(totalPrintTimeHours)}</span>
        </div>
        <div
          className="flex justify-between text-content-secondary"
          title="Based on 1kg spool (~330m of 1.75mm PLA)"
        >
          <span className="text-content-tertiary">Spool</span>
          <span>{formatSpoolUsage(spoolPercentage)}</span>
        </div>
      </div>
    </div>
  );
}
