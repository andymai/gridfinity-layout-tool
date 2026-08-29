/**
 * Chamfer vs fillet picker, drawn rather than named.
 *
 * The two profiles differ only in the shape of the wall's bottom band, which a
 * text label cannot convey — you had to generate the bin to see which one you
 * had picked. Each card carries a wall cross-section: chamfer cuts a straight
 * bevel, fillet sweeps a concave quarter-ellipse into the same corner.
 *
 * The drawings are idealised, not scaled to the live taper — at a few
 * millimetres of inset both profiles flatten to the same near-vertical line and
 * stop telling the two apart, which is the one job this control has.
 *
 * Radiogroup mechanics (roving tabindex + arrow keys) follow the baseplate
 * `ConnectorPicker`, the other card-style picker in the app.
 */

import { useCallback, useRef } from 'react';
import type { WallTaperProfile } from '@/core/types';
import { Button, cn } from '@/design-system';

// 44x40 viewBox. The wall drops from the rim to the top of the band (y=14),
// then runs back to the inset base at x=12; the floor closes it at y=34.
const CHAMFER_PATH = 'M34 4 L34 14 L12 34';
const FILLET_PATH = 'M34 4 L34 14 A22 20 0 0 1 12 34';

const PROFILES: readonly WallTaperProfile[] = ['chamfer', 'fillet'];

export interface TaperProfileCardsProps {
  value: WallTaperProfile;
  onChange: (profile: WallTaperProfile) => void;
  chamferLabel: string;
  filletLabel: string;
  groupLabel: string;
}

export function TaperProfileCards({
  value,
  onChange,
  chamferLabel,
  filletLabel,
  groupLabel,
}: TaperProfileCardsProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  const cards = [
    { value: 'chamfer' as const, label: chamferLabel, path: CHAMFER_PATH },
    { value: 'fillet' as const, label: filletLabel, path: FILLET_PATH },
  ];

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const pos = PROFILES.indexOf(value);
      let next: number;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (pos + 1) % PROFILES.length;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft')
        next = (pos - 1 + PROFILES.length) % PROFILES.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = PROFILES.length - 1;
      else return;
      e.preventDefault();
      const nextValue = PROFILES[next];
      if (nextValue !== value) onChange(nextValue);
      groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
    },
    [value, onChange]
  );

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={groupLabel}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="grid grid-cols-2 gap-2"
    >
      {cards.map((card) => {
        const selected = card.value === value;
        return (
          <div
            key={card.value}
            className={cn(
              'rounded-md border transition-colors',
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
              aria-label={card.label}
              tabIndex={selected ? 0 : -1}
              onClick={() => {
                if (!selected) onChange(card.value);
              }}
              className="flex h-auto w-full cursor-pointer flex-col items-center justify-center gap-1 bg-transparent px-2 py-1.5 font-normal hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
            >
              <svg
                width="44"
                height="40"
                viewBox="0 0 44 40"
                fill="none"
                aria-hidden="true"
                className="shrink-0"
              >
                {/* Nominal footprint — where the taper returns to */}
                <path
                  d="M12 4 L12 36"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeDasharray="2 2"
                  className="text-content-tertiary opacity-50"
                />
                <path
                  d="M4 34 L34 34"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  className="text-content-tertiary"
                />
                <path
                  d={card.path}
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={selected ? 'text-accent' : 'text-content-secondary'}
                />
              </svg>
              <span className="text-label font-medium leading-none">{card.label}</span>
            </Button>
          </div>
        );
      })}
    </div>
  );
}
