import { useEffect, useRef, useState } from 'react';
import { Button, IconButton, XIcon } from '@/design-system';
import { SparklesIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import { trackEvent } from '@/shared/analytics/posthog';
import { useBinSizeSuggestion } from '../../useBinSizeSuggestion';
import type { DrawerDims } from '../../recommender';
import type { BinSize } from '../../types';

interface BinSizeSuggestionProps {
  label: string;
  drawer: DrawerDims;
  current: BinSize;
  /** Apply the suggested size. Returns whether the resize actually succeeded. */
  onApply: (size: BinSize) => boolean;
  /**
   * Whether the suggested size can actually be placed at the bin's current
   * position (no collision/overflow). When false, the hint is shown as plain
   * information without an Apply button — never a dead button.
   */
  canFit: (size: BinSize) => boolean;
}

const fmt = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1));

/**
 * Passive, opt-in size hint shown under the label field. Renders nothing unless
 * a confident label/embed-tier match exists that differs from the current size.
 * Applying is a single click; nothing changes until the user accepts. If the
 * suggested size would not fit where the bin sits, the row stays informational
 * (no Apply) so the button never silently no-ops.
 */
export function BinSizeSuggestion({
  label,
  drawer,
  current,
  onApply,
  canFit,
}: BinSizeSuggestionProps) {
  const t = useTranslation();
  const suggestion = useBinSizeSuggestion(label, drawer, current);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const labelKey = label.trim().toLowerCase();
  const sizeKey = suggestion
    ? `${suggestion.size.width}x${suggestion.size.depth}x${suggestion.size.height}`
    : null;
  const fits = suggestion ? canFit(suggestion.size) : false;

  // One impression per distinct (label, size, fits) triple surfaced.
  const shownRef = useRef<string | null>(null);
  useEffect(() => {
    if (!suggestion || !sizeKey || dismissedFor === labelKey) return;
    const impression = `${labelKey}:${sizeKey}:${fits}`;
    if (shownRef.current === impression) return;
    shownRef.current = impression;
    trackEvent('bin_suggestion_shown', { source: suggestion.source, size: sizeKey, fits });
  }, [suggestion, sizeKey, labelKey, fits, dismissedFor]);

  if (!suggestion || !sizeKey || dismissedFor === labelKey) return null;

  const sizeText = `${fmt(suggestion.size.width)}×${fmt(suggestion.size.depth)}×${fmt(suggestion.size.height)}`;

  const handleApply = () => {
    // Only count an apply that actually landed — the resize can still fail if
    // the layout changed between render and click.
    if (onApply(suggestion.size)) {
      trackEvent('bin_suggestion_applied', { source: suggestion.source, size: sizeKey, fits });
    }
  };

  const handleDismiss = () => {
    trackEvent('bin_suggestion_dismissed', { source: suggestion.source, size: sizeKey, fits });
    setDismissedFor(labelKey);
  };

  return (
    <div className="mt-2 flex items-center gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 animate-fade-in">
      <SparklesIcon className="h-4 w-4 flex-shrink-0 text-accent" />
      <span className="flex-1 text-xs text-content-secondary">
        {t('inspector.sizeSuggestion', { size: sizeText })}
      </span>
      {fits ? (
        <Button size="sm" variant="secondary" type="button" onClick={handleApply}>
          {t('inspector.sizeSuggestionApply')}
        </Button>
      ) : (
        <span className="text-[11px] text-content-tertiary whitespace-nowrap">
          {t('inspector.sizeSuggestionNoFit')}
        </span>
      )}
      <IconButton
        size="sm"
        variant="ghost"
        touchTarget={false}
        type="button"
        onClick={handleDismiss}
        className="h-6 w-6"
        aria-label={t('inspector.sizeSuggestionDismiss')}
      >
        <XIcon className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  );
}
