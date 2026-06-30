/**
 * Parameter panel for the slanted tool rack item kind. Edits the shared
 * envelope (footprint) and the rack structure (fins, back rail) via the
 * store's `updateEnvelope` / `updateStructure` actions.
 */
import { useShallow } from 'zustand/react/shallow';
import { Button, Stepper, Switch } from '@/design-system';
import { clamp } from '@/shared/utils/math';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { StickyGroupHeader } from '../StickyGroupHeader';
import { PanelSection } from '../PanelSection';
import { MAX_RACK_FIN_ANGLE } from '@/shared/items/toolRack/descriptor';
import { bridgeManager } from '@/shared/generation/bridge';
import { triggerDownload } from '@/shared/generation/exportUtils';
import type { GridfinityItem } from '@/shared/types/item';

type RackExportFormat = 'stl' | 'step';

interface FieldProps {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly onChange: (value: number) => void;
}

function NumberField({ label, value, min, max, step, onChange }: FieldProps) {
  return (
    <div>
      <span className="mb-1 block text-xs text-content-tertiary">{label}</span>
      <Stepper
        value={value}
        onChange={(v) => onChange(clamp(v, min, max))}
        onStep={(delta) => onChange(clamp(value + delta * step, min, max))}
        min={min}
        max={max}
        step={step}
        size="md"
        fullWidth
        aria-label={label}
      />
    </div>
  );
}

export function ToolRackParameterPanel() {
  const t = useTranslation();
  const { envelope, structure } = useDesignerStore(
    useShallow((s) => ({
      envelope: s.envelope,
      structure: s.structure,
    }))
  );
  const updateEnvelope = useDesignerStore((s) => s.updateEnvelope);
  const updateStructure = useDesignerStore((s) => s.updateStructure);
  const newDesign = useDesignerStore((s) => s.newDesign);

  if (!envelope || structure?.kind !== 'toolRack') return null;

  const exportRack = async (format: RackExportFormat): Promise<void> => {
    const item: GridfinityItem = { envelope, structure };
    const bridge = await bridgeManager.acquire();
    try {
      const result = await bridge.exportItem(item, format);
      const mime = format === 'step' ? 'application/step' : 'application/sla';
      triggerDownload(new Blob([result.data], { type: mime }), result.fileName);
    } finally {
      bridgeManager.release();
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-scroll scrollbar-thin">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stroke-subtle">
          <Button variant="ghost" onClick={() => newDesign('bin')} className="text-sm">
            {`← ${t('binDesigner.newBin')}`}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void exportRack('stl')} className="text-sm">
              {t('binDesigner.rack.exportStl')}
            </Button>
            <Button variant="ghost" onClick={() => void exportRack('step')} className="text-sm">
              {t('binDesigner.rack.exportStep')}
            </Button>
          </div>
        </div>
        <StickyGroupHeader title={t('binDesigner.rack.group')} expanded onExpandedChange={() => {}}>
          <div className="divide-y divide-stroke-subtle/50">
            <PanelSection>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label={t('binDesigner.rack.width')}
                  value={envelope.width}
                  min={1}
                  max={16}
                  step={1}
                  onChange={(width) => updateEnvelope({ width })}
                />
                <NumberField
                  label={t('binDesigner.rack.depth')}
                  value={envelope.depth}
                  min={1}
                  max={16}
                  step={1}
                  onChange={(depth) => updateEnvelope({ depth })}
                />
              </div>
            </PanelSection>
            <PanelSection>
              <div className="space-y-3">
                <NumberField
                  label={t('binDesigner.rack.finAngle')}
                  value={structure.finAngleDeg}
                  min={0}
                  max={MAX_RACK_FIN_ANGLE}
                  step={1}
                  onChange={(finAngleDeg) => updateStructure({ finAngleDeg })}
                />
                <NumberField
                  label={t('binDesigner.rack.finCount')}
                  value={structure.finCount ?? 6}
                  min={2}
                  max={64}
                  step={1}
                  onChange={(finCount) => updateStructure({ finCount })}
                />
                <NumberField
                  label={t('binDesigner.rack.finHeight')}
                  value={structure.finHeight}
                  min={4}
                  max={200}
                  step={1}
                  onChange={(finHeight) => updateStructure({ finHeight })}
                />
                <NumberField
                  label={t('binDesigner.rack.finThickness')}
                  value={structure.finThickness}
                  min={0.8}
                  max={20}
                  step={0.2}
                  onChange={(finThickness) => updateStructure({ finThickness })}
                />
                <NumberField
                  label={t('binDesigner.rack.floorThickness')}
                  value={structure.floorThickness}
                  min={0.8}
                  max={20}
                  step={0.2}
                  onChange={(floorThickness) => updateStructure({ floorThickness })}
                />
              </div>
            </PanelSection>
            <PanelSection>
              <div className="flex items-center justify-between">
                <span className="text-sm text-content">{t('binDesigner.rack.backRail')}</span>
                <Switch
                  checked={structure.backRail.enabled}
                  onChange={(enabled) =>
                    updateStructure({ backRail: { ...structure.backRail, enabled } })
                  }
                  aria-label={t('binDesigner.rack.backRail')}
                />
              </div>
              {structure.backRail.enabled && (
                <div className="mt-3">
                  <NumberField
                    label={t('binDesigner.rack.backRailHeight')}
                    value={structure.backRail.height}
                    min={2}
                    max={100}
                    step={1}
                    onChange={(height) =>
                      updateStructure({ backRail: { ...structure.backRail, height } })
                    }
                  />
                </div>
              )}
            </PanelSection>
            <PanelSection>
              <div className="flex items-center justify-between">
                <span className="text-sm text-content">{t('binDesigner.rack.magnetHoles')}</span>
                <Switch
                  checked={envelope.attachment.magnetHoles}
                  onChange={(magnetHoles) =>
                    updateEnvelope({ attachment: { ...envelope.attachment, magnetHoles } })
                  }
                  aria-label={t('binDesigner.rack.magnetHoles')}
                />
              </div>
            </PanelSection>
          </div>
        </StickyGroupHeader>
      </div>
    </div>
  );
}
