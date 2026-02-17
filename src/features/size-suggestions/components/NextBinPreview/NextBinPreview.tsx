/**
 * NextBinPreview - Floating preview panel for size suggestions.
 * Shows the top suggestion as a mini-grid with category color (Tetris-style).
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTranslation } from '@/i18n';
import { useSizeSuggestionStore } from '../../store';
import type { SizeSuggestion } from '../../types';
import { parseSize } from '../../utils/parseSize';
import { Icon } from '@/design-system/Icon';

interface NextBinPreviewProps {
  /** Callback when user accepts the suggestion */
  onAccept: (suggestion: SizeSuggestion) => void;
  /** Color for the category (used to render the bin preview) */
  categoryColor: string;
}

/**
 * MiniGrid - renders a proportional grid with the suggested bin size.
 */
function MiniGrid({ size, color }: { size: string; color: string }) {
  const dimensions = useMemo(() => {
    const dims = parseSize(size);
    if (!dims) return null;
    const { width, depth } = dims;

    const scale = Math.min(60 / Math.max(width, depth), 20);
    const rectWidth = width * scale;
    const rectHeight = depth * scale;
    const svgWidth = Math.max(rectWidth, 40);
    const svgHeight = Math.max(rectHeight, 40);

    return {
      svgWidth,
      svgHeight,
      rectX: (svgWidth - rectWidth) / 2,
      rectY: (svgHeight - rectHeight) / 2,
      rectWidth,
      rectHeight,
    };
  }, [size]);

  if (!dimensions) return null;

  return (
    <svg
      width={dimensions.svgWidth}
      height={dimensions.svgHeight}
      viewBox={`0 0 ${dimensions.svgWidth} ${dimensions.svgHeight}`}
      className="mx-auto"
    >
      <rect
        x={dimensions.rectX}
        y={dimensions.rectY}
        width={dimensions.rectWidth}
        height={dimensions.rectHeight}
        fill={color}
        stroke="currentColor"
        strokeWidth="1"
        className="opacity-80"
        rx="2"
      />
    </svg>
  );
}

/**
 * NextBinPreview component.
 */
export function NextBinPreview({ onAccept, categoryColor }: NextBinPreviewProps) {
  const t = useTranslation();

  const { suggestions, isDismissed, dismiss } = useSizeSuggestionStore(
    useShallow((s) => ({
      suggestions: s.suggestions,
      isDismissed: s.isDismissed,
      dismiss: s.dismiss,
    }))
  );

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dismiss();
    },
    [dismiss]
  );

  // Don't show if no suggestions, dismissed, or top suggestion has no position
  const topSuggestion = suggestions[0];
  if (!topSuggestion || isDismissed || !topSuggestion.position) {
    return null;
  }

  const formattedSize = topSuggestion.size.replace('x', ' × ');

  return (
    <div
      role="complementary"
      aria-live="polite"
      aria-label={t('sizeSuggestion.useSize', { size: formattedSize })}
      className="absolute right-4 top-4 z-30 flex w-32 flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-md"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted">{t('sizeSuggestion.next')}</span>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label={t('sizeSuggestion.dismiss')}
          className="flex h-4 w-4 items-center justify-center rounded hover:bg-surface-hover"
        >
          <Icon size="xs">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </Icon>
        </button>
      </div>

      {/* Main preview - clickable to accept */}
      <button
        type="button"
        onClick={() => onAccept(topSuggestion)}
        aria-label={t('sizeSuggestion.useSize', { size: formattedSize })}
        className="flex flex-col items-center gap-2 rounded-md border border-transparent p-2 transition-colors hover:border-border hover:bg-surface-hover"
      >
        <MiniGrid size={topSuggestion.size} color={categoryColor} />
        <span className="text-sm font-medium">{formattedSize}</span>
      </button>
    </div>
  );
}
