import { useTranslation } from '@/i18n';
import type { CommunityPrintSummary } from '@/shared/types/communityPrint';
import {
  formatGrams,
  formatMillimetres,
  formatPrintDuration,
  roundSummaryMinutes,
} from '../../utils/printFormat';

export interface PrintSummaryProps {
  summary: CommunityPrintSummary;
}

/**
 * The rollup a visitor reads instead of the list.
 *
 * Two deliberate choices: the fit verdicts get their own line rather than
 * being folded into the settings sentence, because "4 adjusted" is the part
 * that changes whether you print this at all; and every figure is dropped
 * rather than shown as zero when nobody reported it, so an absent number never
 * reads as a measured one.
 */
export function PrintSummary({ summary }: PrintSummaryProps) {
  const t = useTranslation();

  if (summary.count === 0) return null;

  const facts: string[] = [];

  if (summary.commonMaterial !== null && summary.commonLayerHeightMm !== null) {
    facts.push(
      t('community.prints.summaryUsually', {
        material:
          summary.commonMaterial === 'other'
            ? t('community.print.otherOption')
            : summary.commonMaterial.toUpperCase(),
        layer: formatMillimetres(summary.commonLayerHeightMm),
      })
    );
  }

  if (summary.medianPrintMinutes !== null) {
    const rounded = roundSummaryMinutes(summary.medianPrintMinutes);
    const { hours, minutes } = formatPrintDuration(rounded);
    const duration =
      hours === 0
        ? t('community.prints.durationMinutes', { minutes })
        : minutes === 0
          ? t('community.prints.durationHoursExact', { hours })
          : t('community.prints.durationHours', { hours, minutes });
    facts.push(t('community.prints.summaryTime', { duration }));
  }

  if (summary.medianFilamentGrams !== null) {
    facts.push(
      t('community.prints.summaryFilament', { grams: formatGrams(summary.medianFilamentGrams) })
    );
  }

  const verdicts: string[] = [];
  if (summary.asDesigned > 0) {
    verdicts.push(t('community.prints.verdictAsDesigned', { count: summary.asDesigned }));
  }
  if (summary.adjusted > 0) {
    verdicts.push(t('community.prints.verdictAdjusted', { count: summary.adjusted }));
  }
  if (summary.didNotFit > 0) {
    verdicts.push(t('community.prints.verdictDidNotFit', { count: summary.didNotFit }));
  }

  return (
    <div
      className="rounded-lg border border-stroke-subtle bg-surface-secondary px-3 py-2"
      data-testid="print-summary"
    >
      <p className="text-sm font-medium text-content">
        {summary.count === 1
          ? t('community.prints.countOne')
          : t('community.prints.countOther', { count: summary.count })}
      </p>

      {facts.length > 0 && (
        <p className="mt-0.5 text-xs text-content-secondary" data-testid="print-summary-facts">
          {facts.join(' · ')}
        </p>
      )}

      {verdicts.length > 0 && (
        <p className="mt-1 text-xs text-content" data-testid="print-summary-verdicts">
          {verdicts.join(' · ')}
        </p>
      )}
    </div>
  );
}
