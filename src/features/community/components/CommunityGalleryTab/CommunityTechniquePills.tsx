import { useCallback, useMemo, useRef } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '@/design-system';
import { cn } from '@/design-system/cn';
import { useTranslation } from '@/i18n';
import type { ExampleTechnique } from '@/shared/types/exampleTechniques';
import { TECHNIQUE_CONFIG } from '@/shared/types/exampleTechniques';
import { ALL_TECHNIQUES } from './galleryFilterOptions';

const PILL_VALUES: readonly (ExampleTechnique | null)[] = [null, ...ALL_TECHNIQUES];

interface CommunityTechniquePillsProps {
  selected: ExampleTechnique | null;
  onChange: (technique: ExampleTechnique | null) => void;
  /**
   * Result count per technique under the other active filters. When supplied,
   * each pill shows its count and a zero-count pill is disabled.
   */
  counts?: ReadonlyMap<ExampleTechnique, number>;
  /** Count for the "All" pill; only meaningful alongside `counts`. */
  allCount?: number;
  /** Larger pills for touch surfaces (44px targets). */
  touchSize?: boolean;
}

export function CommunityTechniquePills({
  selected,
  onChange,
  counts,
  allCount,
  touchSize = false,
}: CommunityTechniquePillsProps) {
  const t = useTranslation();
  const groupRef = useRef<HTMLDivElement>(null);

  const isDisabled = useCallback(
    (technique: ExampleTechnique | null): boolean => {
      if (counts === undefined || technique === null) return false;
      // The current selection stays enabled even at zero, or picking a pill
      // that empties the grid would remove the only way back out of it.
      return (counts.get(technique) ?? 0) === 0 && selected !== technique;
    },
    [counts, selected]
  );

  // Roving focus walks only the pills that can actually be chosen; stepping
  // onto a disabled one would strand the keyboard on a dead control.
  const navigable = useMemo(() => PILL_VALUES.filter((value) => !isDisabled(value)), [isDisabled]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (navigable.length === 0) return;
      const pos = Math.max(0, navigable.indexOf(selected));
      let next: number;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (pos + 1) % navigable.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
        next = (pos - 1 + navigable.length) % navigable.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = navigable.length - 1;
      else return;
      e.preventDefault();
      const value = navigable[next];
      onChange(value ?? null);
      const radios = groupRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="radio"]:not([disabled])'
      );
      radios?.[next]?.focus();
    },
    [navigable, selected, onChange]
  );

  const pillClass = (isSelected: boolean, disabled: boolean): string =>
    cn(
      'flex items-center gap-1.5 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-150',
      touchSize ? 'min-h-11 px-4 py-2' : 'px-3 py-1.5',
      isSelected
        ? 'bg-accent text-on-dark shadow-sm hover:bg-accent hover:text-on-dark'
        : 'bg-surface text-content-secondary hover:bg-surface-hover hover:text-content',
      disabled && 'opacity-40'
    );

  const countLabel = (count: number | undefined) =>
    count === undefined ? null : (
      <span className="text-xs tabular-nums opacity-70" aria-hidden="true">
        {count}
      </span>
    );

  return (
    <div
      ref={groupRef}
      role="radiogroup"
      aria-label={t('community.gallery.techniqueLabel')}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="flex flex-wrap gap-2"
    >
      <Button
        variant="ghost"
        type="button"
        role="radio"
        aria-checked={selected === null}
        tabIndex={selected === null ? 0 : -1}
        onClick={() => onChange(null)}
        className={pillClass(selected === null, false)}
      >
        {t('community.gallery.techniqueAll')}
        {countLabel(counts === undefined ? undefined : allCount)}
      </Button>
      {ALL_TECHNIQUES.map((technique) => {
        const isSelected = selected === technique;
        const disabled = isDisabled(technique);
        return (
          <Button
            variant="ghost"
            type="button"
            key={technique}
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(isSelected ? null : technique)}
            className={pillClass(isSelected, disabled)}
          >
            {t(TECHNIQUE_CONFIG[technique].labelKey)}
            {countLabel(counts?.get(technique))}
          </Button>
        );
      })}
    </div>
  );
}
