import { useRef, useState, useCallback, useEffect, Suspense, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore } from '@/core/store';
import { useViewStore } from '@/core/store/view';
import { useInteractionStore } from '@/core/store/interaction';
import { useSelectionStore } from '@/core/store/selection';
import { useHalfBinModeStore } from '@/core/store/halfBinMode';
import {
  useInteraction,
  useGridResize,
  useGridZoom,
  useGridAxisLabels,
  useGridRowColumnSelection,
  useGridFirstUseHints,
} from '@/features/grid-editor/hooks';
import { useResponsive } from '@/shared/hooks';
import { getBaseCellSize, HALF_BIN_SCALE } from '@/core/constants';
import { getLayerBins } from '@/shared/utils';
import { lazyWithRetry, namedExport } from '@/utils/lazyWithRetry';
import { GridCanvas } from './GridCanvas';
import { Overlay } from './Overlay';
import { QuickLabelPopover } from './QuickLabelPopover';
import { GridToolbar } from './GridToolbar';
import { RowLabels, ColumnLabels } from './GridAxisLabels';
import { DrawerResizeHandles } from './DrawerResizeHandles';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
import { CollabCursors, CollabGhosts, CollabSelectionRings } from '@/components/Collab';
import { useCollabMode } from '@/hooks/useCollabMode';
import { useCollabPresence } from '@/hooks/useCollabPresence';
import { useGridCoords } from '@/features/grid-editor/hooks/useGridCoords';
import { useTranslation } from '@/i18n';

// Lazy load the 3D preview component (includes three.js, ~800KB) - with retry for chunk load failures
const IsometricPreview = lazyWithRetry(() =>
  import('./IsometricPreview').then(namedExport('IsometricPreview'))
);

// Lazy load mobile toolbar (only used on mobile)
const MobileGridToolbar = lazyWithRetry(() =>
  import('@/components/Mobile').then(namedExport('MobileGridToolbar'))
);

/**
 * Main grid container with zoom controls, layer indicator, and row/column numbering.
 * Displays the drawer grid with bins, handles user interactions.
 */
interface GridProps {
  /** When true, show the animated drag-to-draw gesture on empty first-layer grids */
  shouldShowDrawTutorial?: boolean;
}

export function Grid({ shouldShowDrawTutorial = false }: GridProps) {
  const t = useTranslation();
  const { isMobile, viewportWidth } = useResponsive();
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarWidth, setToolbarWidth] = useState(0);

  // Interaction store - paint mode, 3D preview state
  const { interaction, paintSize, setPaintSize, showIsometricPreview } = useInteractionStore(
    useShallow((state) => ({
      interaction: state.interaction,
      paintSize: state.paintSize,
      setPaintSize: state.setPaintSize,
      showIsometricPreview: state.showIsometricPreview,
    }))
  );

  // Selection store - active layer, selected bins
  const { activeLayerId, setSelectedBins } = useSelectionStore(
    useShallow((state) => ({
      activeLayerId: state.activeLayerId,
      setSelectedBins: state.setSelectedBins,
    }))
  );

  // Half-bin mode - single value, no useShallow needed
  const halfBinMode = useHalfBinModeStore((state) => state.halfBinMode);

  const { drawer, layers, bins } = useLayoutStore(
    useShallow((state) => ({
      drawer: state.layout.drawer,
      layers: state.layout.layers,
      bins: state.layout.bins,
    }))
  );

  const clearSelection = useCallback(() => setSelectedBins([]), [setSelectedBins]);

  // Collaborative editing hooks
  const { isCollaborative } = useCollabMode();
  const { updateCursor, clearPresence } = useCollabPresence();
  const { getPixelCoords } = useGridCoords(gridRef);

  // Track cursor position for collaborative presence (normalized 0-1 coords for smooth movement)
  const handlePointerMoveForCollab = useCallback(
    (e: React.PointerEvent) => {
      if (!isCollaborative) return;
      const coords = getPixelCoords(e.clientX, e.clientY);
      if (coords) {
        updateCursor({ x: coords.nx, y: coords.ny });
      }
    },
    [isCollaborative, getPixelCoords, updateCursor]
  );

  const handlePointerLeaveForCollab = useCallback(() => {
    if (!isCollaborative) return;
    updateCursor(null);
  }, [isCollaborative, updateCursor]);

  // Clear presence on unmount
  useEffect(() => {
    return () => {
      if (isCollaborative) {
        clearPresence();
      }
    };
  }, [isCollaborative, clearPresence]);

  // Track if 3D preview has ever been shown (keep mounted once shown to avoid WebGL context issues)
  const [hasEverShownPreview, setHasEverShownPreview] = useState(showIsometricPreview);
  useEffect(() => {
    if (showIsometricPreview && !hasEverShownPreview) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- One-time state sync, only triggers once
      setHasEverShownPreview(true);
    }
  }, [showIsometricPreview, hasEverShownPreview]);

  // Track actual toolbar width to determine when to show overflow menu
  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      setToolbarWidth(entry.contentRect.width);
    });
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

  // Derive narrow state from actual toolbar width (threshold where content starts to clip)
  const isNarrowToolbar = !isMobile && toolbarWidth > 0 && toolbarWidth < 580;

  // Single interaction hook instance for the entire grid
  const { startDraw, startDrag, startResize } = useInteraction(gridRef);

  // Grid resize hook - handles drawer edge/corner resize logic
  // Note: We get zoom from the view store directly (instead of from useGridZoom)
  // to avoid circular dependency - useGridZoom needs isResizing from useGridResize
  const gap = 1; // 1px gap between cells
  const zoomFromStore = useViewStore((state) => state.zoom);
  const baseCellSize = getBaseCellSize(viewportWidth);
  const zoomedCellSize = Math.round(baseCellSize * zoomFromStore);

  const {
    resizeDirection,
    pendingResize,
    shouldPulseResizeHandles,
    handleResizeStart,
    confirmResize,
    cancelResize,
  } = useGridResize({ cellSize: zoomedCellSize, gap });

  // Grid zoom hook - encapsulates zoom controls
  const zoomState = useGridZoom({
    scrollContainerRef,
    drawerWidth: drawer.width,
    drawerDepth: drawer.depth,
    gap,
    isMobile,
    isResizing: !!resizeDirection,
  });

  // Listen for fit-to-screen command from command palette
  const fitToScreen = zoomState.fitToScreen;
  useEffect(() => {
    const handleFitToScreen = () => fitToScreen();
    window.addEventListener('fit-to-screen', handleFitToScreen);
    return () => window.removeEventListener('fit-to-screen', handleFitToScreen);
  }, [fitToScreen]);

  // Calculate cellSize using zoom from zoomState (may differ slightly due to fit-to-screen)
  const cellSize = Math.round(baseCellSize * zoomState.zoom);

  // In half-bin mode, visual cells are smaller to fit 2x cells in the same space
  // Formula accounts for extra gaps: (cellSize - gap) / 2 keeps total grid size constant
  const visualCellSize = halfBinMode ? (cellSize - gap) / HALF_BIN_SCALE : cellSize;
  // Scale factor for grid dimensions
  const scale = halfBinMode ? HALF_BIN_SCALE : 1;

  // Grid axis labels hook - computes label arrays and sizing
  const labelsState = useGridAxisLabels({
    drawer,
    zoom: zoomState.zoom,
    cellSize,
  });

  // Row/column selection hook - handles click selection with shift/ctrl modifiers
  const { handleRowClick, handleColumnClick } = useGridRowColumnSelection({
    bins,
    activeLayerId,
  });

  // First-use hints hook - paint mode toast and pulse
  const { shouldPulsePaintHint } = useGridFirstUseHints({
    paintSize,
  });

  // Get active layer info (memoized to prevent recalculation on every render)
  const activeLayer = useMemo(
    () => layers.find((l) => l.id === activeLayerId),
    [layers, activeLayerId]
  );
  const layerBins = useMemo(() => getLayerBins(bins, activeLayerId), [bins, activeLayerId]);
  const isEmpty = layerBins.length === 0;
  const isFirstLayer = layers.length > 0 && activeLayerId === layers[0].id;

  // Grid dimensions in pixels
  const gridWidth = drawer.width * scale * (visualCellSize + gap) + gap;
  const gridHeight = drawer.depth * scale * (visualCellSize + gap) + gap;

  // Calculate axis label sizes for row/column labels
  const fullRowSize = scale * visualCellSize + (scale - 1) * gap;
  const fractionalDepthPart = drawer.depth - labelsState.integerDepth;
  const fractionalRowSize = fractionalDepthPart * (cellSize + gap) - gap;

  const fullColSize = scale * visualCellSize + (scale - 1) * gap;
  const fractionalWidthPart = drawer.width - labelsState.integerWidth;
  const fractionalColSize = fractionalWidthPart * (cellSize + gap) - gap;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-surface relative">
      {/* Mobile toolbar - always at very top */}
      {isMobile && (
        <Suspense fallback={<div className="h-12 bg-surface-secondary" />}>
          <MobileGridToolbar onFitToScreen={zoomState.fitToScreen} />
        </Suspense>
      )}

      {/* Main content area: horizontal split on desktop, vertical on mobile */}
      <div
        className={`flex flex-1 min-h-0 ${!isMobile && showIsometricPreview ? 'flex-row overflow-hidden' : 'flex-col'}`}
      >
        {/* Mobile: 3D preview as top portion */}
        {/* Keep mounted once shown to avoid WebGL context issues with StrictMode */}
        {isMobile && hasEverShownPreview && (
          <div
            data-3d-preview
            className={`w-full flex-1 min-h-0 bg-surface-secondary border-b border-stroke-subtle overflow-hidden ${!showIsometricPreview ? 'hidden' : ''}`}
          >
            <PanelErrorBoundary panelName="3D Preview">
              <Suspense
                fallback={
                  // Reserve minimum height to prevent CLS while loading
                  <div className="w-full h-full min-h-[200px] flex items-center justify-center bg-surface-secondary">
                    <div className="animate-pulse motion-reduce:animate-none text-content-tertiary text-sm">
                      Loading 3D preview...
                    </div>
                  </div>
                }
              >
                <IsometricPreview inline />
              </Suspense>
            </PanelErrorBoundary>
          </div>
        )}

        {/* Grid area */}
        <div
          className={`flex flex-col ${isMobile && showIsometricPreview ? 'flex-1 min-h-0' : 'h-full'} ${!isMobile && showIsometricPreview ? 'w-1/2 min-w-0 border-r border-stroke-subtle' : 'w-full'}`}
        >
          {/* Desktop toolbar */}
          {!isMobile && (
            <GridToolbar
              zoomState={zoomState}
              toolbarRef={toolbarRef}
              layers={layers}
              activeLayer={activeLayer}
              isNarrowToolbar={isNarrowToolbar}
              shouldPulsePaintHint={shouldPulsePaintHint}
            />
          )}

          {/* Grid container with scroll - click background to deselect */}
          <div
            ref={scrollContainerRef}
            className={`flex-1 overflow-auto bg-surface relative ${isMobile ? 'py-3 pr-3' : 'p-6 pr-8'}`}
            onPointerDown={(e) => {
              // Deselect if clicking on container or wrapper areas (not interactive elements)
              // Bins call stopPropagation on pointerdown, so this only fires for empty space
              const target = e.target as HTMLElement;
              // Don't deselect if clicking on buttons, inputs, or bin elements
              if (
                !target.closest('button') &&
                !target.closest('input') &&
                !target.closest('[data-bin-id]')
              ) {
                clearSelection();
                // Exit paint mode when clicking off the grid
                if (paintSize) {
                  setPaintSize(null);
                }
              }
            }}
          >
            {/* Grid with row/column labels wrapper - uses CSS Grid for sticky row labels */}
            <div
              className={`inline-grid ${isMobile ? 'pb-6' : 'pr-6 pb-6'}`}
              style={{
                gridTemplateColumns: labelsState.axisLabelsVisible ? `auto 1fr` : '1fr',
                gridTemplateRows: '1fr',
                columnGap: labelsState.axisLabelsVisible ? 4 : 0,
              }}
            >
              {/* Row labels column - sticky to left edge */}
              {labelsState.axisLabelsVisible && (
                <RowLabels
                  labels={labelsState}
                  fullRowSize={fullRowSize}
                  fractionalRowSize={fractionalRowSize}
                  gap={gap}
                  onRowClick={handleRowClick}
                />
              )}

              {/* Grid with resize handles */}
              <div className="relative">
                {/* Grid itself */}
                <div
                  ref={gridRef}
                  className={`relative ${labelsState.axisLabelsVisible ? '' : 'rounded-lg'}`}
                  style={{
                    // In half-bin mode, grid has 2x cells at half the size
                    width: gridWidth,
                    height: gridHeight,
                    backgroundColor: 'var(--grid-bg)',
                    boxShadow: 'var(--shadow-lg)',
                  }}
                  role="application"
                  aria-label={`Gridfinity drawer grid, ${drawer.width} columns by ${drawer.depth} rows`}
                  onPointerMove={handlePointerMoveForCollab}
                  onPointerLeave={handlePointerLeaveForCollab}
                >
                  <GridCanvas
                    gridRef={gridRef}
                    cellSize={cellSize}
                    gap={gap}
                    onStartDraw={startDraw}
                    onStartDrag={startDrag}
                    onStartResize={startResize}
                  />
                  <Overlay cellSize={cellSize} gap={gap} />
                  {/* Collaborative selection rings - shows bins selected by other users */}
                  {isCollaborative && <CollabSelectionRings />}
                  {/* Collaborative ghosts overlay - shows other users' operations */}
                  {isCollaborative && <CollabGhosts />}
                  {/* Collaborative cursors overlay - shows other users' cursors */}
                  {isCollaborative && <CollabCursors />}

                  {/* Empty state overlay */}
                  {isEmpty &&
                    !interaction &&
                    drawer.width * cellSize > 200 &&
                    drawer.depth * cellSize > 150 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-[5]">
                        <div
                          className="flex flex-col items-center p-6 rounded-xl max-w-xs text-center bg-surface"
                          style={{ opacity: 0.95, backdropFilter: 'blur(4px)' }}
                        >
                          {isFirstLayer && shouldShowDrawTutorial ? (
                            <>
                              {/* Animated draw gesture */}
                              <div
                                className="mb-3 relative"
                                style={{ width: 104, height: 80 }}
                                aria-hidden="true"
                              >
                                <div
                                  className="absolute rounded-full border-2 border-accent animate-draw-hint-click"
                                  style={{ width: 36, height: 36, top: -14, left: -14 }}
                                />
                                <div className="absolute top-0 left-0 border-2 border-dashed border-accent/60 bg-accent/10 rounded-sm animate-draw-hint-rect" />
                                <div
                                  className="absolute top-0 left-0 animate-draw-hint-cursor"
                                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.25))' }}
                                >
                                  {isMobile ? (
                                    /* Touch circle for mobile */
                                    <div className="w-6 h-6 rounded-full bg-white/90 border-2 border-gray-700" />
                                  ) : (
                                    /* Mouse cursor for desktop */
                                    <svg width="20" height="24" viewBox="0 0 18 22" fill="none">
                                      <path
                                        d="M2 1 L2 17 L6.2 13 L9.5 20 L12.2 18.8 L9 12.5 L14 12.5 Z"
                                        fill="white"
                                        stroke="#222"
                                        strokeWidth="1.5"
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  )}
                                </div>
                              </div>
                              <p className="font-medium mb-1 text-sm text-content-secondary">
                                {t('onboarding.drawTutorial.hint')}
                              </p>
                            </>
                          ) : (
                            <>
                              {/* Static icon for empty layers */}
                              <div className="w-12 h-12 mb-4 flex items-center justify-center rounded-lg bg-surface-hover">
                                <svg
                                  className="w-6 h-6 text-content-tertiary"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  aria-hidden="true"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={1.5}
                                    d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
                                  />
                                </svg>
                              </div>
                              <p className="font-medium mb-1 text-sm text-content-secondary">
                                {isMobile
                                  ? t('grid.emptyHint.tapToDraw')
                                  : t('grid.emptyHint.clickToDraw')}
                              </p>
                              {!isFirstLayer && (
                                <p className="text-xs text-content-disabled">
                                  {t('grid.emptyHint.stripedBlocked')}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                </div>

                {/* Grid resize handles - hidden on mobile (use Settings to change dimensions) */}
                {!isMobile && (
                  <DrawerResizeHandles
                    gridWidth={gridWidth}
                    gridHeight={gridHeight}
                    columnLabelHeight={labelsState.columnLabelHeight}
                    axisLabelsVisible={labelsState.axisLabelsVisible}
                    resizeDirection={resizeDirection}
                    shouldPulse={shouldPulseResizeHandles}
                    onResizeStart={handleResizeStart}
                  />
                )}

                {/* Column labels row (at bottom, 1-indexed from left) */}
                {labelsState.axisLabelsVisible && (
                  <ColumnLabels
                    labels={labelsState}
                    fullColSize={fullColSize}
                    fractionalColSize={fractionalColSize}
                    gap={gap}
                    gridTop={gridHeight}
                    onColumnClick={handleColumnClick}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Resize confirmation dialog */}
          <ConfirmDialog
            isOpen={pendingResize !== null}
            title={t('grid.resizeGrid')}
            message={
              pendingResize
                ? `${pendingResize.clippedBinIds.length} bin${pendingResize.clippedBinIds.length > 1 ? 's' : ''} will be moved to stash. Continue?`
                : ''
            }
            confirmText="Move to Stash"
            onConfirm={confirmResize}
            onCancel={cancelResize}
          />
        </div>
        {/* End of grid area wrapper */}

        {/* Right side: 3D Preview (50% when shown on desktop) */}
        {/* Keep mounted once shown to avoid WebGL context issues with StrictMode */}
        {!isMobile && hasEverShownPreview && (
          <div
            data-3d-preview
            className={`w-1/2 h-full bg-surface-secondary overflow-hidden ${!showIsometricPreview ? 'hidden' : ''}`}
          >
            <PanelErrorBoundary panelName="3D Preview">
              <Suspense
                fallback={
                  // Reserve full space to prevent CLS while loading
                  <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-surface-secondary">
                    <div className="animate-pulse motion-reduce:animate-none text-content-tertiary text-sm">
                      Loading 3D preview...
                    </div>
                  </div>
                }
              >
                <IsometricPreview inline />
              </Suspense>
            </PanelErrorBoundary>
          </div>
        )}
      </div>

      {/* Quick label popover for desktop double-click / L shortcut */}
      <QuickLabelPopover />
    </div>
  );
}
