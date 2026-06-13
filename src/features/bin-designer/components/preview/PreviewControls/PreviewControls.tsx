/**
 * Overlay control buttons for the 3D preview.
 * Camera presets, reset view, wireframe toggle, and color picker.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from '@/i18n';
import { Button, IconButton } from '@/design-system';
import { CATEGORY_COLOR_PALETTE } from '@/core/constants';
import { useResponsive } from '@/shared/hooks/useResponsive';
import {
  IconFront,
  IconSide,
  IconTop,
  IconIso,
  IconReset,
  IconWireframe,
  IconXray,
  IconPerspective,
  IconOrthographic,
  IconAssembled,
  IconExploded,
} from './icons';

import type { Projection } from '@/shared/components/preview/CameraRig';

export type CameraPreset = 'front' | 'side' | 'top' | 'isometric';

/** View mode for split bin preview */
export type SplitViewMode = 'assembled' | 'exploded';

/** Split view modes for toggle iteration (extracted to avoid i18n literal lint) */
const SPLIT_VIEW_MODES: readonly SplitViewMode[] = ['assembled', 'exploded'];

interface PreviewControlsProps {
  wireframe: boolean;
  xray: boolean;
  projection: Projection;
  previewColor: string;
  activePreset: CameraPreset | null;
  onWireframeToggle: () => void;
  onXrayToggle: () => void;
  onProjectionToggle: () => void;
  onColorChange: (color: string) => void;
  onCameraPreset: (preset: CameraPreset) => void;
  onResetView: () => void;
  /** Whether the bin needs splitting (controls toggle visibility) */
  needsSplit?: boolean;
  /** Current split view mode */
  splitViewMode?: SplitViewMode;
  /** Callback when split view mode changes */
  onSplitViewModeChange?: (mode: SplitViewMode) => void;
  /** When true, hides the single-color picker (e.g. multi-color mode active) */
  hideColorPicker?: boolean;
}

const PRESETS: Array<{ key: CameraPreset; label: string; shortcut: string }> = [
  { key: 'front', label: 'Front', shortcut: '1' },
  { key: 'side', label: 'Side', shortcut: '2' },
  { key: 'top', label: 'Top', shortcut: '3' },
  { key: 'isometric', label: 'Iso', shortcut: '4' },
];

const VIEW_MODE_ICONS: Record<SplitViewMode, () => ReactNode> = {
  assembled: IconAssembled,
  exploded: IconExploded,
};

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
  const t = useTranslation();
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {CATEGORY_COLOR_PALETTE.map(({ color, nameKey }) => (
        <Button
          key={color}
          type="button"
          variant="ghost"
          onClick={() => onColorSelect(color)}
          className={`h-auto w-auto rounded-md p-0.5 transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:outline-none ${
            previewColor === color ? 'ring-2 ring-accent bg-surface-hover' : ''
          }`}
          aria-label={t('colors.colorAriaLabel', { name: t(nameKey) })}
          aria-selected={previewColor === color}
          role="option"
        >
          <span
            className={`inline-block h-6 w-6 rounded border transition-transform hover:scale-105 ${
              previewColor === color ? 'border-accent' : 'border-stroke-subtle/50'
            }`}
            style={{ backgroundColor: color }}
          />
        </Button>
      ))}
    </div>
  );
}

export function PreviewControls({
  wireframe,
  xray,
  projection,
  previewColor,
  activePreset,
  onWireframeToggle,
  onXrayToggle,
  onProjectionToggle,
  onColorChange,
  onCameraPreset,
  onResetView,
  needsSplit,
  splitViewMode,
  onSplitViewModeChange,
  hideColorPicker,
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
      <div
        className="absolute right-2 top-2 hidden md:flex items-center gap-2"
        ref={desktopPickerRef}
      >
        {/* Assembled / Exploded toggle — separate pill (only when split) */}
        {needsSplit && splitViewMode && onSplitViewModeChange && (
          <div className="flex items-center rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden">
            {SPLIT_VIEW_MODES.map((mode) => {
              const Icon = VIEW_MODE_ICONS[mode];
              const isActive = splitViewMode === mode;
              return (
                <Button
                  key={mode}
                  type="button"
                  variant="ghost"
                  size="sm"
                  touchTarget={false}
                  onClick={() => onSplitViewModeChange(mode)}
                  className={`flex items-center gap-1 rounded-none px-2.5 py-1.5 text-[11px] font-medium transition-colors min-h-[28px] touch-manipulation ${
                    isActive
                      ? 'bg-accent text-on-accent hover:bg-accent'
                      : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                  }`}
                  aria-pressed={isActive}
                >
                  <Icon />
                  <span>
                    {mode === 'assembled'
                      ? t('binDesigner.splitAssembled')
                      : t('binDesigner.splitExploded')}
                  </span>
                </Button>
              );
            })}
          </div>
        )}

        <div className="flex items-center rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden">
          {/* Camera presets group */}
          {PRESETS.map(({ key, label, shortcut }) => {
            const Icon = PRESET_ICONS[key];
            const isActive = activePreset === key;
            return (
              <Button
                key={key}
                type="button"
                variant="ghost"
                size="sm"
                touchTarget={false}
                onClick={() => onCameraPreset(key)}
                className={`flex items-center gap-1 rounded-none px-2.5 py-1.5 text-[11px] font-medium transition-colors min-h-[28px] touch-manipulation ${
                  isActive
                    ? 'bg-accent text-on-accent hover:bg-accent'
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
              </Button>
            );
          })}

          {/* Divider */}
          <div className="w-px h-5 bg-stroke-subtle/50" />

          {/* Reset button */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            touchTarget={false}
            onClick={onResetView}
            className="flex items-center gap-1 rounded-none px-2.5 py-1.5 text-[11px] font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content min-h-[28px] touch-manipulation"
            title={t('binDesigner.resetView')}
            aria-label={t('binDesigner.resetCameraViewKeyboardShortcutR')}
          >
            <IconReset />
            <span>{t('common.reset')}</span>
          </Button>

          {/* Wireframe toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            touchTarget={false}
            onClick={onWireframeToggle}
            className={`flex items-center gap-1 rounded-none px-2.5 py-1.5 text-[11px] font-medium transition-colors min-h-[28px] touch-manipulation ${
              wireframe
                ? 'bg-accent text-on-accent hover:bg-accent'
                : 'text-content-secondary hover:bg-surface-hover hover:text-content'
            }`}
            title={t('binDesigner.toggleWireframe')}
            aria-label={t('binDesigner.toggleWireframeModeKeyboardShortcut')}
            aria-pressed={wireframe}
          >
            <IconWireframe />
            <span>{t('binDesigner.wire')}</span>
          </Button>

          {/* X-ray toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            touchTarget={false}
            onClick={onXrayToggle}
            className={`flex items-center gap-1 rounded-none px-2.5 py-1.5 text-[11px] font-medium transition-colors min-h-[28px] touch-manipulation ${
              xray
                ? 'bg-accent text-on-accent hover:bg-accent'
                : 'text-content-secondary hover:bg-surface-hover hover:text-content'
            }`}
            title={t('binDesigner.toggleXray')}
            aria-label={t('binDesigner.toggleXrayKeyboardShortcut')}
            aria-pressed={xray}
          >
            <IconXray />
            <span>{t('binDesigner.xray')}</span>
          </Button>

          {/* Projection toggle (perspective ↔ orthographic) */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            touchTarget={false}
            onClick={onProjectionToggle}
            className="flex items-center gap-1 rounded-none px-2.5 py-1.5 text-[11px] font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content min-h-[28px] touch-manipulation"
            title={t('binDesigner.toggleProjection')}
            aria-label={t('binDesigner.toggleProjectionKeyboardShortcut')}
            aria-pressed={projection === 'orthographic'}
          >
            {projection === 'perspective' ? <IconPerspective /> : <IconOrthographic />}
            <span>
              {projection === 'perspective'
                ? t('binDesigner.projectionPerspective')
                : t('binDesigner.projectionOrthographic')}
            </span>
          </Button>

          {/* Color picker (hidden in multi-color mode) */}
          {!hideColorPicker && (
            <>
              {/* Divider */}
              <div className="w-px h-5 bg-stroke-subtle/50" />

              {/* Color picker button */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                touchTarget={false}
                onClick={() => setColorPickerOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-none px-2.5 py-1.5 text-[11px] font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content min-h-[28px] touch-manipulation"
                title={t('binDesigner.changePreviewColor')}
                aria-label={t('binDesigner.changePreviewColor')}
                aria-expanded={colorPickerOpen}
              >
                <span
                  className="inline-block h-4 w-4 rounded border border-stroke-subtle/50"
                  style={{ backgroundColor: previewColor }}
                />
                <span>{t('common.color')}</span>
              </Button>
            </>
          )}
        </div>

        {/* Color picker dropdown - outside overflow-hidden container */}
        {!hideColorPicker && colorPickerOpen && (
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
      <div className="absolute inset-x-2 top-2 z-30 md:hidden space-y-1.5">
        {/* Assembled / Exploded toggle (mobile, only when split) */}
        {needsSplit && splitViewMode && onSplitViewModeChange && (
          <div className="flex items-center rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden w-fit">
            {SPLIT_VIEW_MODES.map((mode) => {
              const Icon = VIEW_MODE_ICONS[mode];
              const isActive = splitViewMode === mode;
              return (
                <Button
                  key={mode}
                  type="button"
                  variant="ghost"
                  touchTarget={false}
                  onClick={() => onSplitViewModeChange(mode)}
                  className={`flex items-center justify-center gap-1 rounded-none min-w-[44px] min-h-[44px] px-3 py-2 text-[11px] font-medium transition-colors touch-manipulation ${
                    isActive
                      ? 'bg-accent text-on-accent hover:bg-accent'
                      : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                  }`}
                  aria-pressed={isActive}
                >
                  <Icon />
                  <span>
                    {mode === 'assembled'
                      ? t('binDesigner.splitAssembled')
                      : t('binDesigner.splitExploded')}
                  </span>
                </Button>
              );
            })}
          </div>
        )}
        <div className="flex items-center rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden">
          {/* Camera presets */}
          {PRESETS.map(({ key, label, shortcut }) => {
            const Icon = PRESET_ICONS[key];
            const isActive = activePreset === key;
            return (
              <IconButton
                key={key}
                type="button"
                touchTarget={false}
                pressed={isActive}
                onClick={() => onCameraPreset(key)}
                className={`flex items-center justify-center rounded-none min-w-[44px] min-h-[44px] p-2 transition-colors touch-manipulation ${
                  isActive
                    ? 'bg-accent text-on-accent hover:bg-accent'
                    : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                }`}
                title={`${label} view (${shortcut})`}
                aria-label={`${label} camera view`}
              >
                <Icon />
              </IconButton>
            );
          })}

          {/* Divider */}
          <div className="w-px h-5 bg-stroke-subtle/50" />

          {/* Reset */}
          <IconButton
            type="button"
            touchTarget={false}
            onClick={onResetView}
            className="flex items-center justify-center rounded-none min-w-[44px] min-h-[44px] p-2 text-content-secondary transition-colors hover:bg-surface-hover hover:text-content touch-manipulation"
            title={t('binDesigner.resetView')}
            aria-label={t('binDesigner.resetCameraViewKeyboardShortcutR')}
          >
            <IconReset />
          </IconButton>

          {/* Wireframe */}
          <IconButton
            type="button"
            touchTarget={false}
            pressed={wireframe}
            onClick={onWireframeToggle}
            className={`flex items-center justify-center rounded-none min-w-[44px] min-h-[44px] p-2 transition-colors touch-manipulation ${
              wireframe
                ? 'bg-accent text-on-accent hover:bg-accent'
                : 'text-content-secondary hover:bg-surface-hover hover:text-content'
            }`}
            title={t('binDesigner.toggleWireframe')}
            aria-label={t('binDesigner.toggleWireframeModeKeyboardShortcut')}
          >
            <IconWireframe />
          </IconButton>

          {/* X-ray */}
          <IconButton
            type="button"
            touchTarget={false}
            pressed={xray}
            onClick={onXrayToggle}
            className={`flex items-center justify-center rounded-none min-w-[44px] min-h-[44px] p-2 transition-colors touch-manipulation ${
              xray
                ? 'bg-accent text-on-accent hover:bg-accent'
                : 'text-content-secondary hover:bg-surface-hover hover:text-content'
            }`}
            title={t('binDesigner.toggleXray')}
            aria-label={t('binDesigner.toggleXrayKeyboardShortcut')}
          >
            <IconXray />
          </IconButton>

          {/* Projection toggle */}
          <IconButton
            type="button"
            touchTarget={false}
            pressed={projection === 'orthographic'}
            onClick={onProjectionToggle}
            className="flex items-center justify-center rounded-none min-w-[44px] min-h-[44px] p-2 text-content-secondary transition-colors hover:bg-surface-hover hover:text-content touch-manipulation"
            title={t('binDesigner.toggleProjection')}
            aria-label={t('binDesigner.toggleProjectionKeyboardShortcut')}
          >
            {projection === 'perspective' ? <IconPerspective /> : <IconOrthographic />}
          </IconButton>

          {/* Color picker (hidden in multi-color mode) */}
          {!hideColorPicker && (
            <>
              {/* Spacer to push color picker to right */}
              <div className="flex-1" />

              {/* Color picker */}
              <IconButton
                type="button"
                touchTarget={false}
                onClick={() => setColorPickerOpen((v) => !v)}
                className="flex items-center justify-center rounded-none min-w-[44px] min-h-[44px] p-2 text-content-secondary transition-colors hover:bg-surface-hover hover:text-content touch-manipulation"
                title={t('binDesigner.changePreviewColor')}
                aria-label={t('binDesigner.changePreviewColor')}
                aria-expanded={colorPickerOpen}
              >
                <span
                  className="inline-block h-4 w-4 rounded border border-stroke-subtle/50"
                  style={{ backgroundColor: previewColor }}
                />
              </IconButton>
            </>
          )}
        </div>
      </div>

      {/* Mobile color picker — bottom sheet style overlay */}
      {!hideColorPicker && colorPickerOpen && !isDesktop && (
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
