import { useCallback, useRef } from 'react';
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
  /** Larger pills for touch surfaces (44px targets in the mobile filter sheet). */
  touchSize?: boolean;
}

export function CommunityTechniquePills({
  selected,
  onChange,
  touchSize = false,
}: CommunityTechniquePillsProps) {
  const t = useTranslation();
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const pos = PILL_VALUES.indexOf(selected);
      let next: number;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (pos + 1) % PILL_VALUES.length;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
        next = (pos - 1 + PILL_VALUES.length) % PILL_VALUES.length;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = PILL_VALUES.length - 1;
      else return;
      e.preventDefault();
      onChange(PILL_VALUES[next]);
      const radios = groupRef.current?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      radios?.[next]?.focus();
    },
    [selected, onChange]
  );

  const pillClass = (isSelected: boolean): string =>
    cn(
      'flex items-center gap-1.5 whitespace-nowrap rounded-full text-sm font-medium transition-all duration-150',
      touchSize ? 'min-h-11 px-4 py-2' : 'px-3 py-1.5',
      isSelected
        ? 'bg-accent text-on-dark shadow-sm hover:bg-accent hover:text-on-dark'
        : 'bg-surface text-content-secondary hover:bg-surface-hover hover:text-content'
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
        className={pillClass(selected === null)}
      >
        {t('community.gallery.techniqueAll')}
      </Button>
      {ALL_TECHNIQUES.map((technique) => {
        const isSelected = selected === technique;
        return (
          <Button
            variant="ghost"
            type="button"
            key={technique}
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(isSelected ? null : technique)}
            className={pillClass(isSelected)}
          >
            {t(TECHNIQUE_CONFIG[technique].labelKey)}
          </Button>
        );
      })}
    </div>
  );
}
