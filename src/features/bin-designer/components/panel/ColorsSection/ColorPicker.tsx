/**
 * Color picker popover content: zone header, preset grid,
 * "used in this design" row, and a custom-tools row (hex input,
 * native picker, reset). Live-apply: each interaction commits
 * immediately so the 3D preview tracks every change.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FILAMENT_PRESET_COLORS } from '@/core/constants';
import { Input } from '@/design-system/Input/Input';
import { CheckIcon, PipetteIcon, RotateCcwIcon, SparklesIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';
import { suggestMatchingColors } from '@/features/bin-designer/utils/colorSuggestions';

const HEX_REGEX = /^#[0-9a-f]{6}$/i;

interface ColorPickerProps {
  zone: ColorZone;
  zoneLabel: string;
  color: string;
  /** Color this zone falls back to when the user clicks Reset. */
  defaultColor: string;
  /** Colors used by the other active zones (deduped, excludes the current color). */
  otherColors: readonly string[];
  /** Body color, used to seed AI suggestions. Empty string = no suggestion source. */
  bodyColor: string;
  /** Session-scoped recent colors the user committed elsewhere. */
  recentColors: readonly string[];
  onChange: (hex: string) => void;
  /**
   * Native-picker gesture hooks. ColorsSection wires these to the
   * designer store's transaction API so a drag — which may fire dozens
   * of change events on Firefox — collapses into a single undo entry.
   */
  onGestureStart?: () => void;
  onGestureEnd?: () => void;
}

export function ColorPicker({
  zone,
  zoneLabel,
  color,
  defaultColor,
  otherColors,
  bodyColor,
  recentColors,
  onChange,
  onGestureStart,
  onGestureEnd,
}: ColorPickerProps) {
  const t = useTranslation();
  const [hexInput, setHexInput] = useState(color);
  const [hexError, setHexError] = useState(false);
  const [suggestions, setSuggestions] = useState<readonly string[]>([]);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (document.activeElement !== nativeInputRef.current) {
      setHexInput(color);
      setHexError(false);
    }
  }, [color]);

  const commitColor = useCallback(
    (next: string) => {
      const lower = next.toLowerCase();
      setHexInput(lower);
      setHexError(false);
      // Idempotent: Enter→applyHex→blur→applyHex must not produce two
      // updateFeatureColors calls (one wasted undo entry).
      if (lower === color.toLowerCase()) return;
      onChange(lower);
    },
    [color, onChange]
  );

  const applyHex = useCallback(
    (value: string) => {
      const trimmed = value.trim();
      const normalized = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
      if (HEX_REGEX.test(normalized)) {
        commitColor(normalized);
      } else {
        setHexError(true);
      }
    },
    [commitColor]
  );

  const gestureOpenRef = useRef(false);
  const beginGesture = useCallback(() => {
    if (gestureOpenRef.current) return;
    gestureOpenRef.current = true;
    onGestureStart?.();
  }, [onGestureStart]);
  const endGesture = useCallback(() => {
    if (!gestureOpenRef.current) return;
    gestureOpenRef.current = false;
    onGestureEnd?.();
  }, [onGestureEnd]);
  useEffect(() => endGesture, [endGesture]);

  const isAtDefault = color.toLowerCase() === defaultColor.toLowerCase();

  const handleSuggest = useCallback(() => {
    if (!bodyColor) return;
    setSuggestions(suggestMatchingColors(bodyColor));
  }, [bodyColor]);

  return (
    <div className="w-60 p-3 space-y-3" data-zone={zone}>
      {/* Zone header */}
      <div className="flex items-center gap-2 pb-2 border-b border-stroke-subtle/50">
        <span
          className="w-5 h-5 rounded-md border border-stroke-subtle/60 shrink-0 shadow-inner"
          style={{ backgroundColor: color }}
        />
        <div className="flex flex-1 flex-col leading-tight min-w-0">
          <span className="text-xs font-medium text-content truncate">{zoneLabel}</span>
          <span className="font-mono text-[11px] text-content-secondary tabular-nums">{color}</span>
        </div>
        {!isAtDefault && (
          <span className="font-mono text-[10px] text-content-tertiary tabular-nums whitespace-nowrap">
            {t('binDesigner.colors.resetDefaultHint', { color: defaultColor })}
          </span>
        )}
      </div>

      {/* Preset grid */}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-content-tertiary mb-1.5">
          {t('binDesigner.colors.presets')}
        </p>
        <div className="grid grid-cols-5 gap-1.5">
          {FILAMENT_PRESET_COLORS.map(({ color: presetColor, name }) => {
            const isSelected = color.toLowerCase() === presetColor.toLowerCase();
            return (
              <button
                key={presetColor}
                type="button"
                onClick={() => commitColor(presetColor)}
                className={`relative w-8 h-8 rounded-md border transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                  isSelected
                    ? 'ring-2 ring-accent border-accent'
                    : 'border-stroke-subtle/50 hover:border-stroke'
                }`}
                style={{ backgroundColor: presetColor }}
                aria-label={name}
                aria-pressed={isSelected}
                title={name}
              >
                {isSelected && (
                  <CheckIcon
                    size="sm"
                    className="absolute inset-0 m-auto text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.7)]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Used in this design (always rendered; empty state when no other zones differ) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-content-tertiary">
            {t('binDesigner.colors.usedInDesign')}
          </p>
          {bodyColor && (
            <button
              type="button"
              onClick={handleSuggest}
              className="flex items-center gap-1 text-[10px] text-content-tertiary hover:text-content-secondary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent rounded px-1"
              title={t('binDesigner.colors.suggest')}
              aria-label={t('binDesigner.colors.suggest')}
            >
              <SparklesIcon size="sm" className="text-accent" />
            </button>
          )}
        </div>
        {otherColors.length === 0 && suggestions.length === 0 && recentColors.length === 0 ? (
          <p className="text-[11px] text-content-tertiary italic">
            {t('binDesigner.colors.usedInDesign.empty')}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {otherColors.map((c) => (
              <ColorSwatch
                key={`zone-${c}`}
                color={c}
                onClick={() => commitColor(c)}
                ariaLabel={t('binDesigner.colors.matchColor', { color: c })}
              />
            ))}
            {recentColors
              .filter((c) => !otherColors.includes(c) && c.toLowerCase() !== color.toLowerCase())
              .slice(0, 4)
              .map((c) => (
                <ColorSwatch
                  key={`recent-${c}`}
                  color={c}
                  onClick={() => commitColor(c)}
                  ariaLabel={t('binDesigner.colors.matchColor', { color: c })}
                />
              ))}
            {suggestions.map((c) => (
              <ColorSwatch
                key={`sug-${c}`}
                color={c}
                onClick={() => commitColor(c)}
                ariaLabel={t('binDesigner.colors.matchColor', { color: c })}
                accent
              />
            ))}
          </div>
        )}
      </div>

      {/* Custom tools */}
      <div>
        <p className="text-[10px] font-medium uppercase tracking-wide text-content-tertiary mb-1.5">
          {t('binDesigner.colors.customTools')}
        </p>
        <div className="flex items-stretch gap-1.5">
          <div className="flex-1">
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
              placeholder="#000000" // eslint-disable-line i18next/no-literal-string -- hex format placeholder, not translatable
            />
          </div>

          <label
            className="relative flex items-center justify-center w-7 rounded-md border border-stroke-subtle/60 cursor-pointer hover:border-stroke transition-colors focus-within:ring-2 focus-within:ring-accent focus-within:border-accent"
            style={{ backgroundColor: color }}
            title={t('binDesigner.colors.pickCustom')}
            aria-label={t('binDesigner.colors.pickCustom')}
          >
            <PipetteIcon
              size="sm"
              className="text-white drop-shadow-[0_0_2px_rgba(0,0,0,0.6)] pointer-events-none mix-blend-difference"
            />
            <input
              ref={nativeInputRef}
              type="color"
              value={color}
              onFocus={beginGesture}
              onBlur={endGesture}
              onChange={(e) => commitColor(e.target.value)}
              className="sr-only"
            />
          </label>

          <button
            type="button"
            onClick={() => commitColor(defaultColor)}
            disabled={isAtDefault}
            className="flex items-center justify-center w-7 rounded-md border border-stroke-subtle/60 text-content-tertiary hover:text-content-secondary hover:border-stroke transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
            title={t('binDesigner.colors.resetToDefault')}
            aria-label={t('binDesigner.colors.resetToDefault')}
          >
            <RotateCcwIcon size="sm" />
          </button>
        </div>
        {hexError && (
          <p className="text-[10px] text-error mt-1.5">{t('binDesigner.colors.hexInvalid')}</p>
        )}
      </div>
    </div>
  );
}

function ColorSwatch({
  color,
  onClick,
  ariaLabel,
  accent,
}: {
  color: string;
  onClick: () => void;
  ariaLabel: string;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-6 h-6 rounded-md border transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
        accent
          ? 'border-accent/60 hover:border-accent'
          : 'border-stroke-subtle/50 hover:border-stroke'
      }`}
      style={{ backgroundColor: color }}
      aria-label={ariaLabel}
      title={color}
    />
  );
}
