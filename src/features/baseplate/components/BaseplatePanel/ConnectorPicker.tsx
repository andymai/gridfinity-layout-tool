/**
 * Connector-style picker: a vertical list of selectable cards, mirroring the bin
 * designer's Interior section (InteriorModeCard). Each card shows an icon, title,
 * and description; the selected card expands inline to reveal that style's
 * controls (via `renderExpanded`). Single-select, rendered as a radiogroup.
 */

import { useCallback, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { Button } from '@/design-system';
import { cn } from '@/design-system/cn';
import { useTranslation } from '@/i18n';
import {
  IconConnectorNone,
  IconConnectorDovetail,
  IconConnectorPuzzle,
  IconConnectorDovetailKey,
  IconConnectorSnapClip,
} from './connectorIcons';

export type ConnectorChoice = 'none' | 'dovetail' | 'puzzle' | 'dovetailKey' | 'snapClip';

const OPTIONS: ReadonlyArray<{
  value: ConnectorChoice;
  titleKey: string;
  descKey: string;
  Icon: () => React.JSX.Element;
}> = [
  {
    value: 'none',
    titleKey: 'baseplate.connectors.none',
    descKey: 'baseplate.connectorDesc.none',
    Icon: IconConnectorNone,
  },
  {
    value: 'dovetail',
    titleKey: 'baseplate.connectorStyle.dovetail',
    descKey: 'baseplate.connectorDesc.dovetail',
    Icon: IconConnectorDovetail,
  },
  {
    value: 'puzzle',
    titleKey: 'baseplate.connectorStyle.puzzle',
    descKey: 'baseplate.connectorDesc.puzzle',
    Icon: IconConnectorPuzzle,
  },
  {
    value: 'dovetailKey',
    titleKey: 'baseplate.connectorStyle.dovetailKey',
    descKey: 'baseplate.connectorDesc.dovetailKey',
    Icon: IconConnectorDovetailKey,
  },
  {
    value: 'snapClip',
    titleKey: 'baseplate.connectorStyle.snapClip',
    descKey: 'baseplate.connectorDesc.snapClip',
    Icon: IconConnectorSnapClip,
  },
];

interface ConnectorPickerProps {
  readonly value: ConnectorChoice;
  readonly onChange: (value: ConnectorChoice) => void;
  /** Inline controls rendered inside the selected card (Interior-section style). */
  readonly renderExpanded?: (value: ConnectorChoice) => ReactNode;
  /**
   * Options that can't be selected right now, mapped to the reason shown under
   * the card. Used to disable snap clip while vertical stacking is on.
   */
  readonly disabledOptions?: Partial<Record<ConnectorChoice, string>>;
}

export function ConnectorPicker({
  value,
  onChange,
  renderExpanded,
  disabledOptions,
}: ConnectorPickerProps) {
  const t = useTranslation();
  const groupRef = useRef<HTMLDivElement>(null);

  // Radio keyboard model: arrows/Home/End move the selection and focus, matching
  // the design-system SegmentedControl. Disabled options are skipped. An option
  // is disabled when it has a reason entry (any string, including empty), so the
  // keyboard filter and the per-card render agree.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const selectable = OPTIONS.filter((o) => disabledOptions?.[o.value] === undefined);
      if (selectable.length === 0) return;
      // If the current value is itself disabled, findIndex returns -1; treat that
      // as "before the first selectable" so arrows land on a valid neighbour.
      const pos = selectable.findIndex((o) => o.value === value);
      let next: number;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight')
        next = pos < 0 ? 0 : (pos + 1) % selectable.length;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft')
        next = pos < 0 ? selectable.length - 1 : (pos - 1 + selectable.length) % selectable.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = selectable.length - 1;
      else return;
      e.preventDefault();
      const nextValue = selectable[next].value;
      if (nextValue !== value) onChange(nextValue);
      const radios = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      radios?.[OPTIONS.findIndex((o) => o.value === nextValue)]?.focus();
    },
    [value, onChange, disabledOptions]
  );

  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-medium uppercase tracking-wide text-content-tertiary">
        {t('baseplate.connectors.label')}
      </div>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={t('baseplate.connectors.label')}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="space-y-1.5"
      >
        {OPTIONS.map(({ value: optionValue, titleKey, descKey, Icon }) => {
          const disabledReason = disabledOptions?.[optionValue];
          const disabled = disabledReason !== undefined;
          const selected = optionValue === value;
          const expanded = selected && !disabled ? renderExpanded?.(optionValue) : null;
          return (
            <div
              key={optionValue}
              className={cn(
                'w-full rounded-lg border p-3 transition-all duration-200 ease-in-out',
                disabled
                  ? 'border-stroke-subtle bg-surface-elevated opacity-50'
                  : selected
                    ? 'border-accent bg-accent/5'
                    : 'border-stroke-subtle bg-surface-elevated hover:bg-surface-hover'
              )}
            >
              <Button
                type="button"
                variant="ghost"
                role="radio"
                aria-checked={selected}
                aria-disabled={disabled}
                disabled={disabled}
                aria-label={t(titleKey)}
                tabIndex={selected && !disabled ? 0 : -1}
                onClick={() => {
                  if (!selected && !disabled) onChange(optionValue);
                }}
                className={cn(
                  'flex h-auto w-full items-start justify-start gap-3 bg-transparent p-0 text-left font-normal hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent',
                  disabled ? 'cursor-not-allowed' : 'cursor-pointer'
                )}
              >
                <div className="mt-0.5 flex-shrink-0 text-content-secondary">
                  <Icon />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-medium text-content-primary">{t(titleKey)}</h4>
                  <p className="mt-0.5 text-xs text-content-secondary">{t(descKey)}</p>
                  {disabled && (
                    <p className="mt-0.5 text-[11px] text-content-tertiary">{disabledReason}</p>
                  )}
                </div>
              </Button>

              {expanded && (
                <div className="mt-3 border-t border-stroke-subtle pt-3">{expanded}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
