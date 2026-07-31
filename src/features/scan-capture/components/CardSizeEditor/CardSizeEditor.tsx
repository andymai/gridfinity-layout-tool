/**
 * Caliper entry for the reference card's real size.
 *
 * Collapsed by default: the nominal ID-1 size is right for almost everyone, and
 * the readout alone tells you what the scan is being measured against. Edits
 * apply live, so a mistyped side shows up immediately in the measured size
 * above rather than silently rescaling the exported outline.
 */

import { useId, useState } from 'react';
import { Button, Field, Input } from '@/design-system';
import { useTranslation } from '@/i18n';
import {
  DEFAULT_CARD_SIZE,
  MAX_CARD_MM,
  MIN_CARD_MM,
  isDefaultCardSize,
  parseCardMm,
  type CardSizeMm,
} from '@/features/scan-capture/cardSize';

export interface CardSizeEditorProps {
  readonly size: CardSizeMm;
  readonly onChange: (next: CardSizeMm) => void;
}

// Calipers resolve to 0.01mm, and the readout has to agree with the field
// beneath it — rounding 53.98 to "54" reads as a different card.
const roundMm = (n: number): number => Math.round(n * 100) / 100;

export function CardSizeEditor({ size, onChange }: CardSizeEditorProps) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ long: String(size.longMm), short: String(size.shortMm) });
  const longId = useId();
  const shortId = useId();

  const update = (field: 'long' | 'short', text: string): void => {
    const next = { ...draft, [field]: text };
    setDraft(next);
    const longMm = parseCardMm(next.long);
    const shortMm = parseCardMm(next.short);
    if (longMm !== null && shortMm !== null) onChange({ longMm, shortMm });
  };

  const useStandard = (): void => {
    setDraft({ long: String(DEFAULT_CARD_SIZE.longMm), short: String(DEFAULT_CARD_SIZE.shortMm) });
    onChange(DEFAULT_CARD_SIZE);
  };

  // A half-typed field is not an error — it just leaves the last good value in
  // effect. Only a committed, out-of-range number gets called out.
  const rangeError = (text: string): string | undefined =>
    text.trim() !== '' && parseCardMm(text) === null
      ? t('scan.cardSize.range', { min: MIN_CARD_MM, max: MAX_CARD_MM })
      : undefined;

  const longError = rangeError(draft.long);
  const shortError = rangeError(draft.short);

  return (
    <div className="w-full rounded-lg border border-stroke-subtle bg-surface-elevated px-3 py-2.5 text-left">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs text-content-tertiary">{t('scan.cardSize.label')}</span>
          <span className="text-sm font-medium text-content-primary">
            {t('scan.cardSize.value', {
              long: roundMm(size.longMm),
              short: roundMm(size.shortMm),
            })}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? t('scan.cardSize.close') : t('scan.cardSize.change')}
        </Button>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('scan.cardSize.longSide')} htmlFor={longId} error={longError}>
              <Input
                id={longId}
                type="text"
                inputMode="decimal"
                fullWidth
                value={draft.long}
                error={longError !== undefined}
                aria-describedby={longError ? `${longId}-error` : undefined}
                onChange={(e) => update('long', e.target.value)}
              />
            </Field>
            <Field label={t('scan.cardSize.shortSide')} htmlFor={shortId} error={shortError}>
              <Input
                id={shortId}
                type="text"
                inputMode="decimal"
                fullWidth
                value={draft.short}
                error={shortError !== undefined}
                aria-describedby={shortError ? `${shortId}-error` : undefined}
                onChange={(e) => update('short', e.target.value)}
              />
            </Field>
          </div>
          <p className="text-xs text-content-secondary">{t('scan.cardSize.hint')}</p>
          {!isDefaultCardSize(size) && (
            <Button type="button" variant="secondary" size="sm" onClick={useStandard}>
              {t('scan.cardSize.useStandard')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
