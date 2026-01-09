import { useRef, useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore, useLayoutStore, useUndoableAction } from '../../store';
import { useToastStore } from '../../store/toast';
import { useInteraction, useResponsive } from '../../hooks';
import { BASE_CELL_SIZE, STAGING_ID, CONSTRAINTS, getBaseCellSize } from '../../constants';
import { clamp } from '../../utils/validation';
import { GridCanvas } from './GridCanvas';
import { Overlay } from './Overlay';
import { ConfirmDialog } from '../modals/ConfirmDialog';
import { MobileGridToolbar } from '../mobile';
import { PanelErrorBoundary } from '../PanelErrorBoundary';
// Lazy load the 3D preview component (includes three.js, ~800KB)
const IsometricPreview = lazy(() => import('./IsometricPreview').then(m => ({ default: m.IsometricPreview })));

type ResizeDirection = 'width' | 'depth' | 'both' | null;

/**
 * Main grid container with zoom controls, layer indicator, and row/column numbering.
 * Displays the drawer grid with bins, handles user interactions.
 */
export function Grid() {
  const { isMobile, viewportWidth } = useResponsive();
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    showOtherLayers,
    toggleShowOtherLayers,
    showLabels,
    toggleShowLabels,
    activeLayerId,
    paintSize,
    setPaintSize,
    setSelectedBins,
    leftPanelCollapsed,
    toggleLeftPanel,
    interaction,
    showIsometricPreview,
    toggleIsometricPreview,
    keyboardDragMode,
    keyboardResizeMode,
    setKeyboardDragMode,
    setKeyboardResizeMode,
  } = useUIStore(
    useShallow((state) => ({
      zoom: state.zoom,
      setZoom: state.setZoom,
      zoomIn: state.zoomIn,
      zoomOut: state.zoomOut,
      showOtherLayers: state.showOtherLayers,
      toggleShowOtherLayers: state.toggleShowOtherLayers,
      showLabels: state.showLabels,
      toggleShowLabels: state.toggleShowLabels,
      activeLayerId: state.activeLayerId,
      paintSize: state.paintSize,
      setPaintSize: state.setPaintSize,
      setSelectedBins: state.setSelectedBins,
      leftPanelCollapsed: state.leftPanelCollapsed,
      toggleLeftPanel: state.toggleLeftPanel,
      interaction: state.interaction,
      showIsometricPreview: state.showIsometricPreview,
      toggleIsometricPreview: state.toggleIsometricPreview,
      keyboardDragMode: state.keyboardDragMode,
      keyboardResizeMode: state.keyboardResizeMode,
      setKeyboardDragMode: state.setKeyboardDragMode,
      setKeyboardResizeMode: state.setKeyboardResizeMode,
    }))
  );

  const { drawer, layers, bins, updateDrawer, updateBin } = useLayoutStore(
    useShallow((state) => ({
      drawer: state.layout.drawer,
      layers: state.layout.layers,
      bins: state.layout.bins,
      updateDrawer: state.updateDrawer,
      updateBin: state.updateBin,
    }))
  );

  const clearSelection = useCallback(() => setSelectedBins([]), [setSelectedBins]);
  const { execute } = useUndoableAction();
  const addToast = useToastStore(state => state.addToast);

  // Track if paint mode hint should pulse (first use)
  const [shouldPulsePaintHint, setShouldPulsePaintHint] = useState(false);

  // Track if grid resize handles should pulse (first load)
  const [shouldPulseResizeHandles, setShouldPulseResizeHandles] = useState(false);

  // Track if 3D preview has ever been shown (keep mounted once shown to avoid WebGL context issues)
  const [hasEverShownPreview, setHasEverShownPreview] = useState(showIsometricPreview);
  useEffect(() => {
    if (showIsometricPreview && !hasEverShownPreview) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- One-time state sync, only triggers once
      setHasEverShownPreview(true);
    }
  }, [showIsometricPreview, hasEverShownPreview]);

  // Show first-time toast when paint mode is activated
  useEffect(() => {
    if (paintSize) {
      const hintShown = localStorage.getItem('gridfinity-paint-mode-hint-shown');
      if (!hintShown) {
        addToast('Paint Mode: Drag to fill area, press Esc or click × to exit', 'info');
        localStorage.setItem('gridfinity-paint-mode-hint-shown', 'true');
        // Defer state update to avoid cascading renders
        setTimeout(() => {
          setShouldPulsePaintHint(true);
          // Stop pulsing after 3 seconds
          setTimeout(() => setShouldPulsePaintHint(false), 3000);
        }, 0);
      }
    } else {
      // Defer state update to avoid cascading renders
      setTimeout(() => setShouldPulsePaintHint(false), 0);
    }
  }, [paintSize, addToast]);

  // Pulse grid resize handles on first load
  useEffect(() => {
    const hintShown = localStorage.getItem('gridfinity-grid-resize-hint-shown');
    if (!hintShown) {
      localStorage.setItem('gridfinity-grid-resize-hint-shown', 'true');
      // Defer state update to avoid cascading renders
      setTimeout(() => {
        setShouldPulseResizeHandles(true);
        // Stop pulsing after 3 seconds
        setTimeout(() => setShouldPulseResizeHandles(false), 3000);
      }, 0);
    }
  }, []);

  // Pending resize confirmation state
  const [pendingResize, setPendingResize] = useState<{
    newWidth: number;
    newDepth: number;
    clippedBinIds: string[];
  } | null>(null);

  // Single interaction hook instance for the entire grid
  const { startDraw, startDrag, startResize } = useInteraction(gridRef);

  // Adaptive cell size based on viewport width for optimal grid density
  const cellSize = Math.round(getBaseCellSize(viewportWidth) * zoom);
  const gap = 1; // 1px gap between cells

  const canZoomOut = zoom > CONSTRAINTS.ZOOM_MIN;
  const canZoomIn = zoom < CONSTRAINTS.ZOOM_MAX;

  // Get active layer info
  const activeLayer = layers.find(l => l.id === activeLayerId);
  const layerBins = bins.filter(b => b.layerId === activeLayerId && b.layerId !== STAGING_ID);
  const placedBins = bins.filter(b => b.layerId !== STAGING_ID);
  const isEmpty = layerBins.length === 0;
  const isFirstLayer = layers.length > 0 && activeLayerId === layers[0]?.id;

  // Confirm pending resize - move clipped bins to staging
  const confirmResize = useCallback(() => {
    if (!pendingResize) return;
    execute(() => {
      // Move clipped bins to staging
      for (const binId of pendingResize.clippedBinIds) {
        updateBin(binId, { layerId: STAGING_ID });
      }
      // Apply the resize
      updateDrawer({ width: pendingResize.newWidth, depth: pendingResize.newDepth });
    });
    setPendingResize(null);
  }, [pendingResize, execute, updateBin, updateDrawer]);

  // Cancel pending resize
  const cancelResize = useCallback(() => {
    setPendingResize(null);
  }, []);

  // Grid edge resize state
  const [resizeDirection, setResizeDirection] = useState<ResizeDirection>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; depth: number } | null>(null);

  // Use ref to track current drawer dimensions without causing effect re-runs
  const drawerRef = useRef(drawer);
  useEffect(() => {
    drawerRef.current = drawer;
  }, [drawer]);

  const handleResizeStart = useCallback((direction: ResizeDirection, e: React.MouseEvent) => {
    e.preventDefault();
    setResizeDirection(direction);
    setResizeStart({ x: e.clientX, y: e.clientY, width: drawerRef.current.width, depth: drawerRef.current.depth });
  }, []);

  useEffect(() => {
    if (!resizeDirection || !resizeStart) return;

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - resizeStart.x;
      const dy = e.clientY - resizeStart.y;
      const cellStep = cellSize + gap;

      const updates: Partial<typeof drawer> = {};
      const currentDrawer = drawerRef.current;

      if (resizeDirection === 'width' || resizeDirection === 'both') {
        const widthDelta = Math.round(dx / cellStep);
        const newWidth = clamp(resizeStart.width + widthDelta, 1, CONSTRAINTS.GRID_MAX);
        if (newWidth !== currentDrawer.width) updates.width = newWidth;
      }

      if (resizeDirection === 'depth' || resizeDirection === 'both') {
        // Depth increases downward visually (positive dy = increase depth)
        const depthDelta = Math.round(dy / cellStep);
        const newDepth = clamp(resizeStart.depth + depthDelta, 1, CONSTRAINTS.GRID_MAX);
        if (newDepth !== currentDrawer.depth) updates.depth = newDepth;
      }

      if (Object.keys(updates).length > 0) {
        updateDrawer(updates);
      }
    };

    const handleMouseUp = () => {
      // Read current state directly from store to ensure we have the latest values
      const currentState = useLayoutStore.getState().layout;
      const currentDrawer = currentState.drawer;
      // Calculate clipped bins directly to avoid stale closure
      const clippedBins = currentState.bins.filter(b =>
        b.layerId !== STAGING_ID && (
          b.x + b.width > currentDrawer.width ||
          b.y + b.depth > currentDrawer.depth
        )
      );
      if (clippedBins.length > 0) {
        // Show confirmation dialog - user can confirm to stage bins or cancel to revert
        setPendingResize({
          newWidth: currentDrawer.width,
          newDepth: currentDrawer.depth,
          clippedBinIds: clippedBins.map(b => b.id),
        });
        // Revert to original size temporarily (user will confirm or cancel)
        updateDrawer({ width: resizeStart.width, depth: resizeStart.depth });
      }
      setResizeDirection(null);
      setResizeStart(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizeDirection, resizeStart, cellSize, gap, updateDrawer]);

  // Label sizing - must match cellSize for alignment, hide when too small
  const labelWidth = Math.max(16, Math.round(20 * zoom)); // Width of row label column
  const columnLabelHeight = Math.max(16, Math.round(20 * zoom)); // Height of column label row
  const labelFontSize = cellSize < 14 ? 0 : Math.max(8, Math.round(10 * zoom)); // Hide text when cells too small
  const labelsVisible = showLabels && cellSize >= 12; // Hide labels entirely when very zoomed out or disabled

  // Fit grid to screen - calculate optimal zoom to fit drawer in viewport
  const fitToScreen = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Available space (minus padding)
    const padding = 48; // 24px padding on each side
    // In split-screen mode, the grid area is already 50% width, so no offset needed
    // The container width already reflects the available space
    const availableWidth = container.clientWidth - padding;
    const availableHeight = container.clientHeight - padding;

    // Grid dimensions at zoom=1 (including labels and gaps)
    const labelGutter = 28; // Space for row/column labels
    const gridWidth = drawer.width * BASE_CELL_SIZE + (drawer.width - 1) * gap + labelGutter;
    const gridHeight = drawer.depth * BASE_CELL_SIZE + (drawer.depth - 1) * gap + labelGutter;

    // Calculate zoom to fit both dimensions
    const zoomToFitWidth = availableWidth / gridWidth;
    const zoomToFitHeight = availableHeight / gridHeight;
    const optimalZoom = Math.min(zoomToFitWidth, zoomToFitHeight);

    // Clamp to valid zoom range and round to nearest 0.05
    const clampedZoom = Math.max(
      CONSTRAINTS.ZOOM_MIN,
      Math.min(CONSTRAINTS.ZOOM_MAX, Math.round(optimalZoom * 20) / 20)
    );

    setZoom(clampedZoom);
  }, [drawer.width, drawer.depth, gap, setZoom]);

  // Fit to screen on initial mount and when drawer size changes
  useEffect(() => {
    // Delay to ensure container is fully rendered
    const timer = setTimeout(fitToScreen, 100);
    return () => clearTimeout(timer);
  }, [fitToScreen, drawer.width, drawer.depth]);

  // Refit when 3D preview is toggled (changes available width on desktop)
  useEffect(() => {
    if (!isMobile) {
      const timer = setTimeout(fitToScreen, 100);
      return () => clearTimeout(timer);
    }
  }, [showIsometricPreview, isMobile, fitToScreen]);

  // Select all bins that occupy a given row (1-indexed row number)
  const handleRowClick = useCallback((rowNum: number) => {
    // Convert 1-indexed to 0-indexed Y coordinate
    const rowY = rowNum - 1;
    // Find all bins on the active layer that occupy this row
    const binsInRow = bins.filter(b =>
      b.layerId === activeLayerId &&
      b.layerId !== STAGING_ID &&
      rowY >= b.y && rowY < b.y + b.depth
    );
    if (binsInRow.length > 0) {
      setSelectedBins(binsInRow.map(b => b.id));
    }
  }, [bins, activeLayerId, setSelectedBins]);

  // Select all bins that occupy a given column (1-indexed column number)
  const handleColumnClick = useCallback((colNum: number) => {
    // Convert 1-indexed to 0-indexed X coordinate
    const colX = colNum - 1;
    // Find all bins on the active layer that occupy this column
    const binsInCol = bins.filter(b =>
      b.layerId === activeLayerId &&
      b.layerId !== STAGING_ID &&
      colX >= b.x && colX < b.x + b.width
    );
    if (binsInCol.length > 0) {
      setSelectedBins(binsInCol.map(b => b.id));
    }
  }, [bins, activeLayerId, setSelectedBins]);

  // Generate column numbers (1-indexed, displayed at bottom)
  const columnLabels = Array.from({ length: drawer.width }, (_, i) => i + 1);

  // Generate row numbers (1-indexed, displayed on left)
  // Visual row at top = highest Y coordinate (drawer.depth)
  // Bottom row = Y coordinate 1
  const rowLabels = Array.from({ length: drawer.depth }, (_, i) => drawer.depth - i);

  return (
    <div className="flex flex-col h-full bg-surface relative">
      {/* Mobile toolbar - always at very top */}
      {isMobile && (
        <MobileGridToolbar onFitToScreen={fitToScreen} />
      )}

      {/* Main content area: horizontal split on desktop, vertical on mobile */}
      <div className={`flex flex-1 min-h-0 ${!isMobile && showIsometricPreview ? 'flex-row' : 'flex-col'}`}>
        {/* Mobile: 3D preview as top portion */}
        {/* Keep mounted once shown to avoid WebGL context issues with StrictMode */}
        {isMobile && hasEverShownPreview && (
          <div
            className={`w-full flex-1 bg-surface-secondary border-b border-stroke-subtle overflow-hidden ${!showIsometricPreview ? 'hidden' : ''}`}
          >
            <PanelErrorBoundary panelName="3D Preview">
              <Suspense fallback={
                <div className="w-full h-full flex items-center justify-center">
                  <div className="animate-pulse text-content-tertiary text-sm">Loading 3D preview...</div>
                </div>
              }>
                <IsometricPreview inline />
              </Suspense>
            </PanelErrorBoundary>
          </div>
        )}
        {/* Grid area */}
        <div className={`flex flex-col ${isMobile && showIsometricPreview ? 'flex-1' : 'h-full'} ${!isMobile && showIsometricPreview ? 'w-1/2 border-r border-stroke-subtle' : 'w-full'}`}>
          {/* Desktop toolbar */}
          {!isMobile && (
        <div
          className="flex items-center justify-between px-4 py-[7.5px] bg-surface-secondary border-b border-stroke-subtle"
        >
          {/* Left: Layer indicator + Paint mode */}
          <div className="flex items-center gap-3">
            {layers.length > 1 && activeLayer && (
              <button
                onClick={() => leftPanelCollapsed && toggleLeftPanel()}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface-elevated border border-stroke-subtle transition-colors hover:bg-surface-hover"
                title={leftPanelCollapsed ? "Show layers panel" : activeLayer.name}
              >
                <div className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-sm font-medium">
                  {activeLayer.name}
                </span>
                <span className="text-xs text-content-tertiary">
                  {activeLayer.height}u
                </span>
                {leftPanelCollapsed && (
                  <svg className="w-3 h-3 text-content-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>
            )}
            {/* Paint mode indicator (only shown when active) */}
            {paintSize && (
              <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary-muted border border-accent ${shouldPulsePaintHint ? 'animate-pulse' : ''}`}
                role="status"
                aria-live="polite"
              >
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span className="text-sm text-accent font-medium">
                  Paint {paintSize.width}×{paintSize.depth}
                </span>
                <div className="flex items-center gap-1 ml-1">
                  <button
                    onClick={() => setPaintSize(null)}
                    className="text-accent hover:text-accent/70 transition-colors p-0.5"
                    aria-label="Exit paint mode"
                    title="Exit paint mode"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <span className="text-xs text-accent/60">or</span>
                  <kbd className="px-1.5 py-0.5 text-xs rounded bg-accent/20 border border-accent/30 text-accent/70">Esc</kbd>
                </div>
              </div>
            )}

            {/* Keyboard drag mode indicator */}
            {keyboardDragMode && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-500/10 border border-blue-500"
                role="status"
                aria-live="polite"
              >
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <span className="text-sm text-blue-500 font-medium">
                  Move Mode
                </span>
                <div className="flex items-center gap-1 ml-1">
                  <span className="text-xs text-blue-500/80">↑↓←→</span>
                  <span className="text-xs text-blue-500/60">to move</span>
                  <kbd className="px-1.5 py-0.5 text-xs rounded bg-blue-500/20 border border-blue-500/30 text-blue-500/70">Enter</kbd>
                  <span className="text-xs text-blue-500/60">to place</span>
                  <button
                    onClick={() => setKeyboardDragMode(false)}
                    className="text-blue-500 hover:text-blue-500/70 transition-colors p-0.5 ml-1"
                    aria-label="Exit move mode"
                    title="Exit move mode (Esc)"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                <span className="text-sm text-purple-500 font-medium">
                  Resize Mode
                </span>
                <div className="flex items-center gap-1 ml-1">
                  <span className="text-xs text-purple-500/80">↑↓←→</span>
                  <span className="text-xs text-purple-500/60">to resize</span>
                  <kbd className="px-1.5 py-0.5 text-xs rounded bg-purple-500/20 border border-purple-500/30 text-purple-500/70">Enter</kbd>
                  <span className="text-xs text-purple-500/60">to apply</span>
                  <button
                    onClick={() => setKeyboardResizeMode(false)}
                    className="text-purple-500 hover:text-purple-500/70 transition-colors p-0.5 ml-1"
                    aria-label="Exit resize mode"
                    title="Exit resize mode (Esc)"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right: View controls */}
          <div className="flex items-center gap-4">
            {/* View toggles */}
            {placedBins.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-content-secondary">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={toggleShowLabels}
                  className="w-4 h-4 rounded accent-accent"
                />
                Labels
              </label>
            )}
            {layers.length > 1 && (
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-content-secondary">
                <input
                  type="checkbox"
                  checked={showOtherLayers}
                  onChange={toggleShowOtherLayers}
                  className="w-4 h-4 rounded accent-accent"
                />
                Show layers below
              </label>
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
              onClick={toggleIsometricPreview}
              className={`btn ${showIsometricPreview ? 'btn-primary' : 'btn-ghost'} px-2.5 py-1.5 flex items-center gap-1.5`}
              aria-label={showIsometricPreview ? 'Hide 3D preview' : 'Show 3D preview'}
              title={showIsometricPreview ? 'Hide 3D preview' : 'Show 3D preview'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                <path d="m3.3 7 8.7 5 8.7-5"/>
                <path d="M12 22V12"/>
              </svg>
              <span className="text-sm">3D View</span>
            </button>
          </div>
        </div>
      )}

      {/* Grid container with scroll - click background to deselect */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-auto p-6 pr-8 bg-surface flex justify-center"
        onPointerDown={(e) => {
          // Deselect if clicking on container or wrapper areas (not interactive elements)
          // Bins call stopPropagation on pointerdown, so this only fires for empty space
          const target = e.target as HTMLElement;
          // Don't deselect if clicking on buttons, inputs, or bin elements
          if (!target.closest('button') && !target.closest('input') && !target.closest('[data-bin-id]')) {
            clearSelection();
          }
        }}
      >
        {/* Grid with row/column labels wrapper - includes space for resize handles (24px on right/bottom) */}
        <div className="inline-flex flex-col flex-shrink-0 pr-6 pb-6">
          {/* Main grid area with row labels */}
          <div className="flex items-start">
            {/* Row labels column - uses same grid template as main grid for perfect alignment */}
            {labelsVisible && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: `repeat(${drawer.depth}, ${cellSize}px)`,
                  gap: gap,
                  padding: gap,
                  paddingRight: 0,
                  marginRight: 4,
                  width: labelWidth,
                  flexShrink: 0,
                }}
              >
                {rowLabels.map((num) => (
                  <button
                    key={`row-${num}`}
                    type="button"
                    className="group flex items-center justify-center select-none transition-all rounded-sm font-medium text-content-tertiary tabular-nums bg-transparent border-0 cursor-pointer hover:text-content hover:bg-surface-hover"
                    style={{
                      width: labelWidth,
                      height: cellSize,
                      fontSize: labelFontSize,
                      minHeight: 0,
                      minWidth: 0,
                      padding: 0,
                    }}
                    onClick={() => handleRowClick(num)}
                    title={`Click to select all bins in row ${num}`}
                    aria-label={`Select bins in row ${num}`}
                  >
                    {labelFontSize > 0 && num}
                  </button>
                ))}
              </div>
            )}

            {/* Grid with resize handles */}
            <div className="relative">
              {/* Grid itself */}
              <div
                ref={gridRef}
                className="relative rounded-lg"
                style={{
                  width: drawer.width * (cellSize + gap) + gap,
                  height: drawer.depth * (cellSize + gap) + gap,
                  backgroundColor: 'var(--grid-bg)',
                  boxShadow: 'var(--shadow-lg)',
                }}
                role="application"
                aria-label={`Gridfinity drawer grid, ${drawer.width} columns by ${drawer.depth} rows`}
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

              {/* Empty state overlay - hide while dragging */}
              {isEmpty && !interaction && (
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-[5]"
                >
                  <div
                    className="flex flex-col items-center p-6 rounded-xl max-w-xs text-center bg-surface"
                    style={{ opacity: 0.95, backdropFilter: 'blur(4px)' }}
                  >
                    <div
                      className="w-12 h-12 mb-4 flex items-center justify-center rounded-lg bg-surface-hover"
                    >
                      <svg
                        className="w-6 h-6 text-content-tertiary"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                      </svg>
                    </div>
                    <p
                      className="font-medium mb-1 text-sm text-content-secondary"
                    >
                      {isMobile ? 'Tap and drag to draw a bin' : 'Click and drag to draw a bin'}
                    </p>
                    <p className="text-xs text-content-disabled">
                      {isFirstLayer
                        ? (isMobile ? 'Or use Layers tab to select a size' : 'Or select a size from the Bin Palette on the left')
                        : 'Striped areas are blocked by bins below'
                      }
                    </p>
                  </div>
                </div>
              )}
              </div>

              {/* Right edge resize handle */}
              <div
                className="absolute top-0 flex items-center justify-center group"
                style={{
                  left: drawer.width * (cellSize + gap) + gap,
                  height: drawer.depth * (cellSize + gap) + gap,
                  width: 24,
                  cursor: 'ew-resize',
                }}
                onMouseDown={(e) => handleResizeStart('width', e)}
                title="Drag to add/remove columns"
              >
                <div
                  className={`h-16 w-1 rounded-full transition-all group-hover:h-24 group-hover:w-[3px] group-hover:scale-[1.3] group-hover:drop-shadow-lg ${shouldPulseResizeHandles ? 'animate-pulse' : ''}`}
                  style={{
                    backgroundColor: resizeDirection === 'width' || resizeDirection === 'both'
                      ? 'var(--color-primary)'
                      : 'var(--border-default)',
                  }}
                />
              </div>

              {/* Bottom edge resize handle - positioned below column labels */}
              <div
                className="absolute left-0 flex items-center justify-center group"
                style={{
                  top: drawer.depth * (cellSize + gap) + gap + (labelsVisible ? columnLabelHeight : 0),
                  width: drawer.width * (cellSize + gap) + gap,
                  height: 24,
                  cursor: 'ns-resize',
                }}
                onMouseDown={(e) => handleResizeStart('depth', e)}
                title="Drag to add/remove rows"
              >
                <div
                  className={`w-16 h-1 rounded-full transition-all group-hover:w-24 group-hover:h-[3px] group-hover:scale-[1.3] group-hover:drop-shadow-lg ${shouldPulseResizeHandles ? 'animate-pulse' : ''}`}
                  style={{
                    backgroundColor: resizeDirection === 'depth' || resizeDirection === 'both'
                      ? 'var(--color-primary)'
                      : 'var(--border-default)',
                  }}
                />
              </div>

              {/* Corner resize handle - positioned below column labels */}
              <div
                className="absolute flex items-center justify-center group"
                style={{
                  left: drawer.width * (cellSize + gap) + gap,
                  top: drawer.depth * (cellSize + gap) + gap + (labelsVisible ? columnLabelHeight : 0),
                  width: 24,
                  height: 24,
                  cursor: 'nwse-resize',
                }}
                onMouseDown={(e) => handleResizeStart('both', e)}
                title="Drag to add/remove rows and columns"
              >
                <div
                  className={`w-3 h-3 rounded-sm transition-all group-hover:w-5 group-hover:h-5 group-hover:scale-[1.3] group-hover:drop-shadow-lg ${shouldPulseResizeHandles ? 'animate-pulse' : ''}`}
                  style={{
                    backgroundColor: resizeDirection === 'both'
                      ? 'var(--color-primary)'
                      : 'var(--border-default)',
                  }}
                />
              </div>

              {/* Column labels row (at bottom, 1-indexed from left) - uses same grid template as main grid */}
              {labelsVisible && (
                <div
                  className="absolute left-0"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${drawer.width}, ${cellSize}px)`,
                    gap: gap,
                    padding: gap,
                    paddingTop: 0,
                    top: drawer.depth * (cellSize + gap) + gap,
                    height: columnLabelHeight,
                  }}
                >
                  {columnLabels.map((num) => (
                    <button
                      key={`col-${num}`}
                      type="button"
                      className="group flex items-center justify-center select-none transition-all rounded-sm font-medium text-content-tertiary tabular-nums bg-transparent border-0 cursor-pointer hover:text-content hover:bg-surface-hover"
                      style={{
                        width: cellSize,
                        height: columnLabelHeight,
                        fontSize: labelFontSize,
                        minHeight: 0,
                        minWidth: 0,
                        padding: 0,
                      }}
                      onClick={() => handleColumnClick(num)}
                      title={`Click to select all bins in column ${num}`}
                      aria-label={`Select bins in column ${num}`}
                    >
                      {labelFontSize > 0 && num}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

        {/* Resize confirmation dialog */}
        <ConfirmDialog
          isOpen={pendingResize !== null}
          title="Resize Grid"
          message={pendingResize
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
          className={`w-1/2 h-full bg-surface-secondary overflow-hidden ${!showIsometricPreview ? 'hidden' : ''}`}
        >
          <PanelErrorBoundary panelName="3D Preview">
            <Suspense fallback={
              <div className="w-full h-full flex items-center justify-center">
                <div className="animate-pulse text-content-tertiary text-sm">Loading 3D preview...</div>
              </div>
            }>
              <IsometricPreview inline />
            </Suspense>
          </PanelErrorBoundary>
        </div>
      )}
      </div>
    </div>
  );
}
