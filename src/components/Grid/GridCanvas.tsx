import type { RefObject, PointerEvent, JSX } from 'react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore, useLayoutStore } from '../../store';
import { useGridCoords } from '../../hooks';
import { Bin } from './Bin';
import { getBlockedZones } from '../../utils/collision';
import { DEFAULT_CATEGORY_COLOR, HALF_BIN_SCALE } from '../../constants';
import type { Coord, ResizeHandle } from '../../types';

interface GridCanvasProps {
  gridRef: RefObject<HTMLDivElement | null>;
  cellSize: number;
  gap: number;
  onStartDraw: (coord: Coord, pointerId?: number) => void;
  onStartDrag: (binId: string, clientX: number, clientY: number) => void;
  onStartResize: (binId: string, handle: ResizeHandle) => void;
}

/**
 * Cell rendering and mouse handling.
 * Uses CSS Grid to render cells and bins.
 */
export function GridCanvas({ gridRef, cellSize, gap, onStartDraw, onStartDrag, onStartResize }: GridCanvasProps) {
  const { drawer, bins, layers, categories } = useLayoutStore(
    useShallow((state) => ({
      drawer: state.layout.drawer,
      bins: state.layout.bins,
      layers: state.layout.layers,
      categories: state.layout.categories,
    }))
  );

  const {
    activeLayerId,
    showOtherLayers,
    selectedBinIds,
    setSelectedBin,
    setActiveLayer,
    paintSize,
    interaction,
  } = useUIStore(
    useShallow((state) => ({
      activeLayerId: state.activeLayerId,
      showOtherLayers: state.showOtherLayers,
      selectedBinIds: state.selectedBinIds,
      setSelectedBin: state.setSelectedBin,
      setActiveLayer: state.setActiveLayer,
      paintSize: state.paintSize,
      interaction: state.interaction,
    }))
  );

  const { getGridCoords, halfBinMode, visualCellSize } = useGridCoords(gridRef);

  // Memoized: Filter bins for current layer
  const activeBins = useMemo(
    () => bins.filter((b) => b.layerId === activeLayerId),
    [bins, activeLayerId]
  );

  // Memoized: Filter ghost bins (bins from layers below)
  const ghostBins = useMemo(() => {
    if (!showOtherLayers) return [];
    const activeLayerIndex = layers.findIndex((l) => l.id === activeLayerId);
    const layersBelowIds = layers.slice(0, activeLayerIndex).map((l) => l.id);
    return bins.filter((b) => layersBelowIds.includes(b.layerId));
  }, [bins, layers, activeLayerId, showOtherLayers]);

  // Memoized: Get blocked zones for current layer
  const blockedZones = useMemo(
    () => getBlockedZones(activeLayerId, bins, layers),
    [activeLayerId, bins, layers]
  );

  // Capture phase handler for paint mode - runs before Bin components can stop propagation
  const handlePointerDownCapture = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Ignore non-primary pointer (second finger) - allow two-finger pan
    if (!e.isPrimary) return;

    // In paint mode, intercept all clicks to start paint interaction
    if (paintSize) {
      const coords = getGridCoords(e.clientX, e.clientY);
      if (coords) {
        e.preventDefault();
        e.stopPropagation();
        onStartDraw(coords, e.pointerId);
      }
    }
  };

  // Bubble phase handler for normal draw mode
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    // Only start draw on left click on empty space (paint mode handled in capture)
    if (e.button !== 0 || paintSize) return;
    // Ignore non-primary pointer (second finger) - allow two-finger pan
    if (!e.isPrimary) return;
    if ((e.target as HTMLElement).closest('[data-bin-id]')) return;

    const coords = getGridCoords(e.clientX, e.clientY);
    if (coords) {
      onStartDraw(coords, e.pointerId);
    }
  };

  const handleBlockedZoneClick = (binId: string, layerId: string) => {
    setActiveLayer(layerId);
    setSelectedBin(binId);
  };

  // Grid dimensions depend on half-bin mode
  const gridCols = halfBinMode ? drawer.width * HALF_BIN_SCALE : drawer.width;
  const gridRows = halfBinMode ? drawer.depth * HALF_BIN_SCALE : drawer.depth;
  const actualCellSize = halfBinMode ? visualCellSize : cellSize;

  // Generate grid cells for visual reference
  const cells: JSX.Element[] = [];
  if (halfBinMode) {
    // Half-bin mode: render 2x cells with crosshairs at whole-unit intersections
    // Iterate Y from top to bottom (gridRows-1 to 0) to match coordinate system (Y=0 at bottom)
    for (let vy = gridRows - 1; vy >= 0; vy--) {
      for (let vx = 0; vx < gridCols; vx++) {
        // Check if this is at a whole-unit boundary (for crosshairs)
        const isAtCrosshair = vx % HALF_BIN_SCALE === 0 && vy % HALF_BIN_SCALE === 0;

        cells.push(
          <div
            key={`${vx}-${vy}`}
            style={{
              gridColumn: vx + 1,
              gridRow: gridRows - vy,
              width: actualCellSize,
              height: actualCellSize,
              backgroundColor: 'var(--grid-cell)',
              borderRadius: '2px',
              boxSizing: 'border-box',
              position: 'relative',
            }}
          >
            {/* Crosshair at center of each 1x1 grid unit (intersection of the 2x2 half-cells) */}
            {isAtCrosshair && (
              <div
                style={{
                  position: 'absolute',
                  // Position at bottom-right corner of this cell, then center the crosshair on that point
                  left: '100%',
                  top: '100%',
                  width: 9,
                  height: 9,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                }}
              >
                {/* Horizontal line */}
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: 0,
                    right: 0,
                    height: 1,
                    backgroundColor: 'var(--grid-line-half)',
                    transform: 'translateY(-50%)',
                  }}
                />
                {/* Vertical line */}
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: 0,
                    bottom: 0,
                    width: 1,
                    backgroundColor: 'var(--grid-line-half)',
                    transform: 'translateX(-50%)',
                  }}
                />
              </div>
            )}
          </div>
        );
      }
    }
  } else {
    // Standard mode: render normal cells
    for (let y = drawer.depth - 1; y >= 0; y--) {
      for (let x = 0; x < drawer.width; x++) {
        cells.push(
          <div
            key={`${x}-${y}`}
            style={{
              gridColumn: x + 1,
              gridRow: drawer.depth - y,
              width: actualCellSize,
              height: actualCellSize,
              backgroundColor: 'var(--grid-cell)',
              borderRadius: '2px',
            }}
          />
        );
      }
    }
  }

  return (
    <div
      className="absolute inset-0"
      onPointerDownCapture={handlePointerDownCapture}
      onPointerDown={handlePointerDown}
      style={{
        cursor: paintSize ? 'cell' : 'crosshair',
        // Allow two-finger pan when no interaction active, block during draw/drag
        touchAction: interaction ? 'none' : 'pan-x pan-y',
      }}
    >
      {/* CSS Grid container */}
      <div
        className="absolute inset-0"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridCols}, ${actualCellSize}px)`,
          gridTemplateRows: `repeat(${gridRows}, ${actualCellSize}px)`,
          gap: `${gap}px`,
          padding: `${gap}px`,
        }}
      >
        {/* Grid cells */}
        {cells}

        {/* Ghost bins (other layers) */}
        {ghostBins.map((bin) => {
          const category = categories.find((c) => c.id === bin.category);
          const layer = layers.find((l) => l.id === bin.layerId);
          return (
            <Bin
              key={bin.id}
              bin={bin}
              category={category}
              layer={layer}
              drawer={drawer}
              cellSize={actualCellSize}
              gap={gap}
              halfBinMode={halfBinMode}
              isGhost
              isSelected={false}
              onStartDrag={onStartDrag}
              onStartResize={onStartResize}
            />
          );
        })}

        {/* Blocked zones - bins from lower layers extending into this layer */}
        {blockedZones.map((zone) => {
          const sourceBin = bins.find((b) => b.id === zone.sourceBinId);
          const category = sourceBin
            ? categories.find((c) => c.id === sourceBin.category)
            : undefined;
          const sourceLayer = sourceBin ? layers.find(l => l.id === sourceBin.layerId) : undefined;

          // Calculate grid position - multiply by scale in half-bin mode
          const scale = halfBinMode ? HALF_BIN_SCALE : 1;
          const gridCol = Math.round(zone.x * scale) + 1;
          const gridColSpan = Math.round(zone.width * scale);
          const gridRowStart = halfBinMode
            ? Math.round((drawer.depth - zone.y - zone.depth) * scale) + 1
            : drawer.depth - zone.y - zone.depth + 1;
          const gridRowSpan = Math.round(zone.depth * scale);

          // Check if zone has fractional dimensions (from half-bin mode bins)
          const hasFractionalDims = zone.width % 1 !== 0 || zone.depth % 1 !== 0;
          // Calculate true pixel size for fractional zones
          const toPixels = (units: number) => units * actualCellSize + Math.max(0, units - 1) * gap;
          const zonePixelWidth = hasFractionalDims && !halfBinMode ? toPixels(zone.width) : undefined;
          const zonePixelHeight = hasFractionalDims && !halfBinMode ? toPixels(zone.depth) : undefined;

          return (
            <div
              key={zone.sourceBinId}
              className="relative cursor-pointer transition-all duration-150 hover:opacity-50 hover:ring-2 hover:ring-white/60"
              style={{
                gridColumn: `${gridCol} / span ${gridColSpan}`,
                gridRow: `${gridRowStart} / span ${gridRowSpan}`,
                // Override size for fractional zones when halfBinMode is off
                ...(hasFractionalDims && !halfBinMode ? {
                  width: zonePixelWidth,
                  height: zonePixelHeight,
                } : {}),
                backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR,
                opacity: 0.3,
                zIndex: 8,
              }}
              onClick={() => sourceBin && handleBlockedZoneClick(sourceBin.id, sourceBin.layerId)}
              title={sourceLayer ? `Blocked by bin from ${sourceLayer.name} extending upward. Click to switch to ${sourceLayer.name}.` : undefined}
              role="button"
              aria-label={sourceLayer ? `Blocked by bin from ${sourceLayer.name}. Click to switch layer.` : 'Blocked zone'}
            >
              {/* Diagonal hatching pattern */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <pattern
                    id={`hatch-${zone.sourceBinId}`}
                    patternUnits="userSpaceOnUse"
                    width="8"
                    height="8"
                  >
                    <path
                      d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4"
                      stroke="#000"
                      strokeWidth="1"
                      opacity="0.3"
                    />
                  </pattern>
                </defs>
                <rect
                  width="100%"
                  height="100%"
                  fill={`url(#hatch-${zone.sourceBinId})`}
                />
              </svg>
            </div>
          );
        })}

        {/* Active layer bins */}
        {activeBins.map((bin) => {
          const category = categories.find((c) => c.id === bin.category);
          const layer = layers.find((l) => l.id === bin.layerId);
          return (
            <Bin
              key={bin.id}
              bin={bin}
              category={category}
              layer={layer}
              drawer={drawer}
              cellSize={actualCellSize}
              gap={gap}
              halfBinMode={halfBinMode}
              isGhost={false}
              isSelected={selectedBinIds.includes(bin.id)}
              onStartDrag={onStartDrag}
              onStartResize={onStartResize}
            />
          );
        })}
      </div>
    </div>
  );
}
