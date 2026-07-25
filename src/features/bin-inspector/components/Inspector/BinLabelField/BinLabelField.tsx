import { useMemo } from 'react';
import { Combobox, type ComboboxOption } from '@/design-system';
import { CONSTRAINTS } from '@/core/constants';
import { processLabel } from '@/shared/analytics/labelVocabulary';
import { trackEvent } from '@/shared/analytics/posthog';
import { useTranslation } from '@/i18n';
import type { Bin } from '@/core/types';
import { useLabelSuggestions } from '@/features/bin-inspector/hooks/useLabelSuggestions';
import { useLabelSuggesterModel } from '@/features/bin-inspector/hooks/useLabelSuggesterModel';
import type { SuggestionReason } from '@/features/bin-inspector/labelSuggest';

interface BinLabelFieldProps {
  bin: Bin;
  bins: readonly Bin[];
  /** Fires on every keystroke and on suggestion accept. */
  onChange: (label: string) => void;
  variant: 'desktop' | 'mobile';
}

const REASON_KEY: Record<SuggestionReason, string> = {
  nextInSet: 'inspector.labelSuggest.reason.nextInSet',
  matchesNeighbors: 'inspector.labelSuggest.reason.matchesNeighbors',
  usedBefore: 'inspector.labelSuggest.reason.usedBefore',
  similar: 'inspector.labelSuggest.reason.similar',
  catalog: 'inspector.labelSuggest.reason.catalog',
};

/**
 * Smart label editor: a combobox over on-device suggestions (sequence
 * continuation, neighbor reuse, semantic-ish and catalog matches) with an
 * inline ghost for the top prediction. Inline ghost is disabled on touch to
 * keep the virtual keyboard sane; the dropdown still offers every suggestion.
 */
export function BinLabelField({ bin, bins, onChange, variant }: BinLabelFieldProps) {
  const t = useTranslation();
  const model = useLabelSuggesterModel();
  const { suggestions, ghost } = useLabelSuggestions(
    bin,
    bins,
    CONSTRAINTS.LABEL_MAX_LENGTH,
    model
  );
  const enableInlineGhost = variant === 'desktop';

  const options = useMemo<ComboboxOption[]>(
    () =>
      suggestions.map((s) => ({
        value: s.value,
        hint:
          s.reason === 'usedBefore'
            ? t(REASON_KEY.usedBefore, { count: s.count ?? 1 })
            : t(REASON_KEY[s.reason]),
      })),
    [suggestions, t]
  );

  const handleCommit = (value: string, meta: { viaGhost: boolean; option?: ComboboxOption }) => {
    // The ghost accepts suggestions[0]; a dropdown pick reports its own option.
    // Match on the source suggestion (unclamped) so telemetry stays accurate
    // even if the field length-clamps the committed value.
    const accepted = meta.viaGhost
      ? suggestions[0]
      : suggestions.find((s) => s.value === meta.option?.value);
    const label = processLabel(value);
    trackEvent('label_suggestion_accepted', {
      reason: accepted?.reason ?? null,
      rank: accepted ? suggestions.indexOf(accepted) : -1,
      via_ghost: meta.viaGhost,
      had_query: bin.label.trim().length > 0,
      label_hash: label.hash,
      label_domain: label.domain,
    });
  };

  return (
    <Combobox
      aria-label={t('inspector.binLabel')}
      value={bin.label}
      onChange={onChange}
      onCommit={handleCommit}
      options={options}
      ghost={enableInlineGhost ? ghost : null}
      enableInlineGhost={enableInlineGhost}
      openOnFocus
      placeholder={t('inspector.labelPlaceholder')}
      maxLength={CONSTRAINTS.LABEL_MAX_LENGTH}
      size={variant === 'mobile' ? 'lg' : 'md'}
    />
  );
}
