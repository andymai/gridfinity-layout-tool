/**
 * Workspace chrome for the Bento editor: what the piece is, the grid it sits
 * on, and the way out.
 *
 * Deliberately thinner than the cutout workspace's header — a bento has no
 * shape palette, no z-order and no per-item selection, so the only global
 * controls are the grid dimensions and the wall thickness that every divider
 * shares.
 */

import { Button, Stepper } from '@/design-system';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { useTranslation } from '@/i18n';
import { BentoIcon } from '../panel/InteriorSection/icons';
import type { CompartmentGridApi } from '../CompartmentEditor/useCompartmentGrid';

export interface BentoWorkspaceHeaderProps {
  readonly grid: CompartmentGridApi;
  readonly onClose: () => void;
}

export function BentoWorkspaceHeader({ grid, onClose }: BentoWorkspaceHeaderProps) {
  const t = useTranslation();
  const { cols, rows, compartmentCount, hasMergedCompartments, applyGrid, stepGrid, handleReset } =
    grid;

  return (
    <header className="flex flex-shrink-0 items-center gap-4 border-b border-stroke-subtle bg-surface-secondary px-4 py-2">
      <div className="flex items-center gap-2">
        <BentoIcon size={18} className="text-accent" />
        <h2 className="text-sm font-semibold text-content-primary">
          {t('binDesigner.interior.bento.title')}
        </h2>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-content-tertiary">
          {t('binDesigner.columns')}
          <Stepper
            value={cols}
            onChange={(next: number) => applyGrid(next, rows)}
            onStep={(delta: number) => stepGrid('cols', delta)}
            min={DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID}
            max={DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID}
            step={1}
            size="sm"
            aria-label={t('binDesigner.columns')}
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-content-tertiary">
          {t('binDesigner.rows')}
          <Stepper
            value={rows}
            onChange={(next: number) => applyGrid(cols, next)}
            onStep={(delta: number) => stepGrid('rows', delta)}
            min={DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID}
            max={DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID}
            step={1}
            size="sm"
            aria-label={t('binDesigner.rows')}
          />
        </label>
      </div>

      <p className="text-xs tabular-nums text-content-secondary">
        {compartmentCount} {t('binDesigner.compartments')}
      </p>

      {hasMergedCompartments && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="text-[11px] font-medium text-accent hover:bg-transparent hover:text-accent/80"
          aria-label={t('binDesigner.resetCompartmentLayoutToUniformGrid')}
        >
          {t('common.reset')}
        </Button>
      )}

      <div className="ml-auto">
        <Button type="button" variant="primary" size="sm" onClick={onClose}>
          {t('common.done')}
        </Button>
      </div>
    </header>
  );
}
