/**
 * Section 4 of the baseplate panel: grid unit, print bed, nozzle, build
 * height. Mirrors the "Physical Units" section in the bin designer and
 * layout sidebars.
 */

import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useSettingsStore } from '@/core/store/settings';
import { PRINT_SETTINGS_CONSTRAINTS } from '@/shared/printSettings';
import { useTranslation } from '@/i18n';
import { StickyGroupHeader } from '@/shared/components/StickyGroupHeader';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { PrintBedInput } from '@/shared/components/PrintBedInput';
import { SegmentedControl } from '@/design-system';
import { HelpTargetMarker } from '@/shared/help/HelpTargetMarker';
import { helpJumpEventName } from '@/shared/help/helpJumpDispatcher';
import { effectiveGridUnitMmY } from '@/core/types';
import { CONSTRAINTS } from '@/core/constants';
import { clamp } from '@/shared/utils/validation';
import {
  GRIDFINITY_SPEC,
  MAGNET_FLOOR,
  SOCKET_HEIGHT_MM_DEFAULT,
  SOCKET_HEIGHT_MM_LOW,
  SOCKET_HEIGHT_MM_MIN,
} from '@/shared/printSettings/gridfinityGeometry';

/** Print Settings header summary: "{gridUnit}mm · {bed}mm" or "{gridUnit}mm · {w}×{d}mm" for asymmetric beds. */
function formatPrintSettingsSummary(gridUnitMm: number, bedW: number, bedD: number): string {
  const bed = bedW === bedD ? `${bedW}mm` : `${bedW}×${bedD}mm`;
  return `${gridUnitMm}mm · ${bed}`;
}

/** Base-profile quick-select buttons (value + i18n label key). Layout-scoped, so
 * changing it here keeps the plate and its bins on the same profile. */
const SOCKET_PRESET_BUTTONS = [
  { value: SOCKET_HEIGHT_MM_DEFAULT, labelKey: 'binDesigner.socketHeightStandard' },
  { value: SOCKET_HEIGHT_MM_LOW, labelKey: 'binDesigner.socketHeightLow' },
  { value: SOCKET_HEIGHT_MM_MIN, labelKey: 'binDesigner.socketHeightMinimal' },
] as const;

export function PhysicalUnitsSection() {
  const t = useTranslation();
  const { gridUnitMm, gridUnitMmY, magnetAnchor, socketHeightMm, printBedSize, printBedDepth } =
    useLayoutStore(
      useShallow((state) => ({
        gridUnitMm: state.layout.gridUnitMm,
        gridUnitMmY: effectiveGridUnitMmY(state.layout),
        magnetAnchor: state.layout.magnetAnchor ?? 'edge',
        socketHeightMm: state.layout.socketHeightMm,
        printBedSize: state.layout.printBedSize,
        printBedDepth: state.layout.printBedDepth,
      }))
    );
  // A base too thin to hold a magnet (depth + retaining floor) auto-disables
  // magnet holes; surface a note so the disabled magnet toggle makes sense.
  const effectiveSocketHeightMm = socketHeightMm ?? SOCKET_HEIGHT_MM_DEFAULT;
  const magnetsDisabled = effectiveSocketHeightMm < GRIDFINITY_SPEC.MAGNET_DEPTH + MAGNET_FLOOR;
  const handleSocketHeightChange = useCallback((value: number) => {
    useLayoutStore
      .getState()
      .setSocketHeightMm(
        clamp(value, CONSTRAINTS.SOCKET_HEIGHT_MM_MIN, CONSTRAINTS.SOCKET_HEIGHT_MM_MAX)
      );
  }, []);

  const nozzleSizeMm = useSettingsStore((s) => s.settings.printSettings.nozzleSizeMm);
  const handleNozzleChange = useCallback((value: number) => {
    const current = useSettingsStore.getState().settings.printSettings;
    useSettingsStore.getState().updateSetting('printSettings', { ...current, nozzleSizeMm: value });
  }, []);
  const maxPrintHeightMm = useSettingsStore((s) => s.settings.printSettings.maxPrintHeightMm);
  const handleMaxHeightChange = useCallback((value: number) => {
    const current = useSettingsStore.getState().settings.printSettings;
    useSettingsStore
      .getState()
      .updateSetting('printSettings', { ...current, maxPrintHeightMm: value });
  }, []);

  const [printSettingsExpanded, setPrintSettingsExpanded] = useState(true);
  useEffect(() => {
    const handler = () => setPrintSettingsExpanded(true);
    const eventName = helpJumpEventName('baseplate:print-settings');
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, []);

  return (
    <StickyGroupHeader
      title={t('common.physicalUnits')}
      summary={formatPrintSettingsSummary(gridUnitMm, printBedSize, printBedDepth ?? printBedSize)}
      expanded={printSettingsExpanded}
      onExpandedChange={setPrintSettingsExpanded}
    >
      <div className="space-y-3 px-4 py-3">
        <div className="text-xs text-content-secondary space-y-2">
          <SettingsRow
            label={t('baseplate.gridUnit')}
            htmlFor="bp-gridUnit"
            unit="mm"
            tooltip={t('baseplate.gridUnitTooltip')}
          >
            <DeferredNumberInput
              id="bp-gridUnit"
              value={gridUnitMm}
              onChange={(mm) => useLayoutStore.getState().setGridUnitMm(mm)}
              min={1}
              max={200}
              className="input w-14 py-0.5 px-1 text-xs text-right"
            />
          </SettingsRow>
          <SettingsRow
            label={t('binDesigner.socketHeight')}
            unit="mm"
            tooltip={t('binDesigner.socketHeightTooltip')}
          >
            <div className="flex items-center gap-1">
              {SOCKET_PRESET_BUTTONS.map(({ value, labelKey }) => (
                <button
                  key={labelKey}
                  type="button"
                  onClick={() => handleSocketHeightChange(value)}
                  aria-pressed={effectiveSocketHeightMm === value}
                  className={`rounded px-1.5 py-0.5 text-[11px] ${
                    effectiveSocketHeightMm === value
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
              <DeferredNumberInput
                value={effectiveSocketHeightMm}
                onChange={handleSocketHeightChange}
                min={CONSTRAINTS.SOCKET_HEIGHT_MM_MIN}
                max={CONSTRAINTS.SOCKET_HEIGHT_MM_MAX}
                step={0.5}
                className="input w-14 py-0.5 px-1 text-xs text-right"
                aria-label={t('binDesigner.socketHeight')}
              />
            </div>
          </SettingsRow>
          {magnetsDisabled && (
            <p className="text-[11px] leading-relaxed text-content-tertiary">
              {t('binDesigner.socketHeightMagnetsDisabled')}
            </p>
          )}
          {/* Non-square grids get a read-only Y-pitch echo — the toggle and
              edit live in the drawer's Physical Units, so the plate stays a
              reflection of the layout grid. */}
          {gridUnitMmY !== gridUnitMm && (
            <SettingsRow
              label={t('baseplate.gridUnitY')}
              unit="mm"
              tooltip={t('baseplate.gridUnitYTooltip')}
            >
              <span className="px-1 text-xs text-content-secondary tabular-nums">
                {gridUnitMmY}
              </span>
            </SettingsRow>
          )}
          {/* Progressive disclosure: the anchor only diverges above the
              standard 42mm grid (below that 'edge' and 'center' are identical),
              so the control stays hidden until then — and its caption reveals
              the consequence of the current choice, matching the half-grid
              leftover pattern above. */}
          {gridUnitMm > 42 && (
            <div className="space-y-1">
              <SettingsRow
                label={t('baseplate.magnetAnchor')}
                tooltip={t('baseplate.magnetAnchorTooltip')}
              >
                <SegmentedControl<'edge' | 'center'>
                  aria-label={t('baseplate.magnetAnchor')}
                  size="sm"
                  options={[
                    { value: 'edge', label: t('baseplate.magnetAnchorEdge') },
                    { value: 'center', label: t('baseplate.magnetAnchorCenter') },
                  ]}
                  value={magnetAnchor}
                  onChange={(value) => useLayoutStore.getState().setMagnetAnchor(value)}
                />
              </SettingsRow>
              <p className="text-[11px] leading-relaxed text-content-tertiary">
                {t(
                  magnetAnchor === 'center'
                    ? 'baseplate.magnetAnchorHintLegacy'
                    : 'baseplate.magnetAnchorHintCorners'
                )}
              </p>
            </div>
          )}
          <HelpTargetMarker id="bp-print-bed-size">
            <SettingsRow
              label={t('baseplate.printBedSize')}
              htmlFor="bp-printBedSize"
              unit="mm"
              tooltip={t('baseplate.printBedTooltip')}
            >
              <PrintBedInput
                id="bp-printBedSize"
                width={printBedSize}
                depth={printBedDepth ?? printBedSize}
                onChange={(w, d) => useLayoutStore.getState().setPrintBedSize(w, d)}
                variant="compact"
              />
            </SettingsRow>
          </HelpTargetMarker>
          <SettingsRow
            label={t('settings.nozzleSize')}
            htmlFor="bp-nozzleSize"
            tooltip={t('baseplate.nozzleSizeTooltip')}
            unit="mm"
          >
            <DeferredNumberInput
              id="bp-nozzleSize"
              value={nozzleSizeMm}
              onChange={handleNozzleChange}
              min={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MIN}
              max={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MAX}
              step={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_STEP}
              className="input w-14 py-0.5 px-1 text-xs text-right"
              aria-label={t('settings.nozzleSize')}
            />
          </SettingsRow>
          <SettingsRow
            label={t('baseplate.maxPrintHeight')}
            htmlFor="bp-maxPrintHeight"
            unit="mm"
            tooltip={t('baseplate.maxPrintHeightTooltip')}
          >
            <DeferredNumberInput
              id="bp-maxPrintHeight"
              value={maxPrintHeightMm}
              onChange={handleMaxHeightChange}
              min={PRINT_SETTINGS_CONSTRAINTS.MAX_PRINT_HEIGHT_MIN}
              max={PRINT_SETTINGS_CONSTRAINTS.MAX_PRINT_HEIGHT_MAX}
              step={PRINT_SETTINGS_CONSTRAINTS.MAX_PRINT_HEIGHT_STEP}
              className="input w-14 py-0.5 px-1 text-xs text-right"
              aria-label={t('baseplate.maxPrintHeight')}
            />
          </SettingsRow>
        </div>
      </div>
    </StickyGroupHeader>
  );
}
