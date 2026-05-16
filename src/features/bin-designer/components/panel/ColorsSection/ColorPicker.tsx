/**
 * Color picker popover content: zone header, preset grid,
 * "used in this design" row, and a custom-tools row (hex input,
 * native picker, reset).
 *
 * Live-apply: every interaction commits immediately so the 3D preview
 * tracks each change. Closing happens via click-outside / Escape.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { FILAMENT_PRESET_COLORS } from '@/core/constants';
import { Input } from '@/design-system/Input/Input';
import { RotateCcwIcon } from '@/design-system/Icon';
import { useTranslation } from '@/i18n';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';

const HEX_REGEX = /^#[0-9a-f]{6}$/i;

interface ColorPickerProps {
  zone: ColorZone;
  zoneLabel: string;
  color: string;
  /** Color this zone falls back to when the user clicks Reset. */
  defaultColor: string;
  /** Colors used by the other active zones (deduped, excludes the current color). */
  otherColors: readonly string[];
  onChange: (hex: string) => void;
  /**
   * Optional gesture hooks. ColorsSection wires these to the designer
   * store's transaction API so a continuous native-picker drag — which
   * may fire dozens of change events per second on Firefox — coalesces
   * into a single undo entry.
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
  onChange,
  onGestureStart,
  onGestureEnd,
}: ColorPickerProps) {
  const t = useTranslation();
  const [hexInput, setHexInput] = useState(color);
  const [hexError, setHexError] = useState(false);
  const nativeInputRef = useRef<HTMLInputElement>(null);

  // Keep the hex input in sync when the color changes from outside the input
  // (preset clicks, native picker, reset). Avoid clobbering an in-flight edit.
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
      // Idempotent commit. Without this guard the Enter-key path fires
      // applyHex → commitColor → blur → applyHex again, producing two
      // identical updateFeatureColors calls and a wasted undo entry.
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

  // Track whether the native picker has an open gesture so we can collapse
  // a stream of change events into a single undo entry — and recover the
  // transaction on unmount if the popover closes while the picker is still
  // focused (rare, but cheap insurance against a leaked transaction).
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
          <span className="font-mono text-[10px] uppercase text-content-tertiary tabular-nums">
            {color}
          </span>
        </div>
      </div>

      {/* Preset color grid */}
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
              />
            );
          })}
        </div>
      </div>

      {/* Used in this design (matching shortcuts) */}
      {otherColors.length > 0 && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-wide text-content-tertiary mb-1.5">
            {t('binDesigner.colors.usedInDesign')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {otherColors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => commitColor(c)}
                className="w-6 h-6 rounded-md border border-stroke-subtle/50 hover:border-stroke transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
                style={{ backgroundColor: c }}
                aria-label={t('binDesigner.colors.matchColor', { color: c })}
                title={c}
              />
            ))}
          </div>
        </div>
      )}

      {/* Custom tools: hex input + native picker + reset */}
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

        {/* Native color picker — labelled wrapper so the swatch acts as the trigger.
            Hidden <input type="color"> drives the platform picker. */}
        <label
          className="flex items-center justify-center w-7 rounded-md border border-stroke-subtle/60 cursor-pointer hover:border-stroke transition-colors focus-within:ring-2 focus-within:ring-accent focus-within:border-accent"
          style={{ backgroundColor: color }}
          title={t('binDesigner.colors.pickCustom')}
          aria-label={t('binDesigner.colors.pickCustom')}
        >
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
        <p className="text-[10px] text-error -mt-1.5">{t('binDesigner.colors.hexInvalid')}</p>
      )}
    </div>
  );
}
