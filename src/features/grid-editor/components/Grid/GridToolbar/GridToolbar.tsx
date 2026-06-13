import { memo, useState, useEffect, useRef, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useViewStore } from '@/core/store/view';
import { useInteractionStore } from '@/core/store/interaction';
import { Checkbox } from '@/shared/components/Checkbox';
import { Button, IconButton, ChevronDownIcon, MinusIcon, PlusIcon, XIcon } from '@/design-system';
import { trackEvent } from '@/shared/analytics/posthog';
import { useTranslation } from '@/i18n';
import type { Layer } from '@/core/types';
import type { GridZoomState } from '@/features/grid-editor/hooks/useGridZoom';

/**
 * Grid Toolbar Component
 *
 * Desktop toolbar with zoom controls, layer indicator, mode indicators, and overflow menu.
 * Extracted from Grid/index.tsx as part of component decomposition.
 */

export interface GridToolbarProps {
  /** Fit to screen callback from useGridZoom */
  zoomState: GridZoomState;
  /** Reference to toolbar element for width measurement */
  toolbarRef: RefObject<HTMLDivElement | null>;
  /** All layers in the layout */
  layers: Layer[];
  /** Currently active layer */
  activeLayer: Layer | undefined;
  /** Whether toolbar is narrow (show overflow menu) */
  isNarrowToolbar: boolean;
}

export const GridToolbar = memo(function GridToolbar({
  zoomState,
  toolbarRef,
  layers,
  activeLayer,
  isNarrowToolbar,
}: GridToolbarProps) {
  const t = useTranslation();
  const { zoom, canZoomIn, canZoomOut, zoomIn, zoomOut, fitToScreen } = zoomState;

  const { showOtherLayers, toggleShowOtherLayers, leftPanelCollapsed, toggleLeftPanel } =
    useViewStore(
      useShallow((state) => ({
        showOtherLayers: state.showOtherLayers,
        toggleShowOtherLayers: state.toggleShowOtherLayers,
        leftPanelCollapsed: state.leftPanelCollapsed,
        toggleLeftPanel: state.toggleLeftPanel,
      }))
    );

  const { keyboardDragMode, keyboardResizeMode, setKeyboardDragMode, setKeyboardResizeMode } =
    useInteractionStore(
      useShallow((state) => ({
        keyboardDragMode: state.keyboardDragMode,
        keyboardResizeMode: state.keyboardResizeMode,
        setKeyboardDragMode: state.setKeyboardDragMode,
        setKeyboardResizeMode: state.setKeyboardResizeMode,
      }))
    );
  const { showIsometricPreview, toggleIsometricPreview } = useViewStore(
    useShallow((state) => ({
      showIsometricPreview: state.showIsometricPreview,
      toggleIsometricPreview: state.toggleIsometricPreview,
    }))
  );

  // Overflow menu state
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);

  // Close overflow menu when clicking outside or pressing Escape
  useEffect(() => {
    if (!overflowMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setOverflowMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOverflowMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [overflowMenuOpen]);

  return (
    <div
      data-grid-toolbar
      ref={toolbarRef}
      className="flex items-center justify-between px-4 h-[47px] bg-surface-secondary border-b border-stroke-subtle"
    >
      {/* Left: Layer indicator + Paint mode */}
      <div className="flex items-center gap-3">
        {layers.length > 1 && activeLayer && (
          <Button
            variant="secondary"
            onClick={() => leftPanelCollapsed && toggleLeftPanel()}
            className="gap-2 px-3 py-1.5"
            title={leftPanelCollapsed ? t('toolbar.showLayersPanel') : activeLayer.name}
          >
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-sm font-medium">{activeLayer.name}</span>
            <span className="text-xs text-content-tertiary">{activeLayer.height}u</span>
            {leftPanelCollapsed && <ChevronDownIcon className="w-3 h-3 text-content-tertiary" />}
          </Button>
        )}

        {/* Keyboard drag mode indicator */}
        {keyboardDragMode && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-info-muted border border-info"
            role="status"
            aria-live="polite"
          >
            <svg
              className="w-4 h-4 text-info"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
              />
            </svg>
            <span className="text-sm text-info font-medium">{t('toolbar.moveMode')}</span>
            <div className="flex items-center gap-1 ml-1">
              <span className="text-xs text-info/80">↑↓←→</span>
              <span className="text-xs text-info/60">{t('toolbar.toMove')}</span>
              <kbd className="px-1.5 py-0.5 text-xs rounded bg-info/20 border border-info/30 text-info/70 leading-none">
                Enter
              </kbd>
              <span className="text-xs text-info/60">{t('toolbar.toPlace')}</span>
              <IconButton
                size="sm"
                touchTarget={false}
                onClick={() => setKeyboardDragMode(false)}
                className="text-info hover:text-info/70 hover:bg-info/10 ml-1"
                aria-label={t('toolbar.exitMoveMode')}
                title={t('toolbar.exitMoveModeEsc')}
              >
                <XIcon className="w-4 h-4" />
              </IconButton>
            </div>
          </div>
        )}

        {/* Keyboard resize mode indicator */}
        {keyboardResizeMode && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-info-muted border border-info"
            role="status"
            aria-live="polite"
          >
            <svg
              className="w-4 h-4 text-info"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
              />
            </svg>
            <span className="text-sm text-info font-medium">{t('toolbar.resizeMode')}</span>
            <div className="flex items-center gap-1 ml-1">
              <span className="text-xs text-info/80">↑↓←→</span>
              <span className="text-xs text-info/60">{t('toolbar.toResize')}</span>
              <kbd className="px-1.5 py-0.5 text-xs rounded bg-info/20 border border-info/30 text-info/70 leading-none">
                Enter
              </kbd>
              <span className="text-xs text-info/60">{t('toolbar.toApply')}</span>
              <IconButton
                size="sm"
                touchTarget={false}
                onClick={() => setKeyboardResizeMode(false)}
                className="text-info hover:text-info/70 hover:bg-info/10 ml-1"
                aria-label={t('toolbar.exitResizeMode')}
                title={t('toolbar.exitResizeModeEsc')}
              >
                <XIcon className="w-4 h-4" />
              </IconButton>
            </div>
          </div>
        )}
      </div>

      {/* Right: View controls */}
      <div className="flex items-center gap-4">
        {/* View toggles - only show inline when not narrow */}
        {!isNarrowToolbar && layers.length > 1 && (
          <div
            className="flex items-center gap-2 cursor-pointer select-none text-sm"
            onClick={toggleShowOtherLayers}
            role="checkbox"
            aria-checked={showOtherLayers}
            aria-label={t('toolbar.showLayersBelow')}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggleShowOtherLayers();
              }
            }}
          >
            <span className={showOtherLayers ? 'text-content' : 'text-content-secondary'}>
              {t('toolbar.showLayersBelow')}
            </span>
            <Checkbox checked={showOtherLayers} variant="desktop" />
          </div>
        )}

        {/* Zoom controls */}
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t('toolbar.zoomControls')}
        >
          <IconButton
            size="sm"
            touchTarget={false}
            onClick={zoomOut}
            disabled={!canZoomOut}
            aria-label={t('toolbar.zoomOut')}
            title={t('toolbar.zoomOutKey')}
          >
            <MinusIcon className="w-4 h-4" />
          </IconButton>
          <span className="min-w-[44px] text-center text-sm text-content-secondary tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <IconButton
            size="sm"
            touchTarget={false}
            onClick={zoomIn}
            disabled={!canZoomIn}
            aria-label={t('toolbar.zoomIn')}
            title={t('toolbar.zoomInKey')}
          >
            <PlusIcon className="w-4 h-4" />
          </IconButton>
          <Button
            variant="ghost"
            onClick={fitToScreen}
            className="px-2.5 py-1.5 text-sm"
            aria-label={t('toolbar.fitGridToScreen')}
            title={t('toolbar.fitToScreen')}
          >
            {t('toolbar.fit')}
          </Button>
        </div>

        {/* 3D Preview toggle */}
        <Button
          variant={showIsometricPreview ? 'primary' : 'ghost'}
          onClick={() => {
            if (!showIsometricPreview) {
              trackEvent('ui.featureUsed', { feature: '3d_preview' });
            }
            toggleIsometricPreview();
          }}
          className="px-2.5 py-1.5 gap-1.5"
          aria-label={t(showIsometricPreview ? 'toolbar.hide3dPreview' : 'toolbar.show3dPreview')}
          title={t(showIsometricPreview ? 'toolbar.hide3dPreview' : 'toolbar.show3dPreview')}
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
            <path d="m3.3 7 8.7 5 8.7-5" />
            <path d="M12 22V12" />
          </svg>
          {!isNarrowToolbar && <span className="text-sm">{t('toolbar.3dView')}</span>}
        </Button>

        {/* Overflow menu button - only when narrow */}
        {isNarrowToolbar && layers.length > 1 && (
          <div className="relative" ref={overflowMenuRef}>
            <IconButton
              size="sm"
              touchTarget={false}
              variant={overflowMenuOpen ? 'secondary' : 'ghost'}
              onClick={() => setOverflowMenuOpen(!overflowMenuOpen)}
              aria-label={t('common.moreOptions')}
              aria-expanded={overflowMenuOpen}
              aria-haspopup="menu"
              title={t('common.moreOptions')}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </IconButton>

            {/* Overflow dropdown */}
            {overflowMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 py-2 px-1 bg-surface-elevated border border-stroke-subtle rounded-lg shadow-lg z-50 min-w-[160px]"
                role="menu"
              >
                {layers.length > 1 && (
                  <div
                    className="flex items-center justify-between px-3 py-2 cursor-pointer select-none text-sm hover:bg-surface-hover rounded-md"
                    onClick={toggleShowOtherLayers}
                    role="menuitemcheckbox"
                    aria-checked={showOtherLayers}
                    aria-label={t('toolbar.showLayersBelow')}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggleShowOtherLayers();
                      }
                    }}
                  >
                    <span className={showOtherLayers ? 'text-content' : 'text-content-secondary'}>
                      {t('toolbar.showLayersBelow')}
                    </span>
                    <Checkbox checked={showOtherLayers} variant="desktop" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
