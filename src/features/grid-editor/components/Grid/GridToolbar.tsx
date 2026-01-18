import { memo, useState, useEffect, useRef, type RefObject } from 'react';
import { useShallow } from 'zustand/shallow';
import { useViewStore } from '@/core/store/view';
import { useInteractionStore } from '@/core/store/interaction';
import { Checkbox } from '@/shared/components/Checkbox';
import { track3DPreview } from '@/utils/analytics';
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
  toolbarRef: RefObject<HTMLDivElement>;
  /** All layers in the layout */
  layers: Layer[];
  /** Currently active layer */
  activeLayer: Layer | undefined;
  /** Number of placed bins (non-staging) */
  placedBinsCount: number;
  /** Whether toolbar is narrow (show overflow menu) */
  isNarrowToolbar: boolean;
  /** Whether paint hint should pulse */
  shouldPulsePaintHint: boolean;
}

export const GridToolbar = memo(function GridToolbar({
  zoomState,
  toolbarRef,
  layers,
  activeLayer,
  placedBinsCount,
  isNarrowToolbar,
  shouldPulsePaintHint,
}: GridToolbarProps) {
  const { zoom, canZoomIn, canZoomOut, zoomIn, zoomOut, fitToScreen } = zoomState;

  // View store
  const {
    showOtherLayers,
    toggleShowOtherLayers,
    showLabels,
    toggleShowLabels,
    leftPanelCollapsed,
    toggleLeftPanel,
  } = useViewStore(
    useShallow((state) => ({
      showOtherLayers: state.showOtherLayers,
      toggleShowOtherLayers: state.toggleShowOtherLayers,
      showLabels: state.showLabels,
      toggleShowLabels: state.toggleShowLabels,
      leftPanelCollapsed: state.leftPanelCollapsed,
      toggleLeftPanel: state.toggleLeftPanel,
    }))
  );

  // Interaction store
  const {
    paintSize,
    setPaintSize,
    keyboardDragMode,
    keyboardResizeMode,
    setKeyboardDragMode,
    setKeyboardResizeMode,
    showIsometricPreview,
    toggleIsometricPreview,
  } = useInteractionStore(
    useShallow((state) => ({
      paintSize: state.paintSize,
      setPaintSize: state.setPaintSize,
      keyboardDragMode: state.keyboardDragMode,
      keyboardResizeMode: state.keyboardResizeMode,
      setKeyboardDragMode: state.setKeyboardDragMode,
      setKeyboardResizeMode: state.setKeyboardResizeMode,
      showIsometricPreview: state.showIsometricPreview,
      toggleIsometricPreview: state.toggleIsometricPreview,
    }))
  );

  // Overflow menu state
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);

  // Close overflow menu when clicking outside
  useEffect(() => {
    if (!overflowMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setOverflowMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [overflowMenuOpen]);

  return (
    <div
      data-grid-toolbar
      ref={toolbarRef}
      className="flex items-center justify-between px-4 py-[7.5px] bg-surface-secondary border-b border-stroke-subtle"
    >
      {/* Left: Layer indicator + Paint mode */}
      <div className="flex items-center gap-3">
        {layers.length > 1 && activeLayer && (
          <button
            onClick={() => leftPanelCollapsed && toggleLeftPanel()}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-elevated border border-stroke-subtle transition-colors hover:bg-surface-hover"
            title={leftPanelCollapsed ? 'Show layers panel' : activeLayer.name}
          >
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-sm font-medium">{activeLayer.name}</span>
            <span className="text-xs text-content-tertiary">{activeLayer.height}u</span>
            {leftPanelCollapsed && (
              <svg
                className="w-3 h-3 text-content-tertiary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            )}
          </button>
        )}

        {/* Paint mode indicator */}
        {paintSize && (
          <button
            onClick={() => setPaintSize(null)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary-muted border border-accent hover:bg-accent/20 transition-colors cursor-pointer ${shouldPulsePaintHint ? 'animate-pulse' : ''}`}
            aria-label="Exit paint mode"
            title="Click to exit paint mode"
          >
            <svg
              className="w-4 h-4 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
              />
            </svg>
            <span className="text-sm text-accent font-medium leading-none">
              Paint {paintSize.width}×{paintSize.depth}
            </span>
            <svg
              className="w-4 h-4 text-accent/60"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Keyboard drag mode indicator */}
        {keyboardDragMode && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500"
            role="status"
            aria-live="polite"
          >
            <svg
              className="w-4 h-4 text-blue-500"
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
            <span className="text-sm text-blue-500 font-medium">Move Mode</span>
            <div className="flex items-center gap-1 ml-1">
              <span className="text-xs text-blue-500/80">↑↓←→</span>
              <span className="text-xs text-blue-500/60">to move</span>
              <kbd className="px-1.5 py-0.5 text-xs rounded bg-blue-500/20 border border-blue-500/30 text-blue-500/70 leading-none">
                Enter
              </kbd>
              <span className="text-xs text-blue-500/60">to place</span>
              <button
                onClick={() => setKeyboardDragMode(false)}
                className="text-blue-500 hover:text-blue-500/70 transition-colors p-0.5 ml-1"
                aria-label="Exit move mode"
                title="Exit move mode (Esc)"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Keyboard resize mode indicator */}
        {keyboardResizeMode && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-purple-500/10 border border-purple-500"
            role="status"
            aria-live="polite"
          >
            <svg
              className="w-4 h-4 text-purple-500"
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
            <span className="text-sm text-purple-500 font-medium">Resize Mode</span>
            <div className="flex items-center gap-1 ml-1">
              <span className="text-xs text-purple-500/80">↑↓←→</span>
              <span className="text-xs text-purple-500/60">to resize</span>
              <kbd className="px-1.5 py-0.5 text-xs rounded bg-purple-500/20 border border-purple-500/30 text-purple-500/70 leading-none">
                Enter
              </kbd>
              <span className="text-xs text-purple-500/60">to apply</span>
              <button
                onClick={() => setKeyboardResizeMode(false)}
                className="text-purple-500 hover:text-purple-500/70 transition-colors p-0.5 ml-1"
                aria-label="Exit resize mode"
                title="Exit resize mode (Esc)"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right: View controls */}
      <div className="flex items-center gap-4">
        {/* View toggles - only show inline when not narrow */}
        {!isNarrowToolbar && placedBinsCount > 0 && (
          <div
            className="flex items-center gap-2 cursor-pointer select-none text-sm"
            onClick={toggleShowLabels}
            role="checkbox"
            aria-checked={showLabels}
            aria-label="Labels"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggleShowLabels();
              }
            }}
          >
            <span className={showLabels ? 'text-content' : 'text-content-secondary'}>Labels</span>
            <Checkbox checked={showLabels} variant="desktop" />
          </div>
        )}
        {!isNarrowToolbar && layers.length > 1 && (
          <div
            className="flex items-center gap-2 cursor-pointer select-none text-sm"
            onClick={toggleShowOtherLayers}
            role="checkbox"
            aria-checked={showOtherLayers}
            aria-label="Show layers below"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                toggleShowOtherLayers();
              }
            }}
          >
            <span className={showOtherLayers ? 'text-content' : 'text-content-secondary'}>
              Show layers below
            </span>
            <Checkbox checked={showOtherLayers} variant="desktop" />
          </div>
        )}

        {/* Zoom controls */}
        <div className="flex items-center gap-1" role="group" aria-label="Zoom controls">
          <button
            onClick={zoomOut}
            disabled={!canZoomOut}
            className="btn btn-ghost p-1.5"
            aria-label="Zoom out"
            title="Zoom out (−)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="min-w-[44px] text-center text-sm text-content-secondary tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={!canZoomIn}
            className="btn btn-ghost p-1.5"
            aria-label="Zoom in"
            title="Zoom in (+)"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={fitToScreen}
            className="btn btn-ghost px-2.5 py-1.5 text-sm"
            aria-label="Fit grid to screen"
            title="Fit to screen"
          >
            Fit
          </button>
        </div>

        {/* 3D Preview toggle */}
        <button
          onClick={() => {
            if (!showIsometricPreview) {
              track3DPreview('opened');
            }
            toggleIsometricPreview();
          }}
          className={`btn ${showIsometricPreview ? 'btn-primary' : 'btn-ghost'} px-2.5 py-1.5 flex items-center gap-1.5`}
          aria-label={showIsometricPreview ? 'Hide 3D preview' : 'Show 3D preview'}
          title={showIsometricPreview ? 'Hide 3D preview' : 'Show 3D preview'}
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
          {!isNarrowToolbar && <span className="text-sm">3D View</span>}
        </button>

        {/* Overflow menu button - only when narrow */}
        {isNarrowToolbar && (placedBinsCount > 0 || layers.length > 1) && (
          <div className="relative" ref={overflowMenuRef}>
            <button
              onClick={() => setOverflowMenuOpen(!overflowMenuOpen)}
              className={`btn ${overflowMenuOpen ? 'btn-primary' : 'btn-ghost'} p-1.5`}
              aria-label="More options"
              aria-expanded={overflowMenuOpen}
              aria-haspopup="menu"
              title="More options"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>

            {/* Overflow dropdown */}
            {overflowMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 py-2 px-1 bg-surface-elevated border border-stroke-subtle rounded-lg shadow-lg z-50 min-w-[160px]"
                role="menu"
              >
                {placedBinsCount > 0 && (
                  <div
                    className="flex items-center justify-between px-3 py-2 cursor-pointer select-none text-sm hover:bg-surface-hover rounded-md"
                    onClick={toggleShowLabels}
                    role="menuitemcheckbox"
                    aria-checked={showLabels}
                    aria-label="Labels"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggleShowLabels();
                      }
                    }}
                  >
                    <span className={showLabels ? 'text-content' : 'text-content-secondary'}>
                      Labels
                    </span>
                    <Checkbox checked={showLabels} variant="desktop" />
                  </div>
                )}
                {layers.length > 1 && (
                  <div
                    className="flex items-center justify-between px-3 py-2 cursor-pointer select-none text-sm hover:bg-surface-hover rounded-md"
                    onClick={toggleShowOtherLayers}
                    role="menuitemcheckbox"
                    aria-checked={showOtherLayers}
                    aria-label="Show layers below"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        toggleShowOtherLayers();
                      }
                    }}
                  >
                    <span className={showOtherLayers ? 'text-content' : 'text-content-secondary'}>
                      Show layers below
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
