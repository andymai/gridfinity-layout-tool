/**
 * Overlays for the active color tool — banner above the canvas, ESC-to-
 * exit hint, and (for eyedropper) the ColorPicker anchored at the
 * clicked 3D point. Lives outside the R3F `<Canvas>` so it can render
 * HTML and use the design-system Popover.
 *
 * The picker anchor is a 1×1 div positioned at the click's viewport
 * coords; using the Popover's flip-and-clamp logic for "anchor to point"
 * avoids reinventing placement.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Popover } from '@/design-system/Popover/Popover';
import { XIcon } from '@/design-system/Icon';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store';
import { DEFAULT_FEATURE_COLOR_CONFIG } from '@/features/bin-designer/constants/defaults';
import {
  LIP_CORNERS,
  computeActiveZones,
  getZoneColor,
  lipCornerZone,
} from '@/features/bin-designer/types/featureColors';
import type { ColorZone } from '@/features/bin-designer/types/featureColors';
import { useTranslation } from '@/i18n';
import { zoneTranslationKey, zoneColorPatch } from '@/features/bin-designer/utils/zoneLabels';
import { ColorPicker } from '@/features/bin-designer/components/panel/ColorsSection/ColorPicker';

function defaultForZone(zone: ColorZone): string {
  switch (zone) {
    case 'body':
      return DEFAULT_FEATURE_COLOR_CONFIG.body;
    case 'labelTab':
      return DEFAULT_FEATURE_COLOR_CONFIG.labelTab;
    case 'base':
      return DEFAULT_FEATURE_COLOR_CONFIG.base;
    case 'scoop':
      return DEFAULT_FEATURE_COLOR_CONFIG.scoop;
    case 'dividers':
      return DEFAULT_FEATURE_COLOR_CONFIG.dividers;
    case 'lip:frontLeft':
      return DEFAULT_FEATURE_COLOR_CONFIG.lip.frontLeft;
    case 'lip:frontRight':
      return DEFAULT_FEATURE_COLOR_CONFIG.lip.frontRight;
    case 'lip:backRight':
      return DEFAULT_FEATURE_COLOR_CONFIG.lip.backRight;
    case 'lip:backLeft':
      return DEFAULT_FEATURE_COLOR_CONFIG.lip.backLeft;
  }
}

interface ColorToolOverlayProps {
  readonly onClosePicker: () => void;
}

export function ColorToolOverlay({ onClosePicker }: ColorToolOverlayProps) {
  const t = useTranslation();
  const addToast = useToastStore((s) => s.addToast);

  const {
    colorTool,
    swapFirstZone,
    pickerOverlay,
    featureColors,
    baseStyle,
    stackingLip,
    labelEnabled,
    scoopEnabled,
    cells,
    setColorTool,
    updateFeatureColors,
    startTransaction,
    commitTransaction,
  } = useDesignerStore(
    useShallow((s) => ({
      colorTool: s.ui.colorTool,
      swapFirstZone: s.ui.swapFirstZone,
      pickerOverlay: s.ui.pickerOverlay,
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- legacy persisted configs may omit featureColors; preserve runtime fallback
      featureColors: s.params.featureColors ?? DEFAULT_FEATURE_COLOR_CONFIG,
      baseStyle: s.params.base.style,
      stackingLip: s.params.base.stackingLip,
      labelEnabled: s.params.label.enabled,
      scoopEnabled: s.params.scoop.enabled,
      cells: s.params.compartments.cells,
      setColorTool: s.setColorTool,
      updateFeatureColors: s.updateFeatureColors,
      startTransaction: s.startTransaction,
      commitTransaction: s.commitTransaction,
    }))
  );

  // ESC exits any active tool. Bound at the document level so the user
  // can exit while focus is on the 3D canvas (which doesn't accept focus).
  useEffect(() => {
    if (colorTool === null && pickerOverlay === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (pickerOverlay) {
        onClosePicker();
        return;
      }
      setColorTool(null);
      if (colorTool === 'swap-pick-first' || colorTool === 'swap-pick-second') {
        addToast({
          message: t('binDesigner.colors.swap.cancel'),
          type: 'info',
          duration: 1500,
        });
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [colorTool, pickerOverlay, onClosePicker, setColorTool, addToast, t]);

  const activeZones = useMemo(
    () =>
      computeActiveZones({
        base: { style: baseStyle, stackingLip },
        label: { enabled: labelEnabled },
        scoop: { enabled: scoopEnabled },
        compartments: { cells },
      }),
    [baseStyle, stackingLip, labelEnabled, scoopEnabled, cells]
  );

  const otherColors = useMemo(() => {
    if (!pickerOverlay) return [] as readonly string[];
    const current = getZoneColor(featureColors, pickerOverlay.zone).toLowerCase();
    const seen = new Set<string>();
    const result: string[] = [];
    const collect = (zone: ColorZone) => {
      if (!activeZones.has(zone) || zone === pickerOverlay.zone) return;
      const hex = getZoneColor(featureColors, zone);
      const key = hex.toLowerCase();
      if (key === current || seen.has(key)) return;
      seen.add(key);
      result.push(hex);
    };
    collect('body');
    for (const corner of LIP_CORNERS) collect(lipCornerZone(corner));
    collect('labelTab');
    collect('base');
    collect('scoop');
    collect('dividers');
    return result;
  }, [pickerOverlay, featureColors, activeZones]);

  const handlePickerChange = useCallback(
    (hex: string) => {
      if (!pickerOverlay) return;
      updateFeatureColors(zoneColorPatch(pickerOverlay.zone, hex));
    },
    [pickerOverlay, updateFeatureColors]
  );

  // Phantom 1×1 anchor at the click point. Mounted only while the picker
  // is open so the popover positioner clamps against viewport edges.
  const anchorRef = useRef<HTMLDivElement>(null);

  const bannerCopy = useBannerCopy(colorTool, swapFirstZone);

  return (
    <>
      {bannerCopy && (
        <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2">
          <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-accent/30 bg-surface-elevated/95 px-4 py-2 text-xs font-medium text-content shadow-lg backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden />
            <span>{bannerCopy}</span>
            <span className="hidden text-content-tertiary sm:inline">
              {t('binDesigner.colors.eyedropper.hint')}
            </span>
            <button
              type="button"
              onClick={() => {
                // Close any open picker atomically with the tool exit, otherwise
                // the picker keeps floating (and mutating colors) after the
                // banner disappears.
                onClosePicker();
                setColorTool(null);
              }}
              className="-mr-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-content-tertiary hover:bg-surface-hover hover:text-content focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={
                colorTool === 'eyedropper'
                  ? t('binDesigner.colors.eyedropper.exit')
                  : t('binDesigner.colors.swap.cancel')
              }
            >
              <XIcon size="sm" />
            </button>
          </div>
        </div>
      )}

      {pickerOverlay && (
        <>
          <div
            ref={anchorRef}
            aria-hidden
            className="pointer-events-none fixed h-px w-px"
            style={{ left: pickerOverlay.x, top: pickerOverlay.y }}
          />
          <Popover anchorRef={anchorRef} isOpen onClose={onClosePicker} placement="bottom-start">
            <ColorPicker
              zone={pickerOverlay.zone}
              zoneLabel={t(zoneTranslationKey(pickerOverlay.zone))}
              color={getZoneColor(featureColors, pickerOverlay.zone)}
              defaultColor={defaultForZone(pickerOverlay.zone)}
              otherColors={otherColors}
              bodyColor={featureColors.body}
              recentColors={[] as readonly string[]}
              onChange={handlePickerChange}
              onGestureStart={startTransaction}
              onGestureEnd={commitTransaction}
            />
          </Popover>
        </>
      )}
    </>
  );
}

/**
 * Build the banner string for the current tool state. Returned null when
 * no banner should show; centralises copy so the overlay tree stays
 * declarative.
 */
function useBannerCopy(
  colorTool: ReturnType<typeof useDesignerStore.getState>['ui']['colorTool'],
  swapFirstZone: ColorZone | null
): string | null {
  const t = useTranslation();
  if (colorTool === 'eyedropper') {
    return t('binDesigner.colors.eyedropper.banner');
  }
  if (colorTool === 'swap-pick-first') {
    return t('binDesigner.colors.swap.banner.first');
  }
  if (colorTool === 'swap-pick-second') {
    const first = swapFirstZone ? t(zoneTranslationKey(swapFirstZone)) : '';
    return t('binDesigner.colors.swap.banner.second', { first });
  }
  return null;
}
