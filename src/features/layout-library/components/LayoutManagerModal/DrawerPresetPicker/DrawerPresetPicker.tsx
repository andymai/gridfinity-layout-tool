import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { useSettingsStore } from '@/core/store/settings';
import { DRAWER_PRESETS, type DrawerPreset } from '@/features/layout-library/constants';

interface DrawerPresetPickerProps {
  onSelect: (drawer: { width: number; depth: number; height: number }) => void;
  onCancel: () => void;
}

const BASE_BUTTON_CLASSES =
  'text-left rounded-lg border-2 p-3 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent';

function presetButtonClass(selected: boolean): string {
  return `${BASE_BUTTON_CLASSES} ${selected ? 'border-accent bg-accent/10' : 'border-stroke hover:border-accent/50 bg-surface-secondary'}`;
}

export function DrawerPresetPicker({ onSelect, onCancel }: DrawerPresetPickerProps) {
  const t = useTranslation();
  const settings = useSettingsStore((state) => state.settings);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const customDrawer = {
    width: settings.defaultDrawerWidth,
    depth: settings.defaultDrawerDepth,
    height: settings.defaultDrawerHeight,
  };

  const gridUnitMm = settings.defaultGridUnitMm;

  const handleConfirm = () => {
    if (selectedId === null) return;
    if (selectedId === 'custom') {
      onSelect(customDrawer);
      return;
    }
    const preset = DRAWER_PRESETS.find((p) => p.id === selectedId);
    if (preset) onSelect(preset.drawer);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-content-secondary">{t('presets.chooseSize')}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {DRAWER_PRESETS.map((preset) => (
          <PresetCard
            key={preset.id}
            preset={preset}
            gridUnitMm={gridUnitMm}
            selected={selectedId === preset.id}
            onSelect={() => setSelectedId(preset.id)}
          />
        ))}

        {/* Custom preset using saved defaults */}
        <button
          onClick={() => setSelectedId('custom')}
          className={presetButtonClass(selectedId === 'custom')}
        >
          <div className="font-medium text-sm text-content">{t('presets.custom')}</div>
          <div className="text-xs text-content-secondary mt-1">
            {customDrawer.width} × {customDrawer.depth} × {customDrawer.height}
          </div>
          <div className="text-xs text-content-tertiary">{t('presets.savedDefaults')}</div>
        </button>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={onCancel}
          className="rounded-md border border-stroke bg-surface px-3 py-1.5 text-sm font-medium text-content transition-colors hover:bg-surface-hover"
        >
          {t('common.cancel')}
        </button>
        <button
          onClick={handleConfirm}
          disabled={selectedId === null}
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {t('presets.createLayout')}
        </button>
      </div>
    </div>
  );
}

function PresetCard({
  preset,
  gridUnitMm,
  selected,
  onSelect,
}: {
  preset: DrawerPreset;
  gridUnitMm: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslation();
  const { drawer } = preset;
  const widthMm = drawer.width * gridUnitMm;
  const depthMm = drawer.depth * gridUnitMm;

  return (
    <button onClick={onSelect} className={presetButtonClass(selected)}>
      <div className="font-medium text-sm text-content">{t(preset.labelKey)}</div>
      <div className="text-xs text-content-secondary mt-1">
        {drawer.width} × {drawer.depth} × {drawer.height}
      </div>
      <div className="text-xs text-content-tertiary">
        {widthMm} × {depthMm}mm
      </div>
    </button>
  );
}
