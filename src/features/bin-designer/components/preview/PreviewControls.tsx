/**
 * Overlay control buttons for the 3D preview.
 * Camera presets, reset view, wireframe toggle, and color picker.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

export type CameraPreset = 'front' | 'side' | 'top' | 'isometric';

interface PreviewControlsProps {
  wireframe: boolean;
  previewColor: string;
  onWireframeToggle: () => void;
  onColorChange: (color: string) => void;
  onCameraPreset: (preset: CameraPreset) => void;
  onResetView: () => void;
}

const PRESETS: Array<{ key: CameraPreset; label: string; shortcut: string }> = [
  { key: 'front', label: 'Front', shortcut: '1' },
  { key: 'side', label: 'Side', shortcut: '2' },
  { key: 'top', label: 'Top', shortcut: '3' },
  { key: 'isometric', label: 'Iso', shortcut: '4' },
];

/** Preset color swatches for the bin preview */
const COLOR_SWATCHES = [
  { color: '#d4d8dc', label: 'Gray' },
  { color: '#93c5fd', label: 'Blue' },
  { color: '#86efac', label: 'Green' },
  { color: '#fdba74', label: 'Orange' },
  { color: '#f9fafb', label: 'White' },
  { color: '#fca5a5', label: 'Red' },
];

export function PreviewControls({
  wireframe,
  previewColor,
  onWireframeToggle,
  onColorChange,
  onCameraPreset,
  onResetView,
}: PreviewControlsProps) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!colorPickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setColorPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colorPickerOpen]);

  const handleColorSelect = useCallback((color: string) => {
    onColorChange(color);
    setColorPickerOpen(false);
  }, [onColorChange]);

  // Shared button styles — min 36px touch target
  const baseBtn = "rounded-md bg-surface-elevated/80 px-2.5 py-1.5 text-[11px] font-medium text-content-secondary shadow-sm backdrop-blur transition-colors hover:bg-surface-elevated hover:text-content min-w-[36px] min-h-[32px] md:min-h-[28px] touch-manipulation";

  return (
    <div className="absolute right-2 top-2 flex flex-col gap-1.5">
      {/* Camera presets */}
      {PRESETS.map(({ key, label, shortcut }) => (
        <button
          key={key}
          type="button"
          onClick={() => onCameraPreset(key)}
          className={baseBtn}
          title={`${label} view (${shortcut})`}
          aria-label={`${label} camera view`}
        >
          {label}
        </button>
      ))}

      <div className="my-0.5 h-px bg-stroke-subtle/50" />

      {/* Reset view */}
      <button
        type="button"
        onClick={onResetView}
        className={baseBtn}
        title="Reset view (R)"
        aria-label="Reset camera view"
      >
        Reset
      </button>

      {/* Wireframe toggle */}
      <button
        type="button"
        onClick={onWireframeToggle}
        className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur transition-colors min-w-[36px] min-h-[32px] md:min-h-[28px] touch-manipulation ${
          wireframe
            ? 'bg-accent text-white'
            : 'bg-surface-elevated/80 text-content-secondary hover:bg-surface-elevated hover:text-content'
        }`}
        title="Toggle wireframe (W)"
        aria-label="Toggle wireframe mode"
        aria-pressed={wireframe}
      >
        Wire
      </button>

      <div className="my-0.5 h-px bg-stroke-subtle/50" />

      {/* Color picker */}
      <div className="relative" ref={pickerRef}>
        <button
          type="button"
          onClick={() => setColorPickerOpen((v) => !v)}
          className={`${baseBtn} flex items-center justify-center gap-1`}
          title="Change preview color"
          aria-label="Change preview color"
          aria-expanded={colorPickerOpen}
        >
          <span
            className="inline-block h-3.5 w-3.5 rounded-sm border border-stroke-subtle/50"
            style={{ backgroundColor: previewColor }}
          />
        </button>

        {colorPickerOpen && (
          <div
            className="absolute right-full top-0 mr-2 rounded-lg border border-stroke-subtle bg-surface-elevated p-2 shadow-xl"
            role="listbox"
            aria-label="Preview color options"
          >
            <div className="grid grid-cols-3 gap-1.5">
              {COLOR_SWATCHES.map(({ color, label }) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorSelect(color)}
                  className={`flex h-7 w-7 items-center justify-center rounded-md border transition-transform hover:scale-110 ${
                    previewColor === color
                      ? 'border-accent ring-1 ring-accent'
                      : 'border-stroke-subtle/50'
                  }`}
                  style={{ backgroundColor: color }}
                  title={label}
                  aria-label={`${label} color`}
                  aria-selected={previewColor === color}
                  role="option"
                />
              ))}
            </div>
            {/* Custom color input */}
            <div className="mt-2 border-t border-stroke-subtle pt-2">
              <label className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={previewColor}
                  onChange={(e) => onColorChange(e.target.value)}
                  className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
                  title="Custom color"
                />
                <span className="text-[10px] text-content-tertiary">Custom</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
