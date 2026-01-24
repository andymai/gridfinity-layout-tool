/**
 * Overlay control buttons for the 3D preview.
 * Camera presets, reset view, wireframe toggle, and color picker.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';

export type CameraPreset = 'front' | 'side' | 'top' | 'isometric';

interface PreviewControlsProps {
  wireframe: boolean;
  previewColor: string;
  activePreset: CameraPreset | null;
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
  { color: '#1f2937', label: 'Black' },
  { color: '#c4b5fd', label: 'Purple' },
  { color: '#fde047', label: 'Yellow' },
];

/** SVG icon for Front preset — cube with front face highlighted */
function IconFront() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M2 5l6 3v6l-6-3V5z" fill="currentColor" opacity="0.6" />
      <path d="M2 5l6 3v6l-6-3V5z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** SVG icon for Side preset — cube with side face highlighted */
function IconSide() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M14 5l-6 3v6l6-3V5z" fill="currentColor" opacity="0.6" />
      <path d="M14 5l-6 3v6l6-3V5z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** SVG icon for Top preset — cube with top face highlighted */
function IconTop() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 5l6-3 6 3v6l-6 3-6-3V5z" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M2 5l6-3 6 3-6 3-6-3z" fill="currentColor" opacity="0.6" />
      <path d="M2 5l6-3 6 3-6 3-6-3z" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** SVG icon for Isometric preset — cube corner perspective */
function IconIso() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M2 5l6-3 6 3v6l-6 3-6-3V5z"
        fill="currentColor"
        opacity="0.15"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M8 8v6M2 5l6 3M14 5l-6 3" stroke="currentColor" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}

/** SVG icon for Reset — circular arrow */
function IconReset() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3.5 2.5v3.5H7"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 6C4.5 3.5 6.8 2 9 2c3 0 5 2.5 5 5.5S12 13 9 13c-2 0-3.7-1-4.5-2.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** SVG icon for Wireframe — grid mesh */
function IconWireframe() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M2 6h12M2 10h12M6 2v12M10 2v12"
        stroke="currentColor"
        strokeWidth="0.8"
        opacity="0.7"
      />
    </svg>
  );
}

const PRESET_ICONS: Record<CameraPreset, () => ReactNode> = {
  front: IconFront,
  side: IconSide,
  top: IconTop,
  isometric: IconIso,
};

export function PreviewControls({
  wireframe,
  previewColor,
  activePreset,
  onWireframeToggle,
  onColorChange,
  onCameraPreset,
  onResetView,
}: PreviewControlsProps) {
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const desktopPickerRef = useRef<HTMLDivElement>(null);
  const mobilePickerRef = useRef<HTMLDivElement>(null);
  const mobileColorBtnRef = useRef<HTMLButtonElement>(null);

  // Close picker on outside click
  useEffect(() => {
    if (!colorPickerOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inDesktop = desktopPickerRef.current?.contains(target);
      const inMobile = mobilePickerRef.current?.contains(target);
      const inMobileBtn = mobileColorBtnRef.current?.contains(target);
      if (!inDesktop && !inMobile && !inMobileBtn) {
        setColorPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colorPickerOpen]);

  const handleColorSelect = useCallback(
    (color: string) => {
      onColorChange(color);
      setColorPickerOpen(false);
    },
    [onColorChange]
  );

  // Close picker on Escape
  useEffect(() => {
    if (!colorPickerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setColorPickerOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [colorPickerOpen]);

  return (
    <>
      {/* Desktop: horizontal toolbar in top-right */}
      <div className="absolute right-2 top-2 hidden md:flex items-center">
        <div className="flex items-center rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden">
          {/* Camera presets group */}
          {PRESETS.map(({ key, label, shortcut }) => {
            const Icon = PRESET_ICONS[key];
            const isActive = activePreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onCameraPreset(key)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none min-h-[28px] touch-manipulation ${
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                }`}
                title={`${label} view (${shortcut})`}
                aria-label={`${label} camera view, keyboard shortcut ${shortcut}`}
                aria-pressed={isActive}
              >
                <Icon />
                <span>{label}</span>
                <kbd
                  className={`text-[9px] font-normal ${isActive ? 'text-white/60' : 'text-content-tertiary'}`}
                >
                  {shortcut}
                </kbd>
              </button>
            );
          })}

          {/* Divider */}
          <div className="w-px h-5 bg-stroke-subtle/50" />

          {/* Reset button */}
          <button
            type="button"
            onClick={onResetView}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none min-h-[28px] touch-manipulation"
            title="Reset view (R)"
            aria-label="Reset camera view, keyboard shortcut R"
          >
            <IconReset />
            <span>Reset</span>
          </button>

          {/* Wireframe toggle */}
          <button
            type="button"
            onClick={onWireframeToggle}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none min-h-[28px] touch-manipulation ${
              wireframe
                ? 'bg-accent text-white'
                : 'text-content-secondary hover:bg-surface-hover hover:text-content'
            }`}
            title="Toggle wireframe (W)"
            aria-label="Toggle wireframe mode, keyboard shortcut W"
            aria-pressed={wireframe}
          >
            <IconWireframe />
            <span>Wire</span>
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-stroke-subtle/50" />

          {/* Color picker */}
          <div className="relative" ref={desktopPickerRef}>
            <button
              type="button"
              onClick={() => setColorPickerOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none min-h-[28px] touch-manipulation"
              title="Change preview color"
              aria-label="Change preview color"
              aria-expanded={colorPickerOpen}
            >
              <span
                className="inline-block h-4 w-4 rounded border border-stroke-subtle/50"
                style={{ backgroundColor: previewColor }}
              />
              <span>Color</span>
            </button>

            {colorPickerOpen && (
              <div
                className="absolute right-0 top-full mt-2 rounded-lg border border-stroke-subtle bg-surface-elevated p-3 shadow-xl"
                role="listbox"
                aria-label="Preview color options"
              >
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_SWATCHES.map(({ color, label }) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleColorSelect(color)}
                      className={`flex flex-col items-center gap-1 rounded-md p-1.5 transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none ${
                        previewColor === color ? 'ring-2 ring-accent bg-surface-hover' : ''
                      }`}
                      aria-label={`${label} color`}
                      aria-selected={previewColor === color}
                      role="option"
                    >
                      <span
                        className={`inline-block h-8 w-8 rounded-md border transition-transform hover:scale-105 ${
                          previewColor === color ? 'border-accent' : 'border-stroke-subtle/50'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-[9px] text-content-tertiary">{label}</span>
                    </button>
                  ))}
                </div>
                {/* Custom color input */}
                <div className="mt-2.5 border-t border-stroke-subtle pt-2.5">
                  <label className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-surface-hover transition-colors">
                    <input
                      type="color"
                      value={previewColor}
                      onChange={(e) => onColorChange(e.target.value)}
                      className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                      title="Custom color"
                    />
                    <span className="text-[11px] text-content-secondary font-medium">
                      Custom...
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile: compact vertical column in bottom-left */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-1 md:hidden">
        {/* Camera presets in a compact pill row */}
        <div className="flex rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden">
          {PRESETS.map(({ key, label, shortcut }) => {
            const Icon = PRESET_ICONS[key];
            const isActive = activePreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onCameraPreset(key)}
                className={`flex items-center justify-center p-2 min-w-[36px] min-h-[36px] transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation ${
                  isActive
                    ? 'bg-accent text-white'
                    : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                }`}
                title={`${label} view (${shortcut})`}
                aria-label={`${label} camera view, keyboard shortcut ${shortcut}`}
                aria-pressed={isActive}
              >
                <Icon />
              </button>
            );
          })}
        </div>

        {/* Action buttons row */}
        <div className="flex rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden">
          {/* Reset */}
          <button
            type="button"
            onClick={onResetView}
            className="flex items-center justify-center p-2 min-w-[36px] min-h-[36px] text-content-secondary transition-colors hover:bg-surface-hover hover:text-content focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation"
            title="Reset view (R)"
            aria-label="Reset camera view, keyboard shortcut R"
          >
            <IconReset />
          </button>

          {/* Wireframe */}
          <button
            type="button"
            onClick={onWireframeToggle}
            className={`flex items-center justify-center p-2 min-w-[36px] min-h-[36px] transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation ${
              wireframe
                ? 'bg-accent text-white'
                : 'text-content-secondary hover:bg-surface-hover hover:text-content'
            }`}
            title="Toggle wireframe (W)"
            aria-label="Toggle wireframe mode, keyboard shortcut W"
            aria-pressed={wireframe}
          >
            <IconWireframe />
          </button>

          {/* Color picker */}
          <div className="relative">
            <button
              ref={mobileColorBtnRef}
              type="button"
              onClick={() => setColorPickerOpen((v) => !v)}
              className="flex items-center justify-center p-2 min-w-[36px] min-h-[36px] text-content-secondary transition-colors hover:bg-surface-hover hover:text-content focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation"
              title="Change preview color"
              aria-label="Change preview color"
              aria-expanded={colorPickerOpen}
            >
              <span
                className="inline-block h-4 w-4 rounded border border-stroke-subtle/50"
                style={{ backgroundColor: previewColor }}
              />
            </button>
          </div>
        </div>

        {/* Mobile color picker popover — opens above */}
        {colorPickerOpen && (
          <div
            ref={mobilePickerRef}
            className="absolute bottom-full left-0 mb-2 rounded-lg border border-stroke-subtle bg-surface-elevated p-3 shadow-xl"
            role="listbox"
            aria-label="Preview color options"
          >
            <div className="grid grid-cols-3 gap-2">
              {COLOR_SWATCHES.map(({ color, label }) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => handleColorSelect(color)}
                  className={`flex flex-col items-center gap-1 rounded-md p-1.5 transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none ${
                    previewColor === color ? 'ring-2 ring-accent bg-surface-hover' : ''
                  }`}
                  aria-label={`${label} color`}
                  aria-selected={previewColor === color}
                  role="option"
                >
                  <span
                    className={`inline-block h-8 w-8 rounded-md border transition-transform hover:scale-105 ${
                      previewColor === color ? 'border-accent' : 'border-stroke-subtle/50'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[9px] text-content-tertiary">{label}</span>
                </button>
              ))}
            </div>
            {/* Custom color input */}
            <div className="mt-2.5 border-t border-stroke-subtle pt-2.5">
              <label className="flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-surface-hover transition-colors">
                <input
                  type="color"
                  value={previewColor}
                  onChange={(e) => onColorChange(e.target.value)}
                  className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
                  title="Custom color"
                />
                <span className="text-[11px] text-content-secondary font-medium">Custom...</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
