import { formatUnits } from '../CommunityCard/cardDims';

export interface DimensionSummaryFilters {
  readonly widthMin: number | null;
  readonly widthMax: number | null;
  readonly depthMin: number | null;
  readonly depthMax: number | null;
  readonly maxHeight: number | null;
}

export interface DimensionAxisLabels {
  readonly width: string;
  readonly depth: string;
  readonly height: string;
}

function axisSummary(label: string, min: number | null, max: number | null): string | null {
  if (min === null && max === null) return null;
  if (min !== null && max !== null) {
    // A single value reads better than "2–2".
    if (min === max) return `${label} ${formatUnits(min)}`;
    return `${label} ${formatUnits(min)}–${formatUnits(max)}`;
  }
  if (min !== null) return `${label} ${formatUnits(min)}+`;
  return `${label} ≤${formatUnits(max ?? 0)}`;
}

/**
 * One-line summary of the size constraints, for the chip that stands in for
 * them once the five selects live behind the filter disclosure.
 *
 * Without it the constraints become invisible the moment the panel closes,
 * and a gallery filtered down to three cards looks like a gallery with three
 * cards in it. Returns null when nothing is constrained.
 */
export function summariseDimensionFilters(
  filters: DimensionSummaryFilters,
  labels: DimensionAxisLabels
): string | null {
  const parts = [
    axisSummary(labels.width, filters.widthMin, filters.widthMax),
    axisSummary(labels.depth, filters.depthMin, filters.depthMax),
    // Height is a ceiling only; there is no minimum filter for it.
    axisSummary(labels.height, null, filters.maxHeight),
  ].filter((part): part is string => part !== null);

  return parts.length === 0 ? null : parts.join(' · ');
}
