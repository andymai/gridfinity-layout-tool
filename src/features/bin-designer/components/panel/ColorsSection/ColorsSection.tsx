/**
 * Colors section: assign filament slots to bin features.
 *
 * Controls: body/lip/labelTab filament dropdowns.
 * Shows only when multi_color_export Labs flag is enabled.
 */

import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useSettingsStore } from '@/core/store';
import { useTranslation } from '@/i18n';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import type { FilamentSlotId } from '@/features/bin-designer/types/featureColors';

/** Single filament slot dropdown with color swatch */
function FilamentSelect({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: FilamentSlotId;
  onChange: (slotId: FilamentSlotId) => void;
  disabled?: boolean;
}) {
  const palette = useSettingsStore((s) => s.settings.filamentPalette);

  return (
    <div className={`flex items-center justify-between gap-2 ${disabled ? 'opacity-40' : ''}`}>
      <label htmlFor={id} className="text-xs text-content-secondary">
        {label}
      </label>
      <div className="relative flex items-center">
        <div
          className="absolute left-2 w-3 h-3 rounded-full border border-stroke-subtle pointer-events-none"
          style={{ backgroundColor: palette.find((s) => s.id === value)?.color ?? '#888' }}
        />
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value as FilamentSlotId)}
          disabled={disabled}
          className="appearance-none rounded-md bg-surface-secondary text-content-primary text-xs py-1.5 pl-7 pr-6 border border-stroke-subtle disabled:cursor-not-allowed"
        >
          {palette.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {slot.name}
            </option>
          ))}
        </select>
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className="w-3 h-3 text-content-secondary"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

export function ColorsSection() {
  const t = useTranslation();

  const { featureColors, hasLip, hasLabelTabs } = useDesignerStore(
    useShallow((s) => ({
      featureColors: s.params.featureColors ?? DEFAULT_FEATURE_COLOR_CONFIG,
      hasLip: s.params.base.stackingLip,
      hasLabelTabs: s.params.label.enabled,
    }))
  );

  const updateFeatureColors = useDesignerStore((s) => s.updateFeatureColors);

  return (
    <div className="space-y-3">
      <FilamentSelect
        id="filament-body"
        label={t('binDesigner.colors.body')}
        value={featureColors.body}
        onChange={(slotId) => updateFeatureColors({ body: slotId })}
      />
      <FilamentSelect
        id="filament-lip"
        label={t('binDesigner.colors.lip')}
        value={featureColors.lip}
        onChange={(slotId) => updateFeatureColors({ lip: slotId })}
        disabled={!hasLip}
      />
      <FilamentSelect
        id="filament-label-tab"
        label={t('binDesigner.colors.labelTab')}
        value={featureColors.labelTab}
        onChange={(slotId) => updateFeatureColors({ labelTab: slotId })}
        disabled={!hasLabelTabs}
      />
    </div>
  );
}
