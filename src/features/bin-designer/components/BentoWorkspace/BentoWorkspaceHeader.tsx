/**
 * Workspace chrome for the Bento editor: identity on the left, undo/redo,
 * the grid dimensions (preserve-and-stash semantics — a dimension change
 * never destroys drawn compartments), zoom pill on the right, and the way
 * out. Composition mirrors the cutout workspace header.
 */

import { Badge, Button, IconButton, Stepper } from '@/design-system';
import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import { useTranslation } from '@/i18n';
import { BentoIcon } from '@/features/bin-designer/components/panel/InteriorSection/icons';

export interface BentoWorkspaceHeaderProps {
  readonly cols: number;
  readonly rows: number;
  /** Count of DRAWN compartments — background pockets are not compartments
   *  in this surface's vocabulary, and counting them contradicted the dock. */
  readonly drawnCount: number;
  readonly hasDrawnCompartments: boolean;
  readonly onGridChange: (cols: number, rows: number) => void;
  readonly onClearAll: () => void;
  readonly onUndo: () => void;
  readonly onRedo: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly zoomPercent: number;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onFitToView: () => void;
  readonly onClose: () => void;
}

function ArrowIcon({ direction }: { readonly direction: 'undo' | 'redo' }) {
  const d =
    direction === 'undo'
      ? 'M9 14L4 9m0 0l5-5M4 9h10a6 6 0 010 12h-3'
      : 'M15 14l5-5m0 0l-5-5m5 5H10a6 6 0 000 12h3';
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
    </svg>
  );
}

export function BentoWorkspaceHeader({
  cols,
  rows,
  drawnCount,
  hasDrawnCompartments,
  onGridChange,
  onClearAll,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onFitToView,
  onClose,
}: BentoWorkspaceHeaderProps) {
  const t = useTranslation();

  return (
    // flex-wrap, not a fixed height: at narrow pane splits the controls flow
    // onto a second row instead of pushing Done out of the pane (the audit
    // found it fully clipped at the default 50% split).
    <header className="flex min-h-10 flex-shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-stroke-subtle bg-surface-secondary px-4 py-1">
      <div className="flex items-center gap-2">
        <BentoIcon size={18} className="text-accent" />
        <h2 className="text-sm font-semibold text-content-primary">
          {t('binDesigner.interior.bento.title')}
        </h2>
        <Badge tone="info" title={t('binDesigner.bento.experimentalHint')}>
          {t('common.experimental')}
        </Badge>
      </div>

      <div className="flex items-center gap-0.5">
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          touchTarget={false}
          onClick={onUndo}
          disabled={!canUndo}
          aria-label={t('common.undo')}
          title={t('common.undo')}
        >
          <ArrowIcon direction="undo" />
        </IconButton>
        <IconButton
          type="button"
          variant="ghost"
          size="sm"
          touchTarget={false}
          onClick={onRedo}
          disabled={!canRedo}
          aria-label={t('common.redo')}
          title={t('common.redo')}
        >
          <ArrowIcon direction="redo" />
        </IconButton>
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-content-tertiary">
          {t('binDesigner.columns')}
          <Stepper
            value={cols}
            onChange={(next: number) => onGridChange(next, rows)}
            onStep={(delta: number) => onGridChange(cols + delta, rows)}
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
            onChange={(next: number) => onGridChange(cols, next)}
            onStep={(delta: number) => onGridChange(cols, rows + delta)}
            min={DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID}
            max={DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID}
            step={1}
            size="sm"
            aria-label={t('binDesigner.rows')}
          />
        </label>
      </div>

      {drawnCount > 0 && (
        <p className="text-xs tabular-nums text-content-secondary">
          {drawnCount === 1
            ? t('binDesigner.bento.countDrawn.one')
            : t('binDesigner.bento.countDrawn.other', { count: drawnCount })}
        </p>
      )}

      {hasDrawnCompartments && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearAll}
          className="text-label font-medium text-accent hover:bg-transparent hover:text-accent/80"
          aria-label={t('binDesigner.bento.clearAllLabel')}
        >
          {t('binDesigner.bento.clearAll')}
        </Button>
      )}

      <div className="ml-auto flex items-center gap-2">
        <div className="flex items-center gap-0.5 rounded border border-stroke-subtle bg-surface-elevated">
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            touchTarget={false}
            onClick={onZoomOut}
            aria-label={t('binDesigner.cutoutEditor.zoomOut')}
            title={t('binDesigner.cutoutEditor.zoomOut')}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeWidth={2} d="M5 12h14" />
            </svg>
          </IconButton>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onFitToView}
            className="min-w-[3.5rem] px-1 text-xs tabular-nums"
            title={t('binDesigner.cutoutEditor.fitToView')}
            aria-label={t('binDesigner.cutoutEditor.fitToView')}
          >
            {zoomPercent}%
          </Button>
          <IconButton
            type="button"
            variant="ghost"
            size="sm"
            touchTarget={false}
            onClick={onZoomIn}
            aria-label={t('binDesigner.cutoutEditor.zoomIn')}
            title={t('binDesigner.cutoutEditor.zoomIn')}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path strokeLinecap="round" strokeWidth={2} d="M12 5v14M5 12h14" />
            </svg>
          </IconButton>
        </div>
        <Button type="button" variant="primary" size="sm" onClick={onClose}>
          {t('common.done')}
        </Button>
      </div>
    </header>
  );
}
