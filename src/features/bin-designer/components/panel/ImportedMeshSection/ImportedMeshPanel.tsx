/**
 * Parameter panel for the imported-mesh item kind. The mesh is immutable —
 * the panel edits only the CLAIMED grid footprint (envelope width/depth +
 * structure heightUnits, used by the layout planner) and offers STL / 3MF
 * export. No parametric sections: compartments, cutouts, patterns etc. do not
 * exist for an imported mesh, and STEP is impossible (no BREP solid).
 */
import { useShallow } from 'zustand/react/shallow';
import { getUserMessage, isOk } from '@/core/result';
import { useSettingsStore } from '@/core/store/settings';
import { useToastStore } from '@/core/store/toast';
import { Button, Stepper } from '@/design-system';
import { useTranslation } from '@/i18n';
import { bridgeManager } from '@/shared/generation/bridge';
import { export3MF } from '@/shared/generation/export';
import { triggerDownload } from '@/shared/generation/exportUtils';
import type { GridfinityItem } from '@/shared/types/item';
import { clamp } from '@/shared/utils/math';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants/gridfinity';
import { MAX_IMPORTED_MESH_HEIGHT_UNITS } from '@/shared/items/importedMesh/descriptor';
import { useDesignerStore } from '@/features/bin-designer/store';
import { parseSTLBinary } from '@/features/bin-designer/utils/stlParser';
import { PanelSection } from '../PanelSection';
import { StickyGroupHeader } from '../StickyGroupHeader';

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

export function ImportedMeshPanel() {
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
  const addToast = useToastStore((s) => s.addToast);

  if (!envelope || structure?.kind !== 'importedMesh') return null;

  const { asset } = structure;
  const dims = `${asset.sizeMm.x.toFixed(1)} × ${asset.sizeMm.y.toFixed(1)} × ${asset.sizeMm.z.toFixed(1)} mm`;

  const exportMesh = async (format: 'stl' | '3mf'): Promise<void> => {
    const item: GridfinityItem = { envelope, structure };
    const bridge = await bridgeManager.acquire();
    try {
      // The worker emits STL only for this kind; 3MF is converted here.
      const result = await bridge.exportItem(item, 'stl');
      if (format === 'stl') {
        triggerDownload(new Blob([result.data], { type: 'application/sla' }), result.fileName);
        return;
      }
      const parsed = parseSTLBinary(result.data);
      if (!isOk(parsed)) throw new Error(getUserMessage(parsed.error));
      const printSettings = useSettingsStore.getState().settings.printSettings;
      const blob = export3MF(parsed.value.vertices, parsed.value.normals, {
        name: result.fileName.replace(/\.stl$/, ''),
        printSettings: {
          layerHeight: printSettings.layerHeightMm,
          infillPercent: printSettings.infillPercent,
          material: 'PLA',
          supportRequired: false,
          estimatedMinutes: 0,
          estimatedGrams: 0,
        },
      });
      triggerDownload(blob, result.fileName.replace(/\.stl$/, '.3mf'));
    } catch {
      addToast(t('binDesigner.importedMesh.exportFailed'), 'error');
    } finally {
      bridgeManager.release();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* `relative`: see the matching note in ParameterPanel. */}
      <div className="relative flex-1 overflow-y-scroll scrollbar-thin">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stroke-subtle">
          <Button variant="ghost" onClick={() => newDesign('bin')} className="text-sm">
            {`← ${t('binDesigner.newBin')}`}
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void exportMesh('stl')} className="text-sm">
              {t('binDesigner.importedMesh.exportStl')}
            </Button>
            <Button variant="ghost" onClick={() => void exportMesh('3mf')} className="text-sm">
              {t('binDesigner.importedMesh.export3mf')}
            </Button>
          </div>
        </div>
        <StickyGroupHeader
          title={t('binDesigner.importedMesh.group')}
          expanded
          onExpandedChange={() => {}}
        >
          <div className="divide-y divide-stroke-subtle/50">
            <PanelSection>
              <div className="space-y-1 text-sm text-content-secondary">
                <div className="font-medium text-content">{asset.name}</div>
                <div>{dims}</div>
                <div>
                  {t('binDesigner.cutouts.stlImport.triangles', { count: asset.triangleCount })}
                </div>
                {structure.sourceFileName && (
                  <div className="text-xs text-content-tertiary">
                    {t('binDesigner.importedMesh.source', { file: structure.sourceFileName })}
                  </div>
                )}
              </div>
            </PanelSection>
            <PanelSection>
              <div className="grid grid-cols-2 gap-3">
                <NumberField
                  label={t('binDesigner.importBin.widthUnits')}
                  value={envelope.width}
                  min={DESIGNER_CONSTRAINTS.MIN_DIMENSION}
                  max={DESIGNER_CONSTRAINTS.MAX_DIMENSION}
                  step={DESIGNER_CONSTRAINTS.DIMENSION_STEP}
                  onChange={(width) => updateEnvelope({ width })}
                />
                <NumberField
                  label={t('binDesigner.importBin.depthUnits')}
                  value={envelope.depth}
                  min={DESIGNER_CONSTRAINTS.MIN_DIMENSION}
                  max={DESIGNER_CONSTRAINTS.MAX_DIMENSION}
                  step={DESIGNER_CONSTRAINTS.DIMENSION_STEP}
                  onChange={(depth) => updateEnvelope({ depth })}
                />
              </div>
              <div className="mt-3">
                <NumberField
                  label={t('binDesigner.importBin.heightUnits')}
                  value={structure.heightUnits}
                  min={1}
                  max={MAX_IMPORTED_MESH_HEIGHT_UNITS}
                  step={1}
                  onChange={(heightUnits) =>
                    updateStructure({ heightUnits: Math.round(heightUnits) })
                  }
                />
              </div>
              <p className="mt-2 text-xs text-content-tertiary">
                {t('binDesigner.importedMesh.footprintHelp')}
              </p>
            </PanelSection>
          </div>
        </StickyGroupHeader>
      </div>
    </div>
  );
}
