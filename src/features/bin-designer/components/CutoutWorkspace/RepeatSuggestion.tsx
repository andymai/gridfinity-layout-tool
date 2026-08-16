/**
 * The "these can become one repeat" offer, in its two presentations.
 *
 * `RepeatSuggestionRow` sits in the inspector above the align controls.
 * `RepeatSuggestionChip` is the compact form shown floating over the canvas
 * when the inspector dock is collapsed, so a user working with the dock closed
 * still gets the offer. Exactly one of them renders at a time.
 */

import { Button, IconButton } from '@/design-system';
import { SparklesIcon, XIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import type { RepeatSuggestion } from '@/features/bin-designer/hooks/useRepeatSuggestion';

interface RepeatSuggestionProps {
  readonly suggestion: RepeatSuggestion;
  readonly disabled?: boolean;
}

/**
 * Stacked rather than a single row: the dock is ~280px wide and the message
 * carries a pitch and a drift figure, so sharing that line with a button and a
 * dismiss wraps it into a column of two-word lines.
 */
export function RepeatSuggestionRow({ suggestion, disabled = false }: RepeatSuggestionProps) {
  const t = useTranslation();
  return (
    <div
      role="status"
      data-testid="repeat-suggestion"
      className="space-y-1.5 rounded-lg border border-accent/40 bg-accent/10 px-2.5 py-2 animate-fade-in"
    >
      <div className="flex items-start gap-2">
        <SparklesIcon className="mt-px h-4 w-4 flex-shrink-0 text-accent" />
        <span className="flex-1 text-[11px] leading-snug text-content-secondary">
          {suggestion.message}
        </span>
      </div>
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          touchTarget={false}
          onClick={suggestion.apply}
          disabled={disabled}
        >
          {t('binDesigner.cutouts.repeat.merge')}
        </Button>
        <IconButton
          type="button"
          size="sm"
          variant="ghost"
          touchTarget={false}
          onClick={suggestion.dismiss}
          className="h-6 w-6 shrink-0"
          aria-label={t('common.dismiss')}
        >
          <XIcon className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  );
}

export function RepeatSuggestionChip({ suggestion, disabled = false }: RepeatSuggestionProps) {
  const t = useTranslation();
  return (
    <div
      role="status"
      data-testid="repeat-suggestion-chip"
      className="pointer-events-auto absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-accent/40 bg-surface-elevated/95 px-3 py-1.5 shadow-lg backdrop-blur animate-fade-in"
    >
      <SparklesIcon className="h-4 w-4 flex-shrink-0 text-accent" />
      {/* The chip floats over the design, so it carries the action and the
          full sentence stays on the title rather than covering the canvas. */}
      <span className="text-[11px] text-content-secondary" title={suggestion.message}>
        {suggestion.message}
      </span>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        touchTarget={false}
        onClick={suggestion.apply}
        disabled={disabled}
      >
        {t('binDesigner.cutouts.repeat.merge')}
      </Button>
      <IconButton
        type="button"
        size="sm"
        variant="ghost"
        touchTarget={false}
        onClick={suggestion.dismiss}
        className="h-6 w-6 shrink-0"
        aria-label={t('common.dismiss')}
      >
        <XIcon className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  );
}
