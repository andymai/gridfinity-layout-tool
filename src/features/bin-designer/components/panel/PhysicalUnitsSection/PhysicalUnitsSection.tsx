/**
 * Physical Units section: Grid unit (mm) and Height unit (mm) settings.
 *
 * These rarely change (standard Gridfinity uses 42mm grid, 7mm height unit)
 * so this section is collapsed by default, placed near the bottom of the panel.
 */

import { useEffect, useState } from 'react';
import { Collapsible, Switch } from '@/design-system';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { PrintBedInput } from '@/shared/components/PrintBedInput';
import { PRINT_SETTINGS_CONSTRAINTS } from '@/shared/printSettings';
import { helpJumpEventName } from '@/shared/help/helpJumpDispatcher';
import { usePhysicalUnitsSection } from './usePhysicalUnitsSection';

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
        {state.nonSquare ? (
          <>
            <SettingsRow
              label={t('binDesigner.gridUnitX')}
              tooltip={t('binDesigner.gridUnitXTooltip')}
              unit="mm"
            >
              <DeferredNumberInput
                value={state.gridUnitMm}
                onChange={handlers.handleGridUnitChange}
                min={1}
                max={200}
                className="input w-14 py-0.5 px-1 text-xs text-right"
                aria-label={t('binDesigner.gridUnit')}
              />
            </SettingsRow>
            <SettingsRow
              label={t('binDesigner.gridUnitY')}
              tooltip={t('binDesigner.gridUnitYTooltip')}
              unit="mm"
            >
              <DeferredNumberInput
                value={state.gridUnitMmY}
                onChange={handlers.handleGridUnitYChange}
                min={1}
                max={200}
                className="input w-14 py-0.5 px-1 text-xs text-right"
                aria-label={t('binDesigner.gridUnitY')}
              />
            </SettingsRow>
          </>
        ) : (
          <SettingsRow
            label={t('binDesigner.gridUnit')}
            tooltip={t('binDesigner.gridUnitTooltip')}
            unit="mm"
          >
            <DeferredNumberInput
              value={state.gridUnitMm}
              onChange={handlers.handleGridUnitChange}
              min={1}
              max={200}
              className="input w-14 py-0.5 px-1 text-xs text-right"
              aria-label={t('binDesigner.gridUnit')}
            />
          </SettingsRow>
        )}
        <Switch
          label={t('binDesigner.nonSquareGrid')}
          checked={state.nonSquare}
          onChange={handlers.handleToggleNonSquare}
        />
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
    </Collapsible>
  );
}
