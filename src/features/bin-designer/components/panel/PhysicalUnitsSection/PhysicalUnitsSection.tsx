/**
 * Physical Units section: Grid unit (mm) and Height unit (mm) settings.
 *
 * These rarely change (standard Gridfinity uses 42mm grid, 7mm height unit)
 * so this section is collapsed by default, placed near the bottom of the panel.
 */

import { SettingsRow } from '@/shared/components/SettingsRow';
import { MoreDisclosure } from '@/shared/components/MoreDisclosure';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { GridUnitInput } from '@/shared/components/GridUnitInput';
import { PrintBedInput } from '@/shared/components/PrintBedInput';
import { PRINT_SETTINGS_CONSTRAINTS } from '@/shared/printSettings';
import {
  DESIGNER_GRID_UNIT_MM_MIN,
  DESIGNER_GRID_UNIT_MM_MAX,
  usePhysicalUnitsSection,
} from './usePhysicalUnitsSection';

export function PhysicalUnitsSection() {
  const { state, handlers, meta, t } = usePhysicalUnitsSection();

  return (
    <MoreDisclosure label={t('common.physicalUnits')} summary={meta.summary}>
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
    </MoreDisclosure>
  );
}
