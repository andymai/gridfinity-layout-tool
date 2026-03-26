/**
 * Color picker popover content: preset filament color grid + hex input.
 *
 * No palette concept — just pick a color directly.
 */

import { useState, useCallback } from 'react';
import { FILAMENT_PRESET_COLORS } from '@/core/constants';
import { Input } from '@/design-system/Input/Input';
import { useTranslation } from '@/i18n';

const HEX_REGEX = /^#[0-9a-f]{6}$/i;

interface ColorPickerProps {
  color: string;
  onChange: (hex: string) => void;
}

export function ColorPicker({ color, onChange }: ColorPickerProps) {
  const t = useTranslation();
  const [hexInput, setHexInput] = useState(color);
  const [hexError, setHexError] = useState(false);

  const applyHex = useCallback(
    (value: string) => {
      const normalized = value.startsWith('#') ? value : `#${value}`;
      if (HEX_REGEX.test(normalized)) {
        setHexError(false);
        setHexInput(normalized);
        onChange(normalized);
      } else {
        setHexError(true);
      }
    },
    [onChange]
  );

  const handlePresetClick = useCallback(
    (presetColor: string) => {
      setHexInput(presetColor);
      setHexError(false);
      onChange(presetColor);
    },
    [onChange]
  );

  return (
    <div className="w-56 p-3 space-y-3">
      {/* Preset color grid */}
      <div>
        <p className="text-[10px] font-medium text-content-tertiary mb-1.5">
          {t('binDesigner.colors.presets')}
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {FILAMENT_PRESET_COLORS.map(({ color: presetColor, name }) => (
            <button
              key={presetColor}
              type="button"
              onClick={() => handlePresetClick(presetColor)}
              className={`w-8 h-8 rounded-md border transition-colors hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                color === presetColor
                  ? 'ring-2 ring-accent border-accent'
                  : 'border-stroke-subtle/50 hover:border-stroke'
              }`}
              style={{ backgroundColor: presetColor }}
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
            style={{ backgroundColor: color }}
          />
        }
      />
      {hexError && <p className="text-[10px] text-error">{t('binDesigner.colors.hexInvalid')}</p>}
    </div>
  );
}
