/**
 * A one-of-N choice as a grid of icon tiles, with the chosen mode's one-line
 * caption and its own controls below. The tiles say what each mode is; only
 * the chosen one spends height on explaining itself.
 */

import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Button } from '@/design-system';

export interface ModeTileOption<T extends string> {
  readonly value: T;
  readonly icon: ReactNode;
  readonly label: string;
  readonly caption: string;
  /** On the tile, under its label: an "Experimental" pill and the like. */
  readonly badge?: ReactNode;
  /** Why the mode cannot be chosen. Disables the tile and is its tooltip. */
  readonly disabledReason?: string;
}

interface ModeTilesProps<T extends string> {
  readonly ariaLabel: string;
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly options: readonly ModeTileOption<T>[];
  readonly columns?: 2 | 3;
  /** The chosen mode's own controls. */
  readonly children?: ReactNode;
}

const COLUMNS = { 2: 'grid-cols-2', 3: 'grid-cols-3' } as const;

const TILE_ON = 'border-accent bg-accent/10 text-content-primary';
const TILE_OFF =
  'border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover hover:text-content';

export function ModeTiles<T extends string>({
  ariaLabel,
  value,
  onChange,
  options,
  columns = 3,
  children,
}: ModeTilesProps<T>) {
  const tiles = useRef<Partial<Record<string, HTMLButtonElement | null>>>({});
  const chosen = options.find((option) => option.value === value);
  const choosable = options.filter((option) => option.disabledReason === undefined);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0 || choosable.length === 0) return;
    event.preventDefault();
    const index = choosable.findIndex((option) => option.value === value);
    const next = choosable[(index + step + choosable.length) % choosable.length];
    onChange(next.value);
    tiles.current[next.value]?.focus();
  };

  return (
    <div className="space-y-2">
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={`grid gap-1.5 ${COLUMNS[columns]}`}
      >
        {options.map((option) => {
          const isOn = option.value === value;
          return (
            <Button
              key={option.value}
              ref={(element: HTMLButtonElement | null) => {
                tiles.current[option.value] = element;
              }}
              variant="ghost"
              type="button"
              role="radio"
              aria-checked={isOn}
              tabIndex={isOn ? 0 : -1}
              disabled={option.disabledReason !== undefined}
              title={option.disabledReason}
              onClick={() => onChange(option.value)}
              className={`flex h-auto min-w-0 flex-col items-center justify-start gap-1 rounded-lg border px-1.5 py-2 text-center font-normal transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                isOn ? TILE_ON : TILE_OFF
              }`}
            >
              {option.icon}
              <span className="text-label font-medium leading-tight">{option.label}</span>
              {option.badge}
            </Button>
          );
        })}
      </div>
      {chosen && (
        <p className="text-label leading-relaxed text-content-tertiary">{chosen.caption}</p>
      )}
      {children}
    </div>
  );
}
