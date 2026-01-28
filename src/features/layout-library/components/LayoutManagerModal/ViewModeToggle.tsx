/**
 * Re-export shared ViewModeToggle with layout-specific translation bindings.
 * This maintains backward compatibility while using the shared component.
 */
import { useTranslation } from '@/i18n';
import { ViewModeToggle as SharedViewModeToggle } from '@/shared/components';
import type { ViewMode } from '@/shared/components';

export type { ViewMode };

interface LayoutViewModeToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

/**
 * Layout-specific ViewModeToggle that provides translations automatically.
 */
export function ViewModeToggle({ value, onChange }: LayoutViewModeToggleProps) {
  const t = useTranslation();

  return (
    <SharedViewModeToggle
      value={value}
      onChange={onChange}
      ariaLabel={t('layouts.viewMode')}
      listLabel={t('layouts.listView')}
      gridLabel={t('layouts.gridView')}
    />
  );
}
