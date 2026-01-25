import { useState, useCallback, useId } from 'react';
import { useTranslation } from '@/i18n';
import {
  StatCard,
  BinIcon,
  FilamentIcon,
  CostIcon,
  TimeIcon,
  SpoolIcon,
} from '@/components/BinList';
import { CategoryBreakdownChart, CategoryStackedBar, CategoryLegend } from '@/components/BinList';
import type { CategoryBreakdown } from '@/utils/binListOperations';

interface BinListDashboardProps {
  /** Total number of unique bin types */
  totalBinTypes: number;
  /** Total number of individual bins */
  totalBins: number;
  /** Total pieces after split optimization */
  totalPieces: number;
  /** Total filament in meters */
  totalFilament: number;
  /** Total estimated cost */
  totalCost: number;
  /** Estimated print time in hours */
  totalPrintTimeHours: number;
  /** Number of spools needed */
  spoolEstimate: number;
  /** Percentage of a spool used */
  spoolPercentage: number;
  /** Whether any bins need splitting */
  hasAnySplits: boolean;
  /** Category breakdown for chart */
  categoryBreakdown: CategoryBreakdown[];
  /** Whether dashboard is collapsible (mobile) */
  collapsible?: boolean;
  /** Initially collapsed (mobile) */
  defaultCollapsed?: boolean;
}

/**
 * Dashboard showing aggregate statistics and category breakdown chart.
 * Used in the expanded bin list modal.
 */
export function BinListDashboard({
  totalBinTypes,
  totalBins,
  totalPieces,
  totalFilament,
  totalCost,
  totalPrintTimeHours,
  spoolEstimate,
  spoolPercentage,
  hasAnySplits,
  categoryBreakdown,
  collapsible = false,
  defaultCollapsed = false,
}: BinListDashboardProps) {
  const t = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const contentId = useId();

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((c) => !c);
  }, []);

  // Format print time nicely
  const formatPrintTime = (hours: number): string => {
    if (hours < 1) {
      return `${Math.round(hours * 60)}m`;
    }
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const header = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-medium text-content">{t('dashboard.statistics')}</h3>
        {collapsible && (
          <span className="text-xs text-content-tertiary">
            {t('dashboard.compactSummary', { bins: totalBins, filament: totalFilament })}</span>
        )}
      </div>
      {collapsible && (
        <button
          onClick={toggleCollapsed}
          className="p-1 text-content-tertiary hover:text-content rounded transition-colors"
          aria-expanded={!isCollapsed}
          aria-controls={contentId}
          aria-label={isCollapsed ? t('dashboard.expandStats') : t('dashboard.collapseStats')}
        >
          <svg
            className={`w-5 h-5 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
    </div>
  );

  if (collapsible && isCollapsed) {
    return (
      <div className="p-3 bg-surface-elevated rounded-lg">
        {header}
        {/* Compact stacked bar when collapsed */}
        <div className="mt-2">
          <CategoryStackedBar breakdown={categoryBreakdown} height="h-3" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {collapsible && <div className="px-1">{header}</div>}

      {/* Stats grid */}
      <div id={contentId} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          icon={<BinIcon />}
          label={t('dashboard.binTypes')}
          value={totalBinTypes}
          title={`${totalBinTypes} unique bin configurations`}
        />
        <StatCard
          icon={<BinIcon />}
          label={t('dashboard.totalBins')}
          value={totalBins}
          title={`${totalBins} individual bins`}
        />
        {hasAnySplits && (
          <StatCard
            icon={<BinIcon />}
            label={t('dashboard.printPieces')}
            value={totalPieces}
            title={`${totalPieces} pieces after split optimization`}
            variant="warning"
          />
        )}
        <StatCard
          icon={<FilamentIcon />}
          label={t('dashboard.filament')}
          value={totalFilament}
          unit="m"
          title={`${totalFilament} meters of filament`}
        />
        <StatCard
          icon={<CostIcon />}
          label={t('dashboard.estCost')}
          value={`$${totalCost.toFixed(2)}`}
          title={`Estimated cost based on filament usage`}
          variant="info"
        />
        <StatCard
          icon={<TimeIcon />}
          label={t('dashboard.printTime')}
          value={formatPrintTime(totalPrintTimeHours)}
          title={`Estimated print time: ${totalPrintTimeHours.toFixed(1)} hours`}
        />
        <StatCard
          icon={<SpoolIcon />}
          label={t('dashboard.spools')}
          value={spoolEstimate}
          unit={`(${spoolPercentage}%)`}
          title={`${spoolEstimate} spool(s) needed (${spoolPercentage}% of spool)`}
        />
      </div>

      {/* Category breakdown */}
      {categoryBreakdown.length > 0 && (
        <div className="bg-surface-elevated rounded-lg p-4">
          <h4 className="text-sm font-medium text-content mb-3">{t('dashboard.filamentByCategory')}</h4>
          <CategoryBreakdownChart breakdown={categoryBreakdown} />
          <div className="mt-3 pt-3 border-t border-stroke-subtle">
            <CategoryLegend breakdown={categoryBreakdown} />
          </div>
        </div>
      )}
    </div>
  );
}
