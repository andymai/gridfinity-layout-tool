import { useCallback } from 'react';
import { useTranslation } from '@/i18n';

export type ViewMode = 'list' | 'grid';

interface ViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

/**
 * Toggle button pair for switching between list and grid view.
 * Implements proper radiogroup keyboard navigation.
 */
export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  const t = useTranslation();

  // Handle arrow key navigation for radiogroup
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const listKeys = ['ArrowLeft', 'ArrowUp', 'Home'];
      const gridKeys = ['ArrowRight', 'ArrowDown', 'End'];

      if (listKeys.includes(e.key)) {
        e.preventDefault();
        onChange('list');
      } else if (gridKeys.includes(e.key)) {
        e.preventDefault();
        onChange('grid');
      }
    },
    [onChange]
  );

  const buttonClass = (isSelected: boolean): string =>
    `p-1.5 rounded-md transition-colors ${
      isSelected
        ? 'bg-accent text-on-dark'
        : 'text-content-secondary hover:text-content hover:bg-surface-secondary'
    }`;

  return (
    <div
      className="flex rounded-lg bg-surface p-0.5 border border-stroke"
      role="radiogroup"
      aria-label={t('layouts.viewMode')}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === 'list'}
        tabIndex={value === 'list' ? 0 : -1}
        onClick={() => onChange('list')}
        className={buttonClass(value === 'list')}
        aria-label={t('layouts.listView')}
        title={t('layouts.listView')}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        </svg>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'grid'}
        tabIndex={value === 'grid' ? 0 : -1}
        onClick={() => onChange('grid')}
        className={buttonClass(value === 'grid')}
        aria-label={t('layouts.gridView')}
        title={t('layouts.gridView')}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
          />
        </svg>
      </button>
    </div>
  );
}
