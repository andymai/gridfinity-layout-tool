import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { useViewStore, useSelectionStore, useInteractionStore, useMobileStore } from '@/core/store';
import { CONSTRAINTS } from '@/core/constants';
import { useTranslation } from '@/i18n';

interface MobileGridToolbarProps {
  onFitToScreen: () => void;
}

/**
 * Simplified toolbar for mobile grid view.
 * Shows layer indicator, paint mode, 3D preview toggle, and basic zoom.
 */
export function MobileGridToolbar({ onFitToScreen }: MobileGridToolbarProps) {
  const t = useTranslation();
  const { zoom, zoomIn, zoomOut } = useViewStore(
    useShallow((state) => ({
      zoom: state.zoom,
      zoomIn: state.zoomIn,
      zoomOut: state.zoomOut,
    }))
  );
  const activeLayerId = useSelectionStore((state) => state.activeLayerId);
  const { paintSize, setPaintSize, showIsometricPreview, toggleIsometricPreview } =
    useInteractionStore(
      useShallow((state) => ({
        paintSize: state.paintSize,
        setPaintSize: state.setPaintSize,
        showIsometricPreview: state.showIsometricPreview,
        toggleIsometricPreview: state.toggleIsometricPreview,
      }))
    );
  const toggleMobilePanel = useMobileStore((state) => state.toggleMobilePanel);

  const layers = useLayoutStore((state) => state.layout.layers);
  const activeLayer = layers.find((l) => l.id === activeLayerId);

  const canZoomOut = zoom > CONSTRAINTS.ZOOM_MIN;
  const canZoomIn = zoom < CONSTRAINTS.ZOOM_MAX;

  return (
    <div className="flex items-center justify-between px-3 py-2 flex-shrink-0 bg-surface-secondary border-b border-stroke-subtle gap-2 overflow-x-auto">
      {/* Left: Layer indicator (tappable) */}
      <button
        onClick={() => toggleMobilePanel('layers')}
        className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors bg-surface-elevated border border-stroke-subtle"
      >
        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-accent" />
        <span className="font-medium truncate max-w-[80px] text-sm text-content">
          {activeLayer?.name || t('mobile.toolbar.defaultLayer')}
        </span>
        <svg
          className="w-3 h-3 flex-shrink-0 text-content-tertiary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Center: Paint mode indicator (if active) */}
      {paintSize && (
        <button
          onClick={() => setPaintSize(null)}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-accent text-accent text-xs font-medium"
          style={{ backgroundColor: 'var(--color-primary-muted)' }}
          aria-label={t('toolbar.exitPaintMode')}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
            />
          </svg>
          {paintSize.width}×{paintSize.depth}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      {/* Right: 3D preview + Zoom controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* 3D Preview toggle */}
        <button
          onClick={toggleIsometricPreview}
          className={`btn ${showIsometricPreview ? 'btn-primary' : 'btn-secondary'} w-10 h-10 p-0`}
          aria-label={
            showIsometricPreview ? t('toolbar.hide3dPreview') : t('toolbar.show3dPreview')
          }
          title={showIsometricPreview ? t('toolbar.hide3dPreview') : t('toolbar.show3dPreview')}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </button>
        <button
          onClick={zoomOut}
          disabled={!canZoomOut}
          className="btn btn-secondary w-10 h-10 p-0"
          aria-label={t('toolbar.zoomOut')}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        </button>
        <button
          onClick={onFitToScreen}
          className="btn btn-secondary px-3 h-10"
          aria-label={t('toolbar.fitToScreen')}
        >
          <span className="text-sm font-medium">{Math.round(zoom * 100)}%</span>
        </button>
        <button
          onClick={zoomIn}
          disabled={!canZoomIn}
          className="btn btn-secondary w-10 h-10 p-0"
          aria-label={t('toolbar.zoomIn')}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
}
