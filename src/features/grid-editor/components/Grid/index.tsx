import { useRef, useState, useCallback, useEffect, useLayoutEffect, Suspense } from 'react';
import { useShallow } from 'zustand/shallow';
import { useLayoutStore } from '@/core/store';
import { useViewStore } from '@/core/store/view';
import { useInteractionStore } from '@/core/store/interaction';
import { useSelectionStore } from '@/core/store/selection';
import { useHalfBinModeStore } from '@/core/store/halfBinMode';
import { useToastStore } from '@/core/store/toast';
import { useInteraction, useGridResize } from '@/features/grid-editor/hooks';
import { useResponsive } from '@/shared/hooks';
import { BASE_CELL_SIZE, STAGING_ID, CONSTRAINTS, getBaseCellSize, HALF_BIN_SCALE } from '@/core/constants';
import { lazyWithRetry, namedExport } from '@/utils/lazyWithRetry';
import { track3DPreview } from '@/utils/analytics';
import { GridCanvas } from './GridCanvas';
import { Overlay } from './Overlay';
import { QuickLabelPopover } from './QuickLabelPopover';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog';
import { MobileGridToolbar } from '@/components/Mobile';
import { PanelErrorBoundary } from '@/components/PanelErrorBoundary';
import { CollabCursors, CollabGhosts, CollabSelectionRings } from '@/components/Collab';
import { useCollabMode } from '@/hooks/useCollabMode';
import { useCollabPresence } from '@/hooks/useCollabPresence';
import { useGridCoords } from '@/features/grid-editor/hooks/useGridCoords';
import { Checkbox } from '@/shared/components/Checkbox';
// Lazy load the 3D preview component (includes three.js, ~800KB) - with retry for chunk load failures
const IsometricPreview = lazyWithRetry(() =>
  import('./IsometricPreview').then(namedExport('IsometricPreview'))
);

/**
 * Main grid container with zoom controls, layer indicator, and row/column numbering.
 * Displays the drawer grid with bins, handles user interactions.
 */
export function Grid() {
  const { isMobile, viewportWidth } = useResponsive();
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarWidth, setToolbarWidth] = useState(0);

  // View store - zoom, visibility, panels, highlighting
  const {
    zoom,
    setZoom,
    zoomIn,
    zoomOut,
    showOtherLayers,
    toggleShowOtherLayers,
    showLabels,
    toggleShowLabels,
    leftPanelCollapsed,
    toggleLeftPanel,
    setHighlightedRowLabel,
    setHighlightedColLabel,
  } = useViewStore(
    useShallow((state) => ({
      zoom: state.zoom,
      setZoom: state.setZoom,
      zoomIn: state.zoomIn,
      zoomOut: state.zoomOut,
      showOtherLayers: state.showOtherLayers,
      toggleShowOtherLayers: state.toggleShowOtherLayers,
      showLabels: state.showLabels,
      toggleShowLabels: state.toggleShowLabels,
      leftPanelCollapsed: state.leftPanelCollapsed,
      toggleLeftPanel: state.toggleLeftPanel,
      setHighlightedRowLabel: state.setHighlightedRowLabel,
      setHighlightedColLabel: state.setHighlightedColLabel,
    }))
  );

  // Interaction store - paint mode, keyboard modes, 3D preview
  const {
    interaction,
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
      interaction: state.interaction,
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

  // Selection store - active layer, selected bins
  const {
    activeLayerId,
    selectedBinIds,
    setSelectedBins,
  } = useSelectionStore(
    useShallow((state) => ({
      activeLayerId: state.activeLayerId,
      selectedBinIds: state.selectedBinIds,
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
  const addToast = useToastStore(state => state.addToast);

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

  // Track if paint mode hint should pulse (first use)
  const [shouldPulsePaintHint, setShouldPulsePaintHint] = useState(false);

  // Overflow menu state for narrow toolbar
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

  // Track actual toolbar width to determine when to show overflow menu
  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setToolbarWidth(entry.contentRect.width);
      }
    });
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

  // Derive narrow state from actual toolbar width (threshold where content starts to clip)
  const isNarrowToolbar = !isMobile && toolbarWidth > 0 && toolbarWidth < 580;

  // Track last clicked row/column for shift-click range selection
  const [lastClickedRow, setLastClickedRow] = useState<number | null>(null);
  const [lastClickedCol, setLastClickedCol] = useState<number | null>(null);

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

  // Single interaction hook instance for the entire grid
  const { startDraw, startDrag, startResize } = useInteraction(gridRef);

  // Adaptive cell size based on viewport width for optimal grid density
  const cellSize = Math.round(getBaseCellSize(viewportWidth) * zoom);
  const gap = 1; // 1px gap between cells

  // Grid resize hook - handles drawer edge/corner resize logic
  const {
    resizeDirection,
    pendingResize,
    shouldPulseResizeHandles,
    handleResizeStart,
    confirmResize,
    cancelResize,
  } = useGridResize({ cellSize, gap });

  // In half-bin mode, visual cells are smaller to fit 2x cells in the same space
  // Formula accounts for extra gaps: (cellSize - gap) / 2 keeps total grid size constant
  const visualCellSize = halfBinMode ? (cellSize - gap) / HALF_BIN_SCALE : cellSize;
  // Scale factor for grid dimensions
  const scale = halfBinMode ? HALF_BIN_SCALE : 1;

  const canZoomOut = zoom > CONSTRAINTS.ZOOM_MIN;
  const canZoomIn = zoom < CONSTRAINTS.ZOOM_MAX;

  // Get active layer info
  const activeLayer = layers.find(l => l.id === activeLayerId);
  const layerBins = bins.filter(b => b.layerId === activeLayerId && b.layerId !== STAGING_ID);
  const placedBins = bins.filter(b => b.layerId !== STAGING_ID);
  const isEmpty = layerBins.length === 0;
  const isFirstLayer = layers.length > 0 && activeLayerId === layers[0]?.id;

  // Grid axis label sizing - must match cellSize for alignment, hide when too small
  // Note: These are separate from bin labels - axis labels always show (unless zoomed out)
  const labelWidth = Math.max(16, Math.round(20 * zoom)); // Width of row label column
  const columnLabelHeight = Math.max(16, Math.round(20 * zoom)); // Height of column label row
  const labelFontSize = cellSize < 14 ? 0 : Math.max(8, Math.round(10 * zoom)); // Hide text when cells too small
  const axisLabelsVisible = cellSize >= 12; // Grid x/y labels - always visible unless very zoomed out

  // Fit grid to screen - calculate optimal zoom to fit drawer in viewport
  const fitToScreen = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Available space (minus container padding + buffer to prevent edge overflow)
    const horizontalPadding = isMobile ? 32 : 56; // p-3 (24) + 8px buffer vs p-6 + pr-8 (56)
    const verticalPadding = isMobile ? 32 : 48; // p-3 (24) + 8px buffer vs p-6 (48)
    const availableWidth = container.clientWidth - horizontalPadding;
    const availableHeight = container.clientHeight - verticalPadding;

    // Grid dimensions at zoom=1
    const labelGutter = 28; // Space for row/column labels
    const resizeHandleSpace = isMobile ? 0 : 24; // pr-6/pb-6 for resize handles (hidden on mobile)
    const gridWidth = drawer.width * BASE_CELL_SIZE + (drawer.width - 1) * gap + labelGutter + resizeHandleSpace;
    const gridHeight = drawer.depth * BASE_CELL_SIZE + (drawer.depth - 1) * gap + labelGutter + resizeHandleSpace;

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
  }, [drawer.width, drawer.depth, gap, setZoom, isMobile]);

  // Fit to screen on initial mount and when drawer size changes (but not during resize drag)
  // Uses useLayoutEffect to calculate zoom synchronously before paint, preventing CLS
  useLayoutEffect(() => {
    // Skip while user is actively resizing via handles
    if (resizeDirection) return;
    fitToScreen();
  }, [fitToScreen, drawer.width, drawer.depth, resizeDirection]);

  // Refit when 3D preview is toggled (changes available width on desktop, height on mobile)
  // Uses useLayoutEffect for immediate response to user interaction
  useLayoutEffect(() => {
    fitToScreen();
  }, [showIsometricPreview, fitToScreen]);


  // Get all bins that occupy any row in the given range (1-indexed row numbers)
  const getBinsInRowRange = useCallback((startRow: number, endRow: number) => {
    const minRow = Math.min(startRow, endRow) - 1; // Convert to 0-indexed
    const maxRow = Math.max(startRow, endRow) - 1;
    return bins.filter(b =>
      b.layerId === activeLayerId &&
      b.layerId !== STAGING_ID &&
      // Bin occupies rows from b.y to b.y + b.depth - 1
      // Check if bin overlaps with range [minRow, maxRow]
      b.y + b.depth - 1 >= minRow && b.y <= maxRow
    );
  }, [bins, activeLayerId]);

  // Get all bins that occupy any column in the given range (1-indexed column numbers)
  const getBinsInColRange = useCallback((startCol: number, endCol: number) => {
    const minCol = Math.min(startCol, endCol) - 1; // Convert to 0-indexed
    const maxCol = Math.max(startCol, endCol) - 1;
    return bins.filter(b =>
      b.layerId === activeLayerId &&
      b.layerId !== STAGING_ID &&
      // Bin occupies columns from b.x to b.x + b.width - 1
      // Check if bin overlaps with range [minCol, maxCol]
      b.x + b.width - 1 >= minCol && b.x <= maxCol
    );
  }, [bins, activeLayerId]);

  // Select all bins that occupy a given row (1-indexed row number)
  // Supports shift-click for range selection and ctrl/cmd-click to add/remove
  const handleRowClick = useCallback((rowNum: number, event: React.MouseEvent) => {
    // Convert 1-indexed to 0-indexed Y coordinate
    const rowY = rowNum - 1;
    // Find all bins on the active layer that occupy this row
    const binsInRow = bins.filter(b =>
      b.layerId === activeLayerId &&
      b.layerId !== STAGING_ID &&
      rowY >= b.y && rowY < b.y + b.depth
    );

    const binIds = binsInRow.map(b => b.id);

    if (event.shiftKey && lastClickedRow !== null) {
      // Shift-click: select range from last clicked row to this row
      const rangeBins = getBinsInRowRange(lastClickedRow, rowNum);
      const rangeIds = rangeBins.map(b => b.id);
      // Add range to existing selection (deduplicated)
      setSelectedBins([...new Set([...selectedBinIds, ...rangeIds])]);
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd-click: toggle bins in this row
      if (binIds.length > 0) {
        const allSelected = binIds.every(id => selectedBinIds.includes(id));
        if (allSelected) {
          // Remove all bins in this row from selection
          setSelectedBins(selectedBinIds.filter(id => !binIds.includes(id)));
        } else {
          // Add all bins in this row to selection
          setSelectedBins([...new Set([...selectedBinIds, ...binIds])]);
        }
      }
      setLastClickedRow(rowNum);
    } else {
      // Normal click: replace selection
      if (binIds.length > 0) {
        setSelectedBins(binIds);
      }
      setLastClickedRow(rowNum);
    }
  }, [bins, activeLayerId, setSelectedBins, lastClickedRow, selectedBinIds, getBinsInRowRange]);

  // Select all bins that occupy a given column (1-indexed column number)
  // Supports shift-click for range selection and ctrl/cmd-click to add/remove
  const handleColumnClick = useCallback((colNum: number, event: React.MouseEvent) => {
    // Convert 1-indexed to 0-indexed X coordinate
    const colX = colNum - 1;
    // Find all bins on the active layer that occupy this column
    const binsInCol = bins.filter(b =>
      b.layerId === activeLayerId &&
      b.layerId !== STAGING_ID &&
      colX >= b.x && colX < b.x + b.width
    );

    const binIds = binsInCol.map(b => b.id);

    if (event.shiftKey && lastClickedCol !== null) {
      // Shift-click: select range from last clicked column to this column
      const rangeBins = getBinsInColRange(lastClickedCol, colNum);
      const rangeIds = rangeBins.map(b => b.id);
      // Add range to existing selection (deduplicated)
      setSelectedBins([...new Set([...selectedBinIds, ...rangeIds])]);
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd-click: toggle bins in this column
      if (binIds.length > 0) {
        const allSelected = binIds.every(id => selectedBinIds.includes(id));
        if (allSelected) {
          // Remove all bins in this column from selection
          setSelectedBins(selectedBinIds.filter(id => !binIds.includes(id)));
        } else {
          // Add all bins in this column to selection
          setSelectedBins([...new Set([...selectedBinIds, ...binIds])]);
        }
      }
      setLastClickedCol(colNum);
    } else {
      // Normal click: replace selection
      if (binIds.length > 0) {
        setSelectedBins(binIds);
      }
      setLastClickedCol(colNum);
    }
  }, [bins, activeLayerId, setSelectedBins, lastClickedCol, selectedBinIds, getBinsInColRange]);

  // Generate column numbers (1-indexed, displayed at bottom)
  // Include fractional edge label when drawer has fractional width
  // Position depends on fractionalEdgeX setting ('start' = left, 'end' = right)
  const integerWidth = Math.floor(drawer.width);
  const hasFractionalWidth = drawer.width % 1 !== 0;
  const fractionalEdgeX = drawer.fractionalEdgeX ?? 'end';
  const fractionalEdgeY = drawer.fractionalEdgeY ?? 'end';
  const columnLabels: (number | string)[] = Array.from({ length: integerWidth }, (_, i) => i + 1);
  if (hasFractionalWidth) {
    if (fractionalEdgeX === 'start') {
      columnLabels.unshift('+.5'); // Fractional at left
    } else {
      columnLabels.push('+.5'); // Fractional at right (default)
    }
  }

  // Generate row numbers (1-indexed, displayed on left)
  // Visual row at top = highest Y coordinate (drawer.depth)
  // Bottom row = Y coordinate 1
  // Include fractional edge label when drawer has fractional depth
  // Position depends on fractionalEdgeY setting ('start' = bottom, 'end' = top)
  const integerDepth = Math.floor(drawer.depth);
  const hasFractionalDepth = drawer.depth % 1 !== 0;
  // For depth 9.5: integer labels are 9,8,7,6,5,4,3,2,1 (rows 1-9 from bottom)
  const rowLabels: (number | string)[] = Array.from({ length: integerDepth }, (_, i) => integerDepth - i);
  if (hasFractionalDepth) {
    if (fractionalEdgeY === 'end') {
      rowLabels.unshift('+.5'); // Fractional at top (CSS row 1)
    } else {
      rowLabels.push('+.5'); // Fractional at bottom
    }
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-surface relative">
      {/* Mobile toolbar - always at very top */}
      {isMobile && (
        <MobileGridToolbar onFitToScreen={fitToScreen} />
      )}

      {/* Main content area: horizontal split on desktop, vertical on mobile */}
      <div className={`flex flex-1 min-h-0 ${!isMobile && showIsometricPreview ? 'flex-row overflow-hidden' : 'flex-col'}`}>
        {/* Mobile: 3D preview as top portion */}
        {/* Keep mounted once shown to avoid WebGL context issues with StrictMode */}
        {isMobile && hasEverShownPreview && (
          <div
            data-3d-preview
            className={`w-full flex-1 min-h-0 bg-surface-secondary border-b border-stroke-subtle overflow-hidden ${!showIsometricPreview ? 'hidden' : ''}`}
          >
            <PanelErrorBoundary panelName="3D Preview">
              <Suspense fallback={
                // Reserve minimum height to prevent CLS while loading
                <div className="w-full h-full min-h-[200px] flex items-center justify-center bg-surface-secondary">
                  <div className="animate-pulse text-content-tertiary text-sm">Loading 3D preview...</div>
                </div>
              }>
                <IsometricPreview inline />
              </Suspense>
            </PanelErrorBoundary>
          </div>
        )}
        {/* Grid area */}
        <div className={`flex flex-col ${isMobile && showIsometricPreview ? 'flex-1 min-h-0' : 'h-full'} ${!isMobile && showIsometricPreview ? 'w-1/2 min-w-0 border-r border-stroke-subtle' : 'w-full'}`}>
          {/* Desktop toolbar */}
          {!isMobile && (
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
            {/* Paint mode indicator (only shown when active) - click anywhere to exit */}
            {paintSize && (
              <button
                onClick={() => setPaintSize(null)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary-muted border border-accent hover:bg-accent/20 transition-colors cursor-pointer ${shouldPulsePaintHint ? 'animate-pulse' : ''}`}
                aria-label="Exit paint mode"
                title="Click to exit paint mode"
              >
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span className="text-sm text-accent font-medium leading-none">
                  Paint {paintSize.width}×{paintSize.depth}
                </span>
                <svg className="w-4 h-4 text-accent/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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
                <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                <span className="text-sm text-blue-500 font-medium">
                  Move Mode
                </span>
                <div className="flex items-center gap-1 ml-1">
                  <span className="text-xs text-blue-500/80">↑↓←→</span>
                  <span className="text-xs text-blue-500/60">to move</span>
                  <kbd className="px-1.5 py-0.5 text-xs rounded bg-blue-500/20 border border-blue-500/30 text-blue-500/70 leading-none">Enter</kbd>
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
                  <kbd className="px-1.5 py-0.5 text-xs rounded bg-purple-500/20 border border-purple-500/30 text-purple-500/70 leading-none">Enter</kbd>
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
            {/* View toggles - only show inline when not narrow */}
            {!isNarrowToolbar && placedBins.length > 0 && (
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
                <span className={showOtherLayers ? 'text-content' : 'text-content-secondary'}>Show layers below</span>
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
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
                <path d="m3.3 7 8.7 5 8.7-5"/>
                <path d="M12 22V12"/>
              </svg>
              {!isNarrowToolbar && <span className="text-sm">3D View</span>}
            </button>

            {/* Overflow menu button - only when narrow */}
            {isNarrowToolbar && (placedBins.length > 0 || layers.length > 1) && (
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
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>

                {/* Overflow dropdown */}
                {overflowMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 py-2 px-1 bg-surface-elevated border border-stroke-subtle rounded-lg shadow-lg z-50 min-w-[160px]"
                    role="menu"
                  >
                    {placedBins.length > 0 && (
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
                        <span className={showLabels ? 'text-content' : 'text-content-secondary'}>Labels</span>
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
                        <span className={showOtherLayers ? 'text-content' : 'text-content-secondary'}>Show layers below</span>
                        <Checkbox checked={showOtherLayers} variant="desktop" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
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
          if (!target.closest('button') && !target.closest('input') && !target.closest('[data-bin-id]')) {
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
            gridTemplateColumns: axisLabelsVisible ? `auto 1fr` : '1fr',
            gridTemplateRows: '1fr',
            columnGap: axisLabelsVisible ? 4 : 0,
          }}
        >
          {/* Row labels column - sticky to left edge */}
          {axisLabelsVisible && (() => {
            const fullRowSize = scale * visualCellSize + (scale - 1) * gap;
            const fractionalDepthPart = drawer.depth - integerDepth; // e.g., 0.5
            // Match GridCanvas fractional cell sizing: fractionalPart * (cellSize + gap) - gap
            const fractionalRowSize = fractionalDepthPart * (cellSize + gap) - gap;
            // Build grid template based on fractionalEdgeY setting
            // 'end' = fractional at top (CSS row 1), 'start' = fractional at bottom (CSS row last)
            const rowTemplate = hasFractionalDepth
              ? fractionalEdgeY === 'end'
                ? `${fractionalRowSize}px repeat(${integerDepth}, ${fullRowSize}px)` // Fractional at top
                : `repeat(${integerDepth}, ${fullRowSize}px) ${fractionalRowSize}px` // Fractional at bottom
              : `repeat(${integerDepth}, ${fullRowSize}px)`;

            return (
              <div
                className="bg-surface"
                style={{
                  display: 'grid',
                  gridTemplateRows: rowTemplate,
                  gap: gap,
                  paddingTop: gap,
                  paddingBottom: gap,
                  position: 'sticky',
                  left: 0,
                  zIndex: 30,
                  alignSelf: 'start',
                }}
              >
                {rowLabels.map((num, idx) => {
                  // Fractional row position depends on fractionalEdgeY setting
                  const isFractionalRow = hasFractionalDepth && (
                    (fractionalEdgeY === 'end' && idx === 0) ||  // Top
                    (fractionalEdgeY === 'start' && idx === rowLabels.length - 1)  // Bottom
                  );
                  const rowHeight = isFractionalRow ? fractionalRowSize : fullRowSize;
                  // Format label: show decimal for fractional, integer otherwise
                  const label = typeof num === 'number' && num % 1 !== 0 ? num.toFixed(1) : num;

                  return (
                    <button
                      key={`row-${num}`}
                      type="button"
                      className="group flex items-center justify-center select-none transition-colors font-medium text-content-tertiary tabular-nums bg-transparent border-0 cursor-pointer hover:text-content"
                      style={{
                        width: labelWidth,
                        height: rowHeight,
                        fontSize: isFractionalRow ? Math.max(6, labelFontSize - 2) : labelFontSize,
                        minHeight: 0,
                        minWidth: 0,
                        padding: 0,
                      }}
                      onClick={(e) => typeof num === 'number' && handleRowClick(Math.floor(num), e)}
                      onMouseEnter={() => typeof num === 'number' && setHighlightedRowLabel(Math.floor(num))}
                      onMouseLeave={() => setHighlightedRowLabel(null)}
                      title={`Click to select row ${label}. Shift-click for range. Ctrl-click to add/remove.`}
                      aria-label={`Select bins in row ${label}`}
                    >
                      {labelFontSize > 0 && label}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {/* Grid with resize handles */}
          <div className="relative">
              {/* Grid itself */}
              <div
                ref={gridRef}
                className={`relative ${axisLabelsVisible ? '' : 'rounded-lg'}`}
                style={{
                  // In half-bin mode, grid has 2x cells at half the size
                  width: drawer.width * scale * (visualCellSize + gap) + gap,
                  height: drawer.depth * scale * (visualCellSize + gap) + gap,
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

              {/* Empty state overlay - hide while dragging or when grid is too small */}
              {isEmpty && !interaction && (drawer.width * cellSize > 200) && (drawer.depth * cellSize > 150) && (
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

              {/* Grid resize handles - hidden on mobile (use Settings to change dimensions) */}
              {!isMobile && (
                <>
                  {/* Right edge resize handle */}
                  <div
                    className="absolute top-0 flex items-center justify-center group"
                    style={{
                      left: drawer.width * scale * (visualCellSize + gap) + gap,
                      height: drawer.depth * scale * (visualCellSize + gap) + gap,
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
                      top: drawer.depth * scale * (visualCellSize + gap) + gap + (axisLabelsVisible ? columnLabelHeight : 0),
                      width: drawer.width * scale * (visualCellSize + gap) + gap,
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
                      left: drawer.width * scale * (visualCellSize + gap) + gap,
                      top: drawer.depth * scale * (visualCellSize + gap) + gap + (axisLabelsVisible ? columnLabelHeight : 0),
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
                </>
              )}

              {/* Column labels row (at bottom, 1-indexed from left) - uses same grid template as main grid */}
              {axisLabelsVisible && (() => {
                const fullColSize = scale * visualCellSize + (scale - 1) * gap;
                const fractionalWidthPart = drawer.width - integerWidth; // e.g., 0.5
                // Match GridCanvas fractional cell sizing: fractionalPart * (cellSize + gap) - gap
                const fractionalColSize = fractionalWidthPart * (cellSize + gap) - gap;
                // Build grid template based on fractionalEdgeX setting
                // 'start' = fractional at left (CSS col 1), 'end' = fractional at right (CSS col last)
                const colTemplate = hasFractionalWidth
                  ? fractionalEdgeX === 'start'
                    ? `${fractionalColSize}px repeat(${integerWidth}, ${fullColSize}px)` // Fractional at left
                    : `repeat(${integerWidth}, ${fullColSize}px) ${fractionalColSize}px` // Fractional at right
                  : `repeat(${integerWidth}, ${fullColSize}px)`;

                return (
                  <div
                    className="absolute left-0 bg-surface"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: colTemplate,
                      gap: gap,
                      padding: gap,
                      paddingTop: 0,
                      top: drawer.depth * scale * (visualCellSize + gap) + gap,
                      height: columnLabelHeight,
                      zIndex: 30,
                    }}
                  >
                    {columnLabels.map((num, idx) => {
                      // Fractional column position depends on fractionalEdgeX setting
                      const isFractionalCol = hasFractionalWidth && (
                        (fractionalEdgeX === 'start' && idx === 0) ||  // Left
                        (fractionalEdgeX === 'end' && idx === columnLabels.length - 1)  // Right
                      );
                      const colWidth = isFractionalCol ? fractionalColSize : fullColSize;
                      // Format label: show decimal for fractional, integer otherwise
                      const label = typeof num === 'number' && num % 1 !== 0 ? num.toFixed(1) : num;

                      return (
                        <button
                          key={`col-${num}`}
                          type="button"
                          className="group flex items-center justify-center select-none transition-colors font-medium text-content-tertiary tabular-nums bg-transparent border-0 cursor-pointer hover:text-content"
                          style={{
                            width: colWidth,
                            height: columnLabelHeight,
                            fontSize: isFractionalCol ? Math.max(6, labelFontSize - 2) : labelFontSize,
                            minHeight: 0,
                            minWidth: 0,
                            padding: 0,
                          }}
                          onClick={(e) => typeof num === 'number' && handleColumnClick(Math.floor(num), e)}
                          onMouseEnter={() => typeof num === 'number' && setHighlightedColLabel(Math.floor(num))}
                          onMouseLeave={() => setHighlightedColLabel(null)}
                          title={`Click to select column ${label}. Shift-click for range. Ctrl-click to add/remove.`}
                          aria-label={`Select bins in column ${label}`}
                        >
                          {labelFontSize > 0 && label}
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
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
          data-3d-preview
          className={`w-1/2 h-full bg-surface-secondary overflow-hidden ${!showIsometricPreview ? 'hidden' : ''}`}
        >
          <PanelErrorBoundary panelName="3D Preview">
            <Suspense fallback={
              // Reserve full space to prevent CLS while loading
              <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-surface-secondary">
                <div className="animate-pulse text-content-tertiary text-sm">Loading 3D preview...</div>
              </div>
            }>
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
