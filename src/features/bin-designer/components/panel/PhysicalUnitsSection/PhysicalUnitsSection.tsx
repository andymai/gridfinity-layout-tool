/**
 * Physical Units section: Grid unit (mm) and Height unit (mm) settings.
 *
 * These rarely change (standard Gridfinity uses 42mm grid, 7mm height unit)
 * so this section is collapsed by default, placed near the bottom of the panel.
 */

import { useEffect, useState } from 'react';
import { Collapsible } from '@/design-system';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { GridUnitInput } from '@/shared/components/GridUnitInput';
import { PrintBedInput } from '@/shared/components/PrintBedInput';
import { PRINT_SETTINGS_CONSTRAINTS } from '@/shared/printSettings';
import { helpJumpEventName } from '@/shared/help/helpJumpDispatcher';
import { CONSTRAINTS } from '@/core/constants';
import {
  DESIGNER_GRID_UNIT_MM_MIN,
  DESIGNER_GRID_UNIT_MM_MAX,
  SOCKET_HEIGHT_PRESETS,
  usePhysicalUnitsSection,
} from './usePhysicalUnitsSection';

/** Base-profile quick-select buttons (value + i18n label key). */
const SOCKET_PRESET_BUTTONS = [
  { value: SOCKET_HEIGHT_PRESETS.standard, labelKey: 'binDesigner.socketHeightStandard' },
  { value: SOCKET_HEIGHT_PRESETS.low, labelKey: 'binDesigner.socketHeightLow' },
  { value: SOCKET_HEIGHT_PRESETS.minimal, labelKey: 'binDesigner.socketHeightMinimal' },
] as const;

export function PhysicalUnitsSection() {
  const { state, handlers, meta, t } = usePhysicalUnitsSection();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const handler = () => setExpanded(true);
    const eventName = helpJumpEventName('binDesigner:base');
    window.addEventListener(eventName, handler);
    return () => window.removeEventListener(eventName, handler);
  }, []);

  return (
    <Collapsible
      title={t('common.physicalUnits')}
      expanded={expanded}
      onExpandedChange={setExpanded}
      summary={meta.summary}
    >
      <div className="space-y-2">
        <SettingsRow
          label={t('binDesigner.gridUnit')}
          tooltip={t('binDesigner.gridUnitTooltip')}
          unit="mm"
        >
          <GridUnitInput
            x={state.gridUnitMm}
            y={state.gridUnitMmY}
            onChange={handlers.handleGridUnitChange}
            variant="compact"
            min={DESIGNER_GRID_UNIT_MM_MIN}
            max={DESIGNER_GRID_UNIT_MM_MAX}
          />
        </SettingsRow>
        <SettingsRow
          label={t('binDesigner.heightUnit')}
          tooltip={t('binDesigner.heightUnitTooltip')}
          unit="mm"
        >
          <DeferredNumberInput
            value={state.heightUnitMm}
            onChange={handlers.handleHeightUnitChange}
            min={1}
            max={50}
            className="input w-14 py-0.5 px-1 text-xs text-right"
            aria-label={t('binDesigner.heightUnit')}
          />
        </SettingsRow>
        <SettingsRow
          label={t('binDesigner.socketHeight')}
          tooltip={t('binDesigner.socketHeightTooltip')}
          unit="mm"
        >
          <div className="flex items-center gap-1">
            {SOCKET_PRESET_BUTTONS.map(({ value, labelKey }) => (
              <button
                key={labelKey}
                type="button"
                onClick={() => handlers.handleSocketHeightChange(value)}
                aria-pressed={state.socketHeightMm === value}
                className={`rounded px-1.5 py-0.5 text-[11px] ${
                  state.socketHeightMm === value
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)]'
                }`}
              >
                {t(labelKey)}
              </button>
            ))}
            <DeferredNumberInput
              value={state.socketHeightMm}
              onChange={handlers.handleSocketHeightChange}
              min={CONSTRAINTS.SOCKET_HEIGHT_MM_MIN}
              max={CONSTRAINTS.SOCKET_HEIGHT_MM_MAX}
              step={0.5}
              className="input w-14 py-0.5 px-1 text-xs text-right"
              aria-label={t('binDesigner.socketHeight')}
            />
          </div>
        </SettingsRow>
        {state.magnetsDisabled && (
          <p className="px-1 text-[11px] text-[var(--color-text-muted)]">
            {t('binDesigner.socketHeightMagnetsDisabled')}
          </p>
        )}
        <SettingsRow
          label={t('settings.printBed')}
          tooltip={t('binDesigner.printBedTooltip')}
          unit="mm"
        >
          <PrintBedInput
            width={state.printBedSize}
            depth={state.printBedDepth}
            onChange={handlers.handlePrintBedChange}
            variant="compact"
          />
        </SettingsRow>
        <SettingsRow
          label={t('settings.nozzleSize')}
          tooltip={t('binDesigner.nozzleSizeTooltip')}
          unit="mm"
        >
          <DeferredNumberInput
            value={state.nozzleSizeMm}
            onChange={handlers.handleNozzleChange}
            min={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MIN}
            max={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_MAX}
            step={PRINT_SETTINGS_CONSTRAINTS.NOZZLE_SIZE_STEP}
            className="input w-14 py-0.5 px-1 text-xs text-right"
            aria-label={t('settings.nozzleSize')}
          />
        </SettingsRow>
      </div>
    </Collapsible>
  );
}
