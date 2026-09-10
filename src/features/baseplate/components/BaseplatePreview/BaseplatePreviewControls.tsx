import { useRef, useEffect, useState, useCallback } from 'react';
import { Button, IconButton } from '@/design-system';
import { FILAMENT_COLORS } from '@/core/constants';
import { useResponsive } from '@/shared/hooks/useResponsive';
import { useTranslation } from '@/i18n';
import type { SplitViewMode } from '../../store/baseplatePageStore';
import type { CameraPreset } from './cameraUtils';
import type { Projection } from '@/shared/components/preview/CameraRig';
import {
  IconReset,
  IconXray,
  IconPerspective,
  IconOrthographic,
} from '@/shared/components/preview/previewIcons';
import { PreviewColorPicker } from '@/shared/components/preview/PreviewColorPicker';
import { VIEW_MODE_ICONS, PRESET_ICONS, PRESETS } from './previewConstants';

/** Floating toolbar overlay for camera presets and assembled/exploded toggle. */
export function BaseplatePreviewControls({
  activePreset,
  isSplit,
  splitViewMode,
  filamentColor,
  projection,
  xray,
  onCameraPreset,
  onResetView,
  onViewModeChange,
  onColorChange,
  onToggleProjection,
  onToggleXray,
}: {
  activePreset: CameraPreset | null;
  isSplit: boolean;
  splitViewMode: SplitViewMode;
  filamentColor: string;
  projection: Projection;
  xray: boolean;
  onCameraPreset: (preset: CameraPreset) => void;
  onResetView: () => void;
  onViewModeChange: (mode: SplitViewMode) => void;
  onColorChange: (color: string) => void;
  onToggleProjection: () => void;
  onToggleXray: () => void;
}) {
  const t = useTranslation();
  const { isDesktop } = useResponsive();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const desktopPickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click (desktop only -- mobile uses backdrop)
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

  const handleColorSelect = useCallback(
    (color: string) => {
      onColorChange(color);
      setColorPickerOpen(false);
    },
    [onColorChange]
  );

  const viewModes: Array<{ value: SplitViewMode; labelKey: string }> = [
    { value: 'assembled', labelKey: 'baseplate.viewAssembled' },
    { value: 'exploded', labelKey: 'baseplate.viewExploded' },
  ];

  if (isDesktop) {
    return (
      <div
        className="absolute right-2 top-2 hidden md:flex items-center gap-2"
        ref={desktopPickerRef}
      >
        {/* Assembled / Exploded toggle -- separate pill (only when split) */}
        {isSplit && (
          <div className="flex items-center rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden">
            {viewModes.map(({ value, labelKey }) => {
              const Icon = VIEW_MODE_ICONS[value];
              const isActive = splitViewMode === value;
              return (
                <Button
                  key={value}
                  type="button"
                  variant="ghost"
                  onClick={() => onViewModeChange(value)}
                  className={`flex items-center gap-1 rounded-none px-2.5 py-1.5 text-label font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none min-h-[28px] touch-manipulation ${
                    isActive
                      ? 'bg-accent text-on-accent hover:bg-accent hover:text-on-accent'
                      : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                  }`}
                  aria-pressed={isActive}
                >
                  <Icon />
                  <span>{t(labelKey)}</span>
                </Button>
              );
            })}
          </div>
        )}

        {/* Camera presets + reset -- separate pill */}
        <div className="flex items-center rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden">
          {PRESETS.map(({ key, labelKey }) => {
            const Icon = PRESET_ICONS[key];
            const isActive = activePreset === key;
            return (
              <Button
                key={key}
                type="button"
                variant="ghost"
                onClick={() => onCameraPreset(key)}
                className={`flex items-center gap-1 rounded-none px-2.5 py-1.5 text-label font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none min-h-[28px] touch-manipulation ${
                  isActive
                    ? 'bg-accent text-on-accent hover:bg-accent hover:text-on-accent'
                    : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                }`}
                title={t(labelKey)}
                aria-label={t(labelKey)}
                aria-pressed={isActive}
              >
                <Icon />
                <span>{t(labelKey)}</span>
              </Button>
            );
          })}

          {/* Divider */}
          <div className="w-px h-5 bg-stroke-subtle/50" />

          <Button
            type="button"
            variant="ghost"
            onClick={onResetView}
            className="flex items-center gap-1 rounded-none px-2.5 py-1.5 text-label font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none min-h-[28px] touch-manipulation"
            title={t('baseplate.resetView')}
            aria-label={t('baseplate.resetView')}
          >
            <IconReset />
            <span>{t('common.reset')}</span>
          </Button>

          {/* X-ray toggle */}
          <Button
            type="button"
            variant="ghost"
            onClick={onToggleXray}
            className={`flex items-center gap-1 rounded-none px-2.5 py-1.5 text-label font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none min-h-[28px] touch-manipulation ${
              xray
                ? 'bg-accent text-on-accent hover:bg-accent hover:text-on-accent'
                : 'text-content-secondary hover:bg-surface-hover hover:text-content'
            }`}
            title={t('baseplate.toggleXray')}
            aria-label={t('baseplate.toggleXrayKeyboardShortcut')}
            aria-pressed={xray}
          >
            <IconXray />
            <span>{t('baseplate.xray')}</span>
          </Button>

          {/* Projection toggle */}
          <Button
            type="button"
            variant="ghost"
            onClick={onToggleProjection}
            className="flex items-center gap-1 rounded-none px-2.5 py-1.5 text-label font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none min-h-[28px] touch-manipulation"
            title={t('baseplate.toggleProjection')}
            aria-label={t('baseplate.toggleProjectionKeyboardShortcut')}
            aria-pressed={projection === 'orthographic'}
          >
            {projection === 'perspective' ? <IconPerspective /> : <IconOrthographic />}
            <span>
              {projection === 'perspective'
                ? t('baseplate.projectionPerspective')
                : t('baseplate.projectionOrthographic')}
            </span>
          </Button>

          {/* Divider */}
          <div className="w-px h-5 bg-stroke-subtle/50" />

          {/* Color picker button */}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setColorPickerOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-none px-2.5 py-1.5 text-label font-medium text-content-secondary transition-colors hover:bg-surface-hover hover:text-content focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none min-h-[28px] touch-manipulation"
            title={t('baseplate.filamentColor')}
            aria-label={t('baseplate.filamentColor')}
            aria-expanded={colorPickerOpen}
          >
            <span
              className="inline-block h-4 w-4 rounded border border-stroke-subtle/50"
              style={{ backgroundColor: filamentColor }}
            />
            <span>{t('common.color')}</span>
          </Button>
        </div>

        {/* Color picker dropdown -- outside overflow-hidden container */}
        {colorPickerOpen && (
          <div
            className="absolute right-0 top-full z-50 mt-2 rounded-lg border border-stroke-subtle bg-surface-elevated p-3 shadow-xl"
            role="listbox"
            aria-label={t('baseplate.filamentColor')}
          >
            <PreviewColorPicker
              colors={FILAMENT_COLORS}
              previewColor={filamentColor}
              onColorSelect={handleColorSelect}
            />
          </div>
        )}
      </div>
    );
  }

  // Mobile: two separate rows when split, single row otherwise
  return (
    <div className="absolute inset-x-2 top-2 z-30 md:hidden flex flex-wrap gap-2">
      {/* Assembled / Exploded toggle -- separate pill (only when split) */}
      {isSplit && (
        <div className="flex items-center rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden">
          {viewModes.map(({ value, labelKey }) => {
            const Icon = VIEW_MODE_ICONS[value];
            const isActive = splitViewMode === value;
            return (
              <Button
                key={value}
                type="button"
                variant="ghost"
                onClick={() => onViewModeChange(value)}
                className={`flex items-center justify-center gap-1 rounded-none px-3 min-h-[44px] text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation ${
                  isActive
                    ? 'bg-accent text-on-accent hover:bg-accent hover:text-on-accent'
                    : 'text-content-secondary hover:bg-surface-hover hover:text-content'
                }`}
                aria-pressed={isActive}
              >
                <Icon />
                <span>{t(labelKey)}</span>
              </Button>
            );
          })}
        </div>
      )}

      {/* Camera presets + reset -- separate pill */}
      <div className="flex items-center rounded-lg bg-surface-elevated/80 shadow-sm backdrop-blur overflow-hidden">
        {PRESETS.map(({ key, labelKey }) => {
          const Icon = PRESET_ICONS[key];
          const isActive = activePreset === key;
          return (
            <IconButton
              key={key}
              type="button"
              variant="ghost"
              onClick={() => onCameraPreset(key)}
              className={`flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation ${
                isActive
                  ? 'bg-accent text-on-accent hover:bg-accent hover:text-on-accent'
                  : 'text-content-secondary hover:bg-surface-hover hover:text-content'
              }`}
              title={t(labelKey)}
              aria-label={t(labelKey)}
              pressed={isActive}
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
          variant="ghost"
          onClick={onResetView}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-none text-content-secondary transition-colors hover:bg-surface-hover hover:text-content focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation"
          title={t('baseplate.resetView')}
          aria-label={t('baseplate.resetView')}
        >
          <IconReset />
        </IconButton>

        {/* X-ray */}
        <IconButton
          type="button"
          variant="ghost"
          onClick={onToggleXray}
          className={`flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation ${
            xray
              ? 'bg-accent text-on-accent hover:bg-accent hover:text-on-accent'
              : 'text-content-secondary hover:bg-surface-hover hover:text-content'
          }`}
          title={t('baseplate.toggleXray')}
          aria-label={t('baseplate.toggleXrayKeyboardShortcut')}
          pressed={xray}
        >
          <IconXray />
        </IconButton>

        {/* Projection toggle */}
        <IconButton
          type="button"
          variant="ghost"
          onClick={onToggleProjection}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-none text-content-secondary transition-colors hover:bg-surface-hover hover:text-content focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation"
          title={t('baseplate.toggleProjection')}
          aria-label={t('baseplate.toggleProjectionKeyboardShortcut')}
          pressed={projection === 'orthographic'}
        >
          {projection === 'perspective' ? <IconPerspective /> : <IconOrthographic />}
        </IconButton>

        {/* Spacer to push color picker to right */}
        <div className="flex-1" />

        {/* Color picker */}
        <IconButton
          type="button"
          variant="ghost"
          onClick={() => setColorPickerOpen((v) => !v)}
          className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-none text-content-secondary transition-colors hover:bg-surface-hover hover:text-content focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset focus-visible:outline-none touch-manipulation"
          title={t('baseplate.filamentColor')}
          aria-label={t('baseplate.filamentColor')}
          aria-expanded={colorPickerOpen}
        >
          <span
            className="inline-block h-4 w-4 rounded border border-stroke-subtle/50"
            style={{ backgroundColor: filamentColor }}
          />
        </IconButton>
      </div>

      {/* Mobile color picker -- bottom sheet style overlay */}
      {colorPickerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- decorative backdrop, keyboard users dismiss via Escape */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setColorPickerOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface-elevated p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-xl">
            <div className="mx-auto mb-3 h-1 w-8 rounded-full bg-stroke-subtle/50" />
            <p className="mb-3 text-sm font-medium text-content">{t('baseplate.filamentColor')}</p>
            <div role="listbox" aria-label={t('baseplate.filamentColor')}>
              <PreviewColorPicker
                colors={FILAMENT_COLORS}
                previewColor={filamentColor}
                onColorSelect={handleColorSelect}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
