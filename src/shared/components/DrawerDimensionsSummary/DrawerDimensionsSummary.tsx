import { useCallback } from 'react';
import { Button } from '@/design-system';
import { RulerIcon, SparklesIcon, XIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import type { MeasuredDrawerMm } from '@/core/types';
import type { HalfFitSuggestion } from '@/shared/hooks/useDrawerSettings';
import { EditableDimensions } from '../EditableDimensions';

/** Format mm for display: nearest 0.1, no trailing zeros. */
function fmt(v: number): string {
  return String(Math.round(v * 10) / 10);
}

const OVERFLOW_EPSILON_MM = 0.05;

interface DrawerDimensionsSummaryProps {
  /** The user's stored tape-measure reading, when one exists. */
  readonly measuredMm: MeasuredDrawerMm | undefined;
  /** Derived grid dimensions in mm. */
  readonly gridWidthMm: number;
  readonly gridDepthMm: number;
  readonly gridHeightMm: number;
  readonly minMm: number;
  readonly maxMm: number;
  readonly minHeightMm: number;
  readonly maxHeightMm: number;
  readonly onCommit: (widthMm: number, depthMm: number, heightMm?: number) => void;
  readonly suggestion: HalfFitSuggestion | null | undefined;
  readonly onAcceptSuggestion: () => void;
  readonly onDismissSuggestion: () => void;
  readonly onClearMeasurement: () => void;
  /** Platform variant: mobile enlarges tap targets. */
  readonly variant?: 'desktop' | 'mobile';
}

/**
 * The drawer-size mm line in the settings panels: a click-to-edit measured
 * size (same pattern as the baseplate panel), the derived grid fit + slack
 * beneath it, and a dismissible tighter-half-unit-fit suggestion. Rendered
 * by both the desktop Sidebar and the mobile settings sheet.
 */
export function DrawerDimensionsSummary({
  measuredMm,
  gridWidthMm,
  gridDepthMm,
  gridHeightMm,
  minMm,
  maxMm,
  minHeightMm,
  maxHeightMm,
  onCommit,
  suggestion,
  onAcceptSuggestion,
  onDismissSuggestion,
  onClearMeasurement,
  variant = 'desktop',
}: DrawerDimensionsSummaryProps) {
  const t = useTranslation();

  const hasMeasurement = measuredMm !== undefined;
  const displayWidth = measuredMm?.width ?? gridWidthMm;
  const displayDepth = measuredMm?.depth ?? gridDepthMm;
  const displayHeight = measuredMm?.height ?? gridHeightMm;

  const overflowWidth = hasMeasurement ? gridWidthMm - measuredMm.width : 0;
  const overflowDepth = hasMeasurement ? gridDepthMm - measuredMm.depth : 0;
  const hasOverflow = overflowWidth > OVERFLOW_EPSILON_MM || overflowDepth > OVERFLOW_EPSILON_MM;

  // The height field is seeded with the derived grid height when no height
  // was measured. Committing that seed unchanged must not record it as a
  // measurement — only pass height through when the user measured one
  // before or actually edited the field.
  const measuredHeight = measuredMm?.height;
  const handleCommit = useCallback(
    (widthMm: number, depthMm: number, heightMm?: number) => {
      const heightWasSeeded =
        measuredHeight === undefined &&
        heightMm !== undefined &&
        Math.abs(heightMm - gridHeightMm) < OVERFLOW_EPSILON_MM;
      onCommit(widthMm, depthMm, heightWasSeeded ? undefined : heightMm);
    },
    [onCommit, measuredHeight, gridHeightMm]
  );

  const actionClass = variant === 'mobile' ? 'text-sm h-9' : 'text-xs h-7';

  return (
    <div className="space-y-1.5 pt-2">
      <div className="flex items-center justify-center gap-1 text-content-tertiary">
        <RulerIcon size="xs" className="flex-shrink-0" />
        <EditableDimensions
          widthMm={displayWidth}
          depthMm={displayDepth}
          heightMm={displayHeight}
          minMm={minMm}
          maxMm={maxMm}
          minHeightMm={minHeightMm}
          maxHeightMm={maxHeightMm}
          onCommit={handleCommit}
          variant="secondary"
          aria-label={t('drawerDims.editAria')}
          widthLabel={t('drawerDims.widthLabel')}
          depthLabel={t('drawerDims.depthLabel')}
          heightLabel={t('drawerDims.heightLabel')}
        />
        {hasMeasurement && (
          <Button
            variant="ghost"
            type="button"
            onClick={onClearMeasurement}
            aria-label={t('drawerDims.clear')}
            title={t('drawerDims.clear')}
            className="!p-0.5 hover:bg-transparent hover:text-content-secondary"
          >
            <XIcon size="xs" />
          </Button>
        )}
      </div>

      {hasMeasurement &&
        (hasOverflow ? (
          <p className="text-center text-xxs text-status-warning">
            {t('drawerDims.overflow', {
              width: fmt(Math.max(0, overflowWidth)),
              depth: fmt(Math.max(0, overflowDepth)),
            })}
          </p>
        ) : (
          <p className="text-center text-xxs text-content-tertiary tabular-nums">
            {t('drawerDims.fit', {
              width: fmt(gridWidthMm),
              depth: fmt(gridDepthMm),
              freeWidth: fmt(measuredMm.width - gridWidthMm),
              freeDepth: fmt(measuredMm.depth - gridDepthMm),
            })}
          </p>
        ))}

      {suggestion !== null && suggestion !== undefined && (
        <div
          role="status"
          className="rounded-md border border-accent/40 bg-accent/5 p-2 space-y-1.5"
        >
          <div className="flex items-start gap-1.5">
            <SparklesIcon size="xs" className="mt-0.5 flex-shrink-0 text-accent" />
            <div className="flex-1 text-xxs text-content-secondary">
              <div className="font-medium text-content">
                {t('drawerDims.suggestionTitle', {
                  width: String(suggestion.width),
                  depth: String(suggestion.depth),
                })}
              </div>
              <div>
                {t('drawerDims.suggestionDetail', {
                  freeWidth: fmt(suggestion.slackWidthMm),
                  freeDepth: fmt(suggestion.slackDepthMm),
                })}
              </div>
            </div>
            <Button
              variant="ghost"
              type="button"
              onClick={onDismissSuggestion}
              aria-label={t('drawerDims.suggestionDismiss')}
              className="!p-0.5 hover:bg-transparent"
            >
              <XIcon size="xs" />
            </Button>
          </div>
          <Button
            variant="secondary"
            fullWidth
            type="button"
            onClick={onAcceptSuggestion}
            className={actionClass}
          >
            {t('drawerDims.suggestionUse')}
          </Button>
        </div>
      )}
    </div>
  );
}
