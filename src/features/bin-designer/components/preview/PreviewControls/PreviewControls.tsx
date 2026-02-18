/**
 * Overlay control buttons for the 3D preview.
 * Camera presets, reset view, wireframe toggle, and color picker.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from '@/i18n';
import { CATEGORY_COLOR_PALETTE } from '@/core/constants';
import { useResponsive } from '@/shared/hooks/useResponsive';

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

/** Shared color picker content used in both desktop and mobile popovers */
function ColorPickerContent({
  previewColor,
  onColorSelect,
}: {
  previewColor: string;
  onColorSelect: (color: string) => void;
}) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {CATEGORY_COLOR_PALETTE.map(({ color, name }) => (
        <button
          key={color}
          type="button"
          onClick={() => onColorSelect(color)}
          className={`rounded-md p-0.5 transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none ${
            previewColor === color ? 'ring-2 ring-accent bg-surface-hover' : ''
          }`}
          aria-label={`${name} color`}
          aria-selected={previewColor === color}
          role="option"
        >
          <span
            className={`inline-block h-6 w-6 rounded border transition-transform hover:scale-105 ${
              previewColor === color ? 'border-accent' : 'border-stroke-subtle/50'
            }`}
            style={{ backgroundColor: color }}
          />
        </button>
      ))}
    </div>
  );
}

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
  const t = useTranslation();
  const { isDesktop } = useResponsive();

  // Close picker on outside click (desktop only — mobile uses backdrop)
  useEffect(() => {
    if (!colorPickerOpen || !isDesktop) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!desktopPickerRef.current?.contains(target)) {
        setColorPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [colorPickerOpen, isDesktop]);

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
      <div className="absolute right-2 top-2 hidden md:flex items-center" ref={desktopPickerRef}>
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
                    ? 'bg-accent text-on-accent'
                    : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                }`}
                title={`${label} view (${shortcut})`}
                aria-label={`${label} camera view, keyboard shortcut ${shortcut}`}
                aria-pressed={isActive}
              >
                <Icon />
                <span>{label}</span>
                <kbd
                  className={`text-[9px] font-normal ${isActive ? 'text-on-accent/60' : 'text-content-tertiary'}`}
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
            title={t('binDesigner.resetView')}
            aria-label={t('binDesigner.resetCameraViewKeyboardShortcutR')}
          >
            <IconReset />
            <span>{t('common.reset')}</span>
          </button>

          {/* Wireframe toggle */}
          <button
            type="button"
            onClick={onWireframeToggle}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none min-h-[28px] touch-manipulation ${
              wireframe
                ? 'bg-accent text-on-accent'
                : 'text-content-secondary hover:bg-surface-hover hover:text-content'
            }`}
            title={t('binDesigner.toggleWireframe')}
            aria-label={t('binDesigner.toggleWireframeModeKeyboardShortcut')}
            aria-pressed={wireframe}
          >
            <IconWireframe />
            <span>{t('binDesigner.wire')}</span>
          </button>

          {/* Divider */}
          <div className="w-px h-5 bg-stroke-subtle/50" />

          {/* Color picker button */}
          <button
            type="button"
            onClick={() => setColorPickerOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none min-h-[28px] touch-manipulation"
            title={t('binDesigner.changeColor')}
            aria-label={t('binDesigner.changePreviewColor')}
            aria-expanded={colorPickerOpen}
          >
            <span
              className="inline-block h-4 w-4 rounded border border-stroke-subtle/50"
              style={{ backgroundColor: previewColor }}
            />
            <span>{t('common.color')}</span>
          </button>
        </div>

        {/* Color picker dropdown - outside overflow-hidden container */}
        {colorPickerOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-2 rounded-lg border border-stroke-subtle bg-surface-elevated p-3 shadow-xl"
            role="listbox"
            aria-label={t('binDesigner.previewColorOptions')}
          >
            <ColorPickerContent previewColor={previewColor} onColorSelect={handleColorSelect} />
          </div>
        )}
      </div>

      {/* Mobile: single compact horizontal strip at top edge */}
      <div className="absolute inset-x-2 top-2 z-30 md:hidden">
        <div className="flex items-center rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden">
          {/* Camera presets */}
          {PRESETS.map(({ key, label, shortcut }) => {
            const Icon = PRESET_ICONS[key];
            const isActive = activePreset === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onCameraPreset(key)}
                className={`flex items-center justify-center min-w-[44px] min-h-[44px] p-2 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation ${
                  isActive
                    ? 'bg-accent text-on-accent'
                    : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                }`}
                title={`${label} view (${shortcut})`}
                aria-label={`${label} camera view`}
                aria-pressed={isActive}
              >
                <Icon />
              </button>
            );
          })}

          {/* Divider */}
          <div className="w-px h-5 bg-stroke-subtle/50" />

          {/* Reset */}
          <button
            type="button"
            onClick={onResetView}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 text-content-secondary transition-colors hover:bg-surface-hover hover:text-content focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation"
            title={t('binDesigner.resetView')}
            aria-label={t('binDesigner.resetCameraViewKeyboardShortcutR')}
          >
            <IconReset />
          </button>

          {/* Wireframe */}
          <button
            type="button"
            onClick={onWireframeToggle}
            className={`flex items-center justify-center min-w-[44px] min-h-[44px] p-2 transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation ${
              wireframe
                ? 'bg-accent text-on-accent'
                : 'text-content-secondary hover:bg-surface-hover hover:text-content'
            }`}
            title={t('binDesigner.toggleWireframe')}
            aria-label={t('binDesigner.toggleWireframeModeKeyboardShortcut')}
            aria-pressed={wireframe}
          >
            <IconWireframe />
          </button>

          {/* Spacer to push color picker to right */}
          <div className="flex-1" />

          {/* Color picker */}
          <button
            type="button"
            onClick={() => setColorPickerOpen((v) => !v)}
            className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 text-content-secondary transition-colors hover:bg-surface-hover hover:text-content focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation"
            title={t('binDesigner.changeColor')}
            aria-label={t('binDesigner.changePreviewColor')}
            aria-expanded={colorPickerOpen}
          >
            <span
              className="inline-block h-4 w-4 rounded border border-stroke-subtle/50"
              style={{ backgroundColor: previewColor }}
            />
          </button>
        </div>
      </div>

      {/* Mobile color picker — bottom sheet style overlay */}
      {colorPickerOpen && !isDesktop && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- decorative backdrop, keyboard users dismiss via Escape */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setColorPickerOpen(false)} />
          {/* Sheet */}
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface-elevated p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl">
            <div className="mx-auto mb-3 h-1 w-8 rounded-full bg-stroke-subtle/50" />
            <p className="mb-3 text-sm font-medium text-content">
              {t('binDesigner.changePreviewColor')}
            </p>
            <div role="listbox" aria-label={t('binDesigner.previewColorOptions')}>
              <ColorPickerContent previewColor={previewColor} onColorSelect={handleColorSelect} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
