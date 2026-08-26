/**
 * Left-pane editor for a Workshop assembly: part palette (click to arm,
 * click the canvas to place), the build tree, the selected part's inspector,
 * and the base/footprint controls.
 */
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangleIcon, Button, SegmentedControl, Stepper } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useToastStore } from '@/core/store/toast';
import { useSettingsStore } from '@/core/store/settings';
import { bridgeManager } from '@/shared/generation/bridge';
import { triggerDownload } from '@/shared/generation/exportUtils';
import { stlTo3MF } from '@/shared/generation/stlTo3mf';
import type { GridfinityItem } from '@/shared/types/item';
import { ASSEMBLY_PART_TYPES } from '@/shared/types/assembly';
import type { AssemblyPartNode, AssemblyStructure } from '@/shared/types/assembly';
import { clamp } from '@/shared/utils/math';
import { findAssemblyPart } from '@/features/bin-designer/utils/assemblyTree';
import {
  buildWorkshopTemplate,
  WORKSHOP_TEMPLATE_IDS,
} from '@/features/bin-designer/utils/workshopTemplates';
import { checkAssembly } from '@/features/bin-designer/utils/assemblyChecker';
import type { AssemblyWarning } from '@/features/bin-designer/utils/assemblyChecker';
import { StickyGroupHeader } from '../../panel/StickyGroupHeader';
import { PanelSection } from '../../panel/PanelSection';
import { PartInspector } from './PartInspector';
import { PART_LABEL_KEYS } from './partFieldConfig';
import { PART_ICONS } from './partIcons';
import { partSummary } from './partSummary';

function TreeRows({
  nodes,
  depth,
  selectedId,
  warned,
  onSelect,
  label,
}: {
  nodes: readonly AssemblyPartNode[];
  depth: number;
  selectedId: string | null;
  warned: ReadonlySet<string>;
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
            <span className="ml-2 text-xs text-content-tertiary">{partSummary(node)}</span>
            {warned.has(node.id) && (
              <AlertTriangleIcon size="sm" className="ml-auto text-amber-500" />
            )}
          </Button>
          <TreeRows
            nodes={node.children}
            depth={depth + 1}
            selectedId={selectedId}
            warned={warned}
            onSelect={onSelect}
            label={label}
          />
        </div>
      ))}
    </>
  );
}

interface PaletteTile {
  readonly id: string;
  readonly type: AssemblyPartNode['type'];
  readonly cutterShape?: 'circle' | 'slot';
  readonly labelKey: string;
}

const PALETTE_TILES: readonly PaletteTile[] = [
  ...ASSEMBLY_PART_TYPES.filter((type) => type !== 'cutter').map((type) => ({
    id: type,
    type,
    labelKey: PART_LABEL_KEYS[type],
  })),
  {
    id: 'hole',
    type: 'cutter' as const,
    cutterShape: 'circle' as const,
    labelKey: 'workshop.palette.hole',
  },
  {
    id: 'slot',
    type: 'cutter' as const,
    cutterShape: 'slot' as const,
    labelKey: 'workshop.palette.slot',
  },
];

export function WorkshopPanel() {
  const t = useTranslation();
  const { structure, envelope, selectedId, pendingType, pendingCutterShape } = useDesignerStore(
    useShallow((s) => ({
      structure: s.structure,
      envelope: s.envelope,
      selectedId: s.ui.selectedAssemblyPartId,
      pendingType: s.ui.workshopPendingPartType,
      pendingCutterShape: s.ui.workshopPendingCutterShape,
    }))
  );
  const newDesign = useDesignerStore((s) => s.newDesign);
  const updateEnvelope = useDesignerStore((s) => s.updateEnvelope);
  const updateAssemblyBase = useDesignerStore((s) => s.updateAssemblyBase);
  const setSelectedAssemblyPartId = useDesignerStore((s) => s.setSelectedAssemblyPartId);
  const setWorkshopPendingPartType = useDesignerStore((s) => s.setWorkshopPendingPartType);
  const addToast = useToastStore((s) => s.addToast);
  const setAssemblyMirrorAxis = useDesignerStore((s) => s.setAssemblyMirrorAxis);
  const loadAssemblyTemplate = useDesignerStore((s) => s.loadAssemblyTemplate);
  const [exporting, setExporting] = useState(false);
  const warnings = useMemo(
    () => (structure?.kind === 'assembly' && envelope ? checkAssembly(structure, envelope) : []),
    [structure, envelope]
  );
  const warningsByPart = useMemo(() => {
    const map = new Map<string, AssemblyWarning[]>();
    for (const warning of warnings) {
      const list = map.get(warning.partId) ?? [];
      list.push(warning);
      map.set(warning.partId, list);
    }
    return map;
  }, [warnings]);
  const warnedIds = useMemo(() => new Set(warnings.map((w) => w.partId)), [warnings]);

  if (structure?.kind !== 'assembly' || !envelope) return null;
  const assembly: AssemblyStructure = structure;

  const exportBuild = async (format: 'stl' | 'step' | '3mf'): Promise<void> => {
    const item: GridfinityItem = { envelope, structure: assembly };
    setExporting(true);
    let acquired = false;
    try {
      const bridge = await bridgeManager.acquire();
      acquired = true;
      // The worker exports BREP as STL or STEP; 3MF is packaged here from
      // the STL bytes, same as the imported-mesh panel.
      const workerFormat = format === 'step' ? 'step' : 'stl';
      const result = await bridge.exportItem(item, workerFormat);
      if (format === 'step') {
        triggerDownload(new Blob([result.data], { type: 'model/step' }), result.fileName);
        return;
      }
      if (format === 'stl') {
        triggerDownload(new Blob([result.data], { type: 'application/sla' }), result.fileName);
        return;
      }
      const blob = stlTo3MF(result.data, useSettingsStore.getState().settings.printSettings, {
        name: result.fileName.replace(/\.stl$/, ''),
      });
      triggerDownload(blob, result.fileName.replace(/\.stl$/, '.3mf'));
    } catch {
      addToast(t('workshop.export.failed'), 'error');
    } finally {
      if (acquired) bridgeManager.release();
      setExporting(false);
    }
  };
  const selectedNode = selectedId === null ? null : findAssemblyPart(assembly.parts, selectedId);

  return (
    <div className="flex h-full flex-col" data-testid="workshop-panel">
      <div className="flex items-center justify-between border-b border-stroke-subtle px-4 py-3">
        <Button variant="ghost" size="sm" onClick={() => newDesign('bin')}>
          {`← ${t('binDesigner.newBin')}`}
        </Button>
        <div className="flex gap-1">
          <Button
            variant="secondary"
            size="sm"
            disabled={exporting}
            onClick={() => void exportBuild('stl')}
          >
            {t('workshop.export.stl')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={exporting}
            onClick={() => void exportBuild('3mf')}
          >
            {t('workshop.export.threeMf')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={exporting}
            onClick={() => void exportBuild('step')}
          >
            {t('workshop.export.step')}
          </Button>
        </div>
      </div>

      {/* Inner scroll (the app's panel pattern): the back/export bar stays
          put while sections scroll under the translucent sticky headers. */}
      <div className="relative flex-1 overflow-y-scroll scrollbar-thin">
        <StickyGroupHeader title={t('workshop.palette.title')} expanded onExpandedChange={() => {}}>
          <PanelSection>
            <p className="mb-2 text-xs text-content-tertiary">{t('workshop.palette.hint')}</p>
            <div className="grid grid-cols-3 gap-1.5">
              {PALETTE_TILES.map((tile) => {
                const active =
                  tile.cutterShape === undefined
                    ? pendingType === tile.type
                    : pendingType === 'cutter' && pendingCutterShape === tile.cutterShape;
                return (
                  <Button
                    key={tile.id}
                    variant="ghost"
                    size="sm"
                    aria-pressed={active}
                    title={t(tile.labelKey)}
                    className={
                      'h-auto flex-col gap-1 rounded-lg px-1 py-2 text-[10px] font-medium ' +
                      (active
                        ? 'bg-accent text-on-accent shadow-sm ring-1 ring-accent/40 hover:bg-accent'
                        : 'border border-stroke-subtle bg-surface-elevated text-content-secondary hover:bg-surface-hover hover:text-content')
                    }
                    onClick={() =>
                      setWorkshopPendingPartType(active ? null : tile.type, tile.cutterShape)
                    }
                  >
                    {PART_ICONS[tile.id]}
                    <span className="truncate">{t(tile.labelKey)}</span>
                  </Button>
                );
              })}
            </div>
          </PanelSection>
        </StickyGroupHeader>

        <StickyGroupHeader title={t('workshop.tree.title')} expanded onExpandedChange={() => {}}>
          <PanelSection>
            {assembly.parts.length === 0 ? (
              <div>
                <p className="mb-2 text-xs text-content-tertiary">{t('workshop.tree.empty')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {WORKSHOP_TEMPLATE_IDS.map((templateId) => (
                    <Button
                      key={templateId}
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        loadAssemblyTemplate(buildWorkshopTemplate(templateId, envelope))
                      }
                    >
                      {t(`workshop.template.${templateId}`)}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <TreeRows
                  nodes={assembly.parts}
                  depth={0}
                  selectedId={selectedId}
                  warned={warnedIds}
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
            {(warningsByPart.get(selectedNode.id) ?? []).map((warning) => (
              <p
                key={warning.kind}
                className="flex items-center gap-2 px-4 pt-2 text-xs text-amber-500"
              >
                <AlertTriangleIcon size="sm" />
                {t(`workshop.warning.${warning.kind}`)}
              </p>
            ))}
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
                  onStep={(delta) =>
                    updateEnvelope({ width: clamp(envelope.width + delta, 1, 12) })
                  }
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
                  onStep={(delta) =>
                    updateEnvelope({ depth: clamp(envelope.depth + delta, 1, 12) })
                  }
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
              <div>
                <span className="mb-1 block text-xs text-content-tertiary">
                  {t('workshop.wedge.angle')}
                </span>
                <Stepper
                  aria-label={t('workshop.wedge.angle')}
                  value={assembly.base.wedge?.angleDeg ?? 0}
                  onChange={(v) =>
                    updateAssemblyBase({
                      wedge:
                        clamp(v, 0, 20) > 0
                          ? {
                              angleDeg: clamp(v, 0, 20),
                              lowEdge: assembly.base.wedge?.lowEdge ?? 'front',
                            }
                          : undefined,
                    })
                  }
                  onStep={(delta) => {
                    const next = clamp((assembly.base.wedge?.angleDeg ?? 0) + delta, 0, 20);
                    updateAssemblyBase({
                      wedge:
                        next > 0
                          ? { angleDeg: next, lowEdge: assembly.base.wedge?.lowEdge ?? 'front' }
                          : undefined,
                    });
                  }}
                  min={0}
                  max={20}
                  step={1}
                  size="md"
                />
              </div>
              {assembly.base.wedge !== undefined && (
                <div>
                  <span className="mb-1 block text-xs text-content-tertiary">
                    {t('workshop.wedge.lowEdge')}
                  </span>
                  <SegmentedControl
                    aria-label={t('workshop.wedge.lowEdge')}
                    value={assembly.base.wedge.lowEdge}
                    onChange={(lowEdge) =>
                      updateAssemblyBase({
                        wedge: { angleDeg: assembly.base.wedge?.angleDeg ?? 8, lowEdge },
                      })
                    }
                    options={[
                      { value: 'front', label: t('workshop.edge.front') },
                      { value: 'back', label: t('workshop.edge.back') },
                      { value: 'left', label: t('workshop.edge.left') },
                      { value: 'right', label: t('workshop.edge.right') },
                    ]}
                    size="sm"
                  />
                </div>
              )}
              <div>
                <span className="mb-1 block text-xs text-content-tertiary">
                  {t('workshop.mirror.axis')}
                </span>
                <SegmentedControl
                  aria-label={t('workshop.mirror.axis')}
                  value={assembly.mirrorAxis}
                  onChange={(axis) => setAssemblyMirrorAxis(axis)}
                  options={[
                    { value: 'x', label: t('workshop.mirror.axisX') },
                    { value: 'y', label: t('workshop.mirror.axisY') },
                  ]}
                  size="sm"
                />
              </div>
            </div>
          </PanelSection>
        </StickyGroupHeader>
      </div>
    </div>
  );
}
