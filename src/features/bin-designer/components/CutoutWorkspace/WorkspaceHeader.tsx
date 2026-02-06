/**
 * Header bar for the cutout workspace.
 *
 * Shows title, zoom controls with percentage, and Done button.
 */

import { useDesignerStore } from '@/features/bin-designer/store';
import { useTranslation } from '@/i18n';

interface WorkspaceHeaderProps {
  readonly zoomPercent: number;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
  readonly onFitToView: () => void;
}

export function WorkspaceHeader({
  zoomPercent,
  onZoomIn,
  onZoomOut,
  onFitToView,
}: WorkspaceHeaderProps) {
  const setCutoutEditorOpen = useDesignerStore((s) => s.setCutoutEditorOpen);
  const t = useTranslation();

  return (
    <div className="flex h-10 items-center justify-between border-b border-stroke-subtle px-3 bg-surface-secondary">
      <span className="text-sm font-medium text-content">
        {t('binDesigner.cutoutEditor.title')}
      </span>

      <div className="flex items-center gap-2">
        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 rounded border border-stroke-subtle bg-surface-elevated">
          <button
            type="button"
            onClick={onZoomOut}
            className="px-1.5 py-0.5 text-xs text-content-secondary hover:text-content transition-colors"
            title={t('binDesigner.cutoutEditor.zoomOut')}
            aria-label={t('binDesigner.cutoutEditor.zoomOut')}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onFitToView}
            className="min-w-[3.5rem] px-1 py-0.5 text-[11px] font-medium text-content-secondary hover:text-content tabular-nums transition-colors"
            title={t('binDesigner.cutoutEditor.fitToView')}
            aria-label={t('binDesigner.cutoutEditor.fitToView')}
          >
            {zoomPercent}%
          </button>
          <button
            type="button"
            onClick={onZoomIn}
            className="px-1.5 py-0.5 text-xs text-content-secondary hover:text-content transition-colors"
            title={t('binDesigner.cutoutEditor.zoomIn')}
            aria-label={t('binDesigner.cutoutEditor.zoomIn')}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        </div>

        {/* Done button */}
        <button
          type="button"
          onClick={() => setCutoutEditorOpen(false)}
          className="rounded-md px-4 py-1.5 text-xs font-semibold bg-accent text-white hover:bg-accent/90 shadow-sm transition-colors"
        >
          {t('binDesigner.cutoutEditor.done')}
        </button>
      </div>
    </div>
  );
}
