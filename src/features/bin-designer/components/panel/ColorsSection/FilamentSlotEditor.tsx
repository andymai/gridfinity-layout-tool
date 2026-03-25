/**
 * Popover content for editing a single filament slot (name + color).
 *
 * Provides a name input, preset color grid, and hex color input.
 * Saves immediately to the global settings store palette.
 */

import { useState, useCallback } from 'react';
import { useSettingsStore } from '@/core/store';
import { FILAMENT_PRESET_COLORS } from '@/core/constants';
import { Input } from '@/design-system/Input/Input';
import { useTranslation } from '@/i18n';
import type { FilamentSlot, FilamentSlotId } from '@/features/bin-designer/types/featureColors';

const HEX_REGEX = /^#[0-9a-f]{6}$/i;
const MAX_NAME_LENGTH = 20;

interface FilamentSlotEditorProps {
  slot: FilamentSlot;
}

/** Update a single slot in the palette array */
function updatePaletteSlot(slotId: FilamentSlotId, updates: Partial<FilamentSlot>) {
  const { settings, updateSetting } = useSettingsStore.getState();
  const updatedPalette = settings.filamentPalette.map((s) =>
    s.id === slotId ? { ...s, ...updates } : s
  );
  updateSetting('filamentPalette', updatedPalette);
}

export function FilamentSlotEditor({ slot }: FilamentSlotEditorProps) {
  const t = useTranslation();
  const [hexInput, setHexInput] = useState(slot.color);
  const [hexError, setHexError] = useState(false);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const name = e.target.value.slice(0, MAX_NAME_LENGTH);
      updatePaletteSlot(slot.id, { name });
    },
    [slot.id]
  );

  const applyHex = useCallback(
    (value: string) => {
      const normalized = value.startsWith('#') ? value : `#${value}`;
      if (HEX_REGEX.test(normalized)) {
        setHexError(false);
        setHexInput(normalized);
        updatePaletteSlot(slot.id, { color: normalized });
      } else {
        setHexError(true);
      }
    },
    [slot.id]
  );

  const handlePresetClick = useCallback(
    (color: string) => {
      setHexInput(color);
      setHexError(false);
      updatePaletteSlot(slot.id, { color });
    },
    [slot.id]
  );

  return (
    <div className="w-56 p-3 space-y-3">
      {/* Slot name */}
      <Input
        size="sm"
        value={slot.name}
        onChange={handleNameChange}
        maxLength={MAX_NAME_LENGTH}
        aria-label={t('binDesigner.colors.slotName')}
        placeholder={t('binDesigner.colors.slotName')}
      />

      {/* Preset color grid */}
      <div>
        <p className="text-[10px] font-medium text-content-tertiary mb-1.5">
          {t('binDesigner.colors.presets')}
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {FILAMENT_PRESET_COLORS.map(({ color, name }) => (
            <button
              key={color}
              type="button"
              onClick={() => handlePresetClick(color)}
              className={`w-8 h-8 rounded-md border transition-colors hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                slot.color === color
                  ? 'ring-2 ring-accent border-accent'
                  : 'border-stroke-subtle/50 hover:border-stroke'
              }`}
              style={{ backgroundColor: color }}
              aria-label={name}
              title={name}
            />
          ))}
        </div>
      </div>

      {/* Hex color input */}
      <Input
        size="sm"
        value={hexInput}
        onChange={(e) => {
          setHexInput(e.target.value);
          setHexError(false);
        }}
        onBlur={() => applyHex(hexInput)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') applyHex(hexInput);
        }}
        error={hexError}
        aria-label={t('binDesigner.colors.hexColor')}
        placeholder="#000000" // eslint-disable-line i18next/no-literal-string
        leftIcon={
          <span
            className="w-3.5 h-3.5 rounded-sm border border-stroke-subtle/50"
            style={{ backgroundColor: slot.color }}
          />
        }
      />
      {hexError && <p className="text-[10px] text-error">{t('binDesigner.colors.hexInvalid')}</p>}
    </div>
  );
}
