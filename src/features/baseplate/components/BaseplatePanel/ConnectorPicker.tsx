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
  IconConnectorDovetailKey,
  IconConnectorSnapClip,
} from './connectorIcons';

export type ConnectorChoice = 'none' | 'dovetail' | 'dovetailKey' | 'snapClip';

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
}

export function ConnectorPicker({ value, onChange, renderExpanded }: ConnectorPickerProps) {
  const t = useTranslation();
  const groupRef = useRef<HTMLDivElement>(null);

  // Radio keyboard model: arrows/Home/End move the selection and focus, matching
  // the design-system SegmentedControl.
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const index = OPTIONS.findIndex((o) => o.value === value);
      let next: number;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (index + 1) % OPTIONS.length;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft')
        next = (index - 1 + OPTIONS.length) % OPTIONS.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = OPTIONS.length - 1;
      else return;
      e.preventDefault();
      if (next !== index) onChange(OPTIONS[next].value);
      const radios = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      radios?.[next]?.focus();
    },
    [value, onChange]
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
          const selected = optionValue === value;
          const expanded = selected ? renderExpanded?.(optionValue) : null;
          return (
            <div
              key={optionValue}
              className={cn(
                'w-full rounded-lg border p-3 transition-all duration-200 ease-in-out',
                selected
                  ? 'border-accent bg-accent/5'
                  : 'border-stroke-subtle bg-surface-elevated hover:bg-surface-hover'
              )}
            >
              <Button
                type="button"
                variant="ghost"
                role="radio"
                aria-checked={selected}
                aria-label={t(titleKey)}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  if (!selected) onChange(optionValue);
                }}
                className="flex h-auto w-full cursor-pointer items-start justify-start gap-3 bg-transparent p-0 text-left font-normal hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
              >
                <div className="mt-0.5 flex-shrink-0 text-content-secondary">
                  <Icon />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-medium text-content-primary">{t(titleKey)}</h4>
                  <p className="mt-0.5 text-xs text-content-secondary">{t(descKey)}</p>
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
