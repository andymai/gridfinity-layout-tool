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
import { GridUnitInput } from '@/shared/components/GridUnitInput';
import { PrintBedInput } from '@/shared/components/PrintBedInput';
import { useGridUnitChange } from '@/shared/hooks';
import { GRID_PITCH_MM_MIN, GRID_PITCH_MM_MAX } from '@/shared/utils/drawerOutline';
import { SegmentedControl } from '@/design-system';
import { HelpTargetMarker } from '@/shared/help/HelpTargetMarker';
import { helpJumpEventName } from '@/shared/help/helpJumpDispatcher';
import { effectiveGridUnitMmY } from '@/core/types';

/** Print Settings header summary: "{grid}mm · {bed}mm", each half widening to
 *  "{x}×{y}mm" when that pair is asymmetric. */
function formatPrintSettingsSummary(
  gridUnitMm: number,
  gridUnitMmY: number,
  bedW: number,
  bedD: number
): string {
  const pair = (a: number, b: number): string => (a === b ? `${a}mm` : `${a}×${b}mm`);
  return `${pair(gridUnitMm, gridUnitMmY)} · ${pair(bedW, bedD)}`;
}

export function PhysicalUnitsSection() {
  const t = useTranslation();
  const { gridUnitMm, gridUnitMmY, magnetAnchor, printBedSize, printBedDepth } = useLayoutStore(
    useShallow((state) => ({
      gridUnitMm: state.layout.gridUnitMm,
      gridUnitMmY: effectiveGridUnitMmY(state.layout),
      magnetAnchor: state.layout.magnetAnchor ?? 'edge',
      printBedSize: state.layout.printBedSize,
      printBedDepth: state.layout.printBedDepth,
    }))
  );

  const handleGridUnitChange = useGridUnitChange();

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
      summary={formatPrintSettingsSummary(
        gridUnitMm,
        gridUnitMmY,
        printBedSize,
        printBedDepth ?? printBedSize
      )}
      expanded={printSettingsExpanded}
      onExpandedChange={setPrintSettingsExpanded}
    >
      <div className="space-y-3 px-4 py-3">
        <div className="text-xs text-content-secondary space-y-2">
          {/* The same linked pair the drawer sidebar and designer use, over the
              same layout pitch. A plate is only ever a reflection of that grid,
              so editing it here and there has to mean one thing. The range is
              the store's own clamp (1-200mm), wider than the sidebar's
              authoring range, because a plate is printable well outside it. */}
          <SettingsRow
            label={t('baseplate.gridUnit')}
            htmlFor="bp-gridUnit"
            unit="mm"
            tooltip={t('baseplate.gridUnitTooltip')}
          >
            <GridUnitInput
              id="bp-gridUnit"
              x={gridUnitMm}
              y={gridUnitMmY}
              onChange={handleGridUnitChange}
              variant="compact"
              min={GRID_PITCH_MM_MIN}
              max={GRID_PITCH_MM_MAX}
            />
          </SettingsRow>
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
              <p className="text-label leading-relaxed text-content-tertiary">
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
