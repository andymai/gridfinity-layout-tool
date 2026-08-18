/**
 * Store-connected wrapper around {@link BinDimensions}.
 *
 * Exists so the assembled-height subscriptions (designer params, the layout's
 * baseplate, the persisted expand toggle) mount only where the annotation is
 * actually drawn — inside the `itemKind === 'bin'` branch. Calling the hook up
 * in `PreviewCanvas` would subscribe the whole 3D canvas to layout-store changes
 * while editing a tool rack or an imported mesh, which never render this.
 *
 * Keeping `BinDimensions` itself store-free also keeps it a pure drawing
 * component, testable by passing bands directly.
 */

import { useCallback } from 'react';
import { useTranslation } from '@/i18n';
import { useAssembledHeight } from '@/features/bin-designer/hooks/useAssembledHeight';
import {
  ASSEMBLED_SEGMENT_LABEL_KEYS,
  type AssembledSegment,
} from '@/shared/printSettings/assembledHeight';
import { BinDimensions } from './BinDimensions';

interface AssembledBinDimensionsProps {
  /** Bin width in grid units */
  width: number;
  /** Bin depth in grid units */
  depth: number;
  /** Grid unit size in mm along X / width */
  gridUnitMm: number;
  /** Grid unit size in mm along Y / depth (non-square grid); defaults to gridUnitMm */
  gridUnitMmY?: number;
  /** Pre-translated "stacks +Nmm" secondary label; omitted when there's no lip. */
  stackPitchLabel?: string;
}

export function AssembledBinDimensions({
  width,
  depth,
  gridUnitMm,
  gridUnitMmY,
  stackPitchLabel,
}: AssembledBinDimensionsProps) {
  const t = useTranslation();
  const { breakdown, expanded } = useAssembledHeight();

  const segmentLabel = useCallback(
    (segment: AssembledSegment) =>
      t('assembledHeight.segmentLabel', {
        label: t(ASSEMBLED_SEGMENT_LABEL_KEYS[segment.kind]),
        mm: String(Math.round(segment.mm * 10) / 10),
      }),
    [t]
  );

  return (
    <BinDimensions
      width={width}
      depth={depth}
      gridUnitMm={gridUnitMm}
      gridUnitMmY={gridUnitMmY}
      segments={breakdown.segments}
      totalMm={breakdown.totalMm}
      expanded={expanded}
      segmentLabel={segmentLabel}
      stackPitchLabel={stackPitchLabel}
    />
  );
}
