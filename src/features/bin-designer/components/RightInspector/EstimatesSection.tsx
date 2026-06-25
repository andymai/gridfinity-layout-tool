/**
 * Presentational — the inspector body owns the single useExport() and passes
 * values in, so this readout can never disagree with the export dialog's.
 * Triangles show a dash until the mesh lands (param-derived estimates show
 * immediately).
 */

import { useTranslation } from '@/i18n';
import {
  formatFilament,
  formatPrintTime,
  type PrintEstimate,
} from '@/features/bin-designer/utils/printEstimates';

interface EstimatesSectionProps {
  readonly estimates: PrintEstimate;
  readonly triangleCount: number | null;
}

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-content-tertiary">{label}</span>
      <span className="font-medium tabular-nums text-content-secondary">{value}</span>
    </div>
  );
}

export function EstimatesSection({ estimates, triangleCount }: EstimatesSectionProps) {
  const t = useTranslation();
  return (
    <div className="space-y-1.5">
      <Row
        label={t('binDesigner.inspector.estimates.filament')}
        value={formatFilament(estimates.metersFilament)}
      />
      <Row
        label={t('binDesigner.inspector.estimates.weight')}
        value={`${estimates.gramsFilament}g`}
      />
      <Row
        label={t('binDesigner.inspector.estimates.time')}
        value={formatPrintTime(estimates.printTimeMinutes)}
      />
      <Row
        label={t('binDesigner.inspector.estimates.cost')}
        value={`$${estimates.costUSD.toFixed(2)}`}
      />
      <Row
        label={t('binDesigner.inspector.estimates.triangles')}
        value={triangleCount === null ? '—' : triangleCount.toLocaleString()}
      />
    </div>
  );
}
