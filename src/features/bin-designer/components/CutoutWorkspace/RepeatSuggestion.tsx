/**
 * The "these can become one repeat" offer.
 *
 * Two placements, one component: `panel` sits in the inspector above the align
 * controls, `chip` floats over the canvas when the inspector dock is collapsed
 * so closing the dock never silently hides the offer. Exactly one renders at a
 * time — the hook that feeds this is disabled for the placement that is not on
 * screen, so a hidden copy never records an impression.
 *
 * Both stack the message above the actions: the dock is ~280px and the message
 * carries a pitch and a drift figure, so sharing that line with a button and a
 * dismiss wraps it into a column of two-word lines.
 */

import { Button, IconButton } from '@/design-system';
import { SparklesIcon, XIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { cn } from '@/design-system/cn';
import type { RepeatSuggestion as Suggestion } from '@/features/bin-designer/hooks/useRepeatSuggestion';

interface RepeatSuggestionProps {
  readonly suggestion: Suggestion;
  readonly placement?: 'panel' | 'chip';
  readonly disabled?: boolean;
}

const SHELL = 'space-y-1.5 border border-accent/40 animate-fade-in';
const PLACEMENT = {
  panel: 'rounded-lg bg-accent/10 px-2.5 py-2',
  chip: 'absolute bottom-4 left-1/2 z-30 w-72 -translate-x-1/2 rounded-lg bg-surface-elevated/95 px-3 py-2 shadow-lg backdrop-blur',
} as const;

export function RepeatSuggestion({
  suggestion,
  placement = 'panel',
  disabled = false,
}: RepeatSuggestionProps) {
  const t = useTranslation();
  return (
    <div
      role="status"
      data-testid={placement === 'chip' ? 'repeat-suggestion-chip' : 'repeat-suggestion'}
      className={cn(SHELL, PLACEMENT[placement])}
    >
      <div className="flex items-start gap-2">
        <SparklesIcon className="mt-px h-4 w-4 flex-shrink-0 text-accent" />
        <span className="flex-1 text-label leading-snug text-content-secondary">
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
