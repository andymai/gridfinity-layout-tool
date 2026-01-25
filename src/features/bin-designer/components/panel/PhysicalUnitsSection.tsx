/**
 * Physical Units section: Grid unit (mm) and Height unit (mm) settings.
 *
 * These rarely change (standard Gridfinity uses 42mm grid, 7mm height unit)
 * so this section is collapsed by default, placed near the bottom of the panel.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { SettingsRow } from '@/shared/components/SettingsRow';
import { DeferredNumberInput } from '@/shared/components/DeferredNumberInput';
import { useTranslation } from '@/i18n';

export function PhysicalUnitsSection() {
  const { gridUnitMm, heightUnitMm, setParam } = useDesignerStore(
    useShallow((s) => ({
      gridUnitMm: s.params.gridUnitMm,
      heightUnitMm: s.params.heightUnitMm,
      setParam: s.setParam,
    }))
  );
  const t = useTranslation();

  const handleGridUnitChange = useCallback(
    (value: number) => {
      setParam('gridUnitMm', value);
    },
    [setParam]
  );

  const handleHeightUnitChange = useCallback(
    (value: number) => {
      setParam('heightUnitMm', value);
    },
    [setParam]
  );

  const summary = `${gridUnitMm}mm grid, ${heightUnitMm}mm height`;

  return (
    <CollapsibleSection
      title={t('binDesigner.physicalUnits')}
      defaultExpanded={false}
      summary={summary}
    >
      <div className="space-y-2">
        <SettingsRow label="Grid unit" tooltip="Size of one grid unit in mm (standard Gridfinity = 42mm)" unit="mm">
          <DeferredNumberInput
            value={gridUnitMm}
            onChange={handleGridUnitChange}
            min={1}
            max={200}
            className="input w-14 py-0.5 px-1 text-xs text-right"
            aria-label={t('binDesigner.gridUnit')}
          />
        </SettingsRow>
        <SettingsRow label="Height unit" tooltip="Size of one height unit in mm (standard Gridfinity = 7mm)" unit="mm">
          <DeferredNumberInput
            value={heightUnitMm}
            onChange={handleHeightUnitChange}
            min={1}
            max={50}
            className="input w-14 py-0.5 px-1 text-xs text-right"
            aria-label={t('binDesigner.heightUnit')}
          />
        </SettingsRow>
      </div>
    </CollapsibleSection>
  );
}
