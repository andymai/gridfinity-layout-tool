/**
 * Inspector content: the pinned Selection editor (when something is selected)
 * over always-present collapsible Estimates / Warnings / Export sections.
 *
 * Owns the SINGLE useExport() for the inspector and feeds its values to the
 * presentational sections, so estimates/split here can never disagree with the
 * export dialog's, and the side-effectful hook isn't instantiated per-section.
 */

import { useShallow } from 'zustand/react/shallow';
import { Collapsible } from '@/design-system/Collapsible/Collapsible';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useExport } from '@/features/bin-designer/hooks/useExport';
import { useTranslation } from '@/i18n';
import { SelectionEditor } from './SelectionEditor';
import { EstimatesSection } from './EstimatesSection';
import { WarningsSection } from './WarningsSection';
import { ExportSplitSection } from './ExportSplitSection';
import { useDesignWarnings } from './useDesignWarnings';

export function RightInspectorBody() {
  const t = useTranslation();
  const { estimates, needsSplit, splitPieceCount, canExport } = useExport();
  const { mesh, format, setExportDialogOpen } = useDesignerStore(
    useShallow((s) => ({
      mesh: s.generation.mesh,
      format: s.exportFileNameConfig.format,
      setExportDialogOpen: s.setExportDialogOpen,
    }))
  );

  const triangleCount =
    mesh?.indices && mesh.indices.length > 0 ? Math.floor(mesh.indices.length / 3) : null;
  const warnings = useDesignWarnings({
    needsSplit,
    splitPieceCount,
    meshError: mesh?.error ?? null,
  });

  return (
    <div className="flex flex-col">
      <SelectionEditor />
      <div className="divide-y divide-stroke-subtle/50">
        <div className="px-4 py-2.5">
          <Collapsible title={t('binDesigner.inspector.estimates.title')} defaultExpanded>
            <EstimatesSection estimates={estimates} triangleCount={triangleCount} />
          </Collapsible>
        </div>
        <div className="px-4 py-2.5">
          <Collapsible
            title={t('binDesigner.inspector.warnings.title')}
            defaultExpanded={warnings.length > 0}
            badge={
              warnings.length > 0 ? (
                <span className="rounded-full bg-danger/15 px-1.5 text-[10px] font-semibold text-danger">
                  {warnings.length}
                </span>
              ) : undefined
            }
          >
            <WarningsSection warnings={warnings} />
          </Collapsible>
        </div>
        <div className="px-4 py-2.5">
          <Collapsible title={t('binDesigner.inspector.export.title')}>
            <ExportSplitSection
              format={format}
              needsSplit={needsSplit}
              splitPieceCount={splitPieceCount}
              canExport={canExport}
              onExport={() => setExportDialogOpen(true)}
            />
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
