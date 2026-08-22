/**
 * Left-pane editor for a Workshop assembly: part palette (click to arm,
 * click the canvas to place), the build tree, the selected part's inspector,
 * and the base/footprint controls.
 */
import { useShallow } from 'zustand/react/shallow';
import { Button, Stepper } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { ASSEMBLY_PART_TYPES } from '@/shared/types/assembly';
import type { AssemblyPartNode, AssemblyStructure } from '@/shared/types/assembly';
import { clamp } from '@/shared/utils/math';
import { findAssemblyPart } from '@/features/bin-designer/utils/assemblyTree';
import { StickyGroupHeader } from '../../panel/StickyGroupHeader';
import { PanelSection } from '../../panel/PanelSection';
import { PartInspector } from './PartInspector';
import { PART_LABEL_KEYS } from './partFieldConfig';

function TreeRows({
  nodes,
  depth,
  selectedId,
  onSelect,
  label,
}: {
  nodes: readonly AssemblyPartNode[];
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  label: (node: AssemblyPartNode) => string;
}) {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.id}>
          <Button
            variant={selectedId === node.id ? 'secondary' : 'ghost'}
            size="sm"
            className="w-full justify-start"
            style={{ paddingLeft: `${8 + depth * 14}px` }}
            onClick={() => onSelect(node.id)}
          >
            {label(node)}
            {node.array ? ` ×${node.array.count}` : ''}
          </Button>
          <TreeRows
            nodes={node.children}
            depth={depth + 1}
            selectedId={selectedId}
            onSelect={onSelect}
            label={label}
          />
        </div>
      ))}
    </>
  );
}

export function WorkshopPanel() {
  const t = useTranslation();
  const { structure, envelope, selectedId, pendingType } = useDesignerStore(
    useShallow((s) => ({
      structure: s.structure,
      envelope: s.envelope,
      selectedId: s.ui.selectedAssemblyPartId,
      pendingType: s.ui.workshopPendingPartType,
    }))
  );
  const newDesign = useDesignerStore((s) => s.newDesign);
  const updateEnvelope = useDesignerStore((s) => s.updateEnvelope);
  const updateAssemblyBase = useDesignerStore((s) => s.updateAssemblyBase);
  const setSelectedAssemblyPartId = useDesignerStore((s) => s.setSelectedAssemblyPartId);
  const setWorkshopPendingPartType = useDesignerStore((s) => s.setWorkshopPendingPartType);

  if (structure?.kind !== 'assembly' || !envelope) return null;
  const assembly: AssemblyStructure = structure;
  const selectedNode = selectedId === null ? null : findAssemblyPart(assembly.parts, selectedId);

  return (
    <div className="flex h-full flex-col overflow-y-auto" data-testid="workshop-panel">
      <div className="border-b border-stroke-subtle px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => newDesign('bin')}>
          {`← ${t('binDesigner.newBin')}`}
        </Button>
      </div>

      <StickyGroupHeader title={t('workshop.palette.title')} expanded onExpandedChange={() => {}}>
        <PanelSection>
          <p className="mb-2 text-xs text-content-tertiary">{t('workshop.palette.hint')}</p>
          <div className="grid grid-cols-2 gap-2">
            {ASSEMBLY_PART_TYPES.map((type) => (
              <Button
                key={type}
                variant={pendingType === type ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setWorkshopPendingPartType(pendingType === type ? null : type)}
              >
                {t(PART_LABEL_KEYS[type])}
              </Button>
            ))}
          </div>
        </PanelSection>
      </StickyGroupHeader>

      <StickyGroupHeader title={t('workshop.tree.title')} expanded onExpandedChange={() => {}}>
        <PanelSection>
          {assembly.parts.length === 0 ? (
            <p className="text-xs text-content-tertiary">{t('workshop.tree.empty')}</p>
          ) : (
            <div className="flex flex-col gap-1">
              <TreeRows
                nodes={assembly.parts}
                depth={0}
                selectedId={selectedId}
                onSelect={setSelectedAssemblyPartId}
                label={(node) => t(PART_LABEL_KEYS[node.type])}
              />
            </div>
          )}
        </PanelSection>
      </StickyGroupHeader>

      {selectedNode && (
        <StickyGroupHeader
          title={t('workshop.inspector.title')}
          expanded
          onExpandedChange={() => {}}
        >
          <PartInspector node={selectedNode} />
        </StickyGroupHeader>
      )}

      <StickyGroupHeader title={t('workshop.base.title')} expanded onExpandedChange={() => {}}>
        <PanelSection>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="mb-1 block text-xs text-content-tertiary">
                {t('workshop.envelope.width')}
              </span>
              <Stepper
                aria-label={t('workshop.envelope.width')}
                value={envelope.width}
                onChange={(v) => updateEnvelope({ width: clamp(Math.round(v), 1, 12) })}
                onStep={(delta) => updateEnvelope({ width: clamp(envelope.width + delta, 1, 12) })}
                min={1}
                max={12}
                step={1}
                size="md"
              />
            </div>
            <div>
              <span className="mb-1 block text-xs text-content-tertiary">
                {t('workshop.envelope.depth')}
              </span>
              <Stepper
                aria-label={t('workshop.envelope.depth')}
                value={envelope.depth}
                onChange={(v) => updateEnvelope({ depth: clamp(Math.round(v), 1, 12) })}
                onStep={(delta) => updateEnvelope({ depth: clamp(envelope.depth + delta, 1, 12) })}
                min={1}
                max={12}
                step={1}
                size="md"
              />
            </div>
            <div>
              <span className="mb-1 block text-xs text-content-tertiary">
                {t('workshop.base.floorThickness')}
              </span>
              <Stepper
                aria-label={t('workshop.base.floorThickness')}
                value={assembly.base.floorThickness}
                onChange={(v) => updateAssemblyBase({ floorThickness: clamp(v, 1, 10) })}
                onStep={(delta) =>
                  updateAssemblyBase({
                    floorThickness: clamp(assembly.base.floorThickness + delta * 0.5, 1, 10),
                  })
                }
                min={1}
                max={10}
                step={0.5}
                size="md"
              />
            </div>
          </div>
        </PanelSection>
      </StickyGroupHeader>
    </div>
  );
}
