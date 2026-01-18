import type { RefObject, PointerEvent, JSX } from 'react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore, useLayoutStore } from '@/core/store';
import { useGridCoords, useGridTemplate } from '@/features/grid-editor/hooks';
import { Bin } from './Bin';
import { getBlockedZones } from '@/features/grid-editor/utils/collision';
import { DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import type { Coord, ResizeHandle } from '@/core/types';

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

  const { getGridCoords, halfBinMode } = useGridCoords(gridRef);

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

    // In paint mode, intercept clicks on empty space to start paint interaction
    // But allow clicks on bins to fall through (to select the bin and exit paint mode)
    if (paintSize) {
      const target = e.target as HTMLElement;
      if (target.closest('[data-bin-id]')) {
        // Click is on a bin - don't intercept, let it select the bin
        return;
      }
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

  // Use shared hook for grid template computation
  const {
    gridTemplateColumns,
    gridTemplateRows,
    integerWidth,
    integerDepth,
    hasFractionalWidth,
    hasFractionalDepth,
    fractionalEdgeX,
    fractionalEdgeY,
    fractionalCellWidth,
    fractionalCellHeight,
    gridCols,
    gridRows,
    getCssColForCell: getCssCol,
    getCssRowForCell: getCssRow,
  } = useGridTemplate({ drawer, cellSize, gap });

  // Generate grid cells for visual reference
  // Only render full integer cells - fractional portions are handled separately
  const cells: JSX.Element[] = [];
  for (let y = 0; y < integerDepth; y++) {
    for (let x = 0; x < integerWidth; x++) {
      cells.push(
        <div
          key={`${x}-${y}`}
          style={{
            gridColumn: getCssCol(x),
            gridRow: getCssRow(y),
            width: cellSize,
            height: cellSize,
            backgroundColor: 'var(--grid-cell)',
            borderRadius: '2px',
          }}
        />
      );
    }
  }

  // Fractional cells - render actual grid cells for fractional row/column
  const fractionalCells: JSX.Element[] = [];

  // Fractional column cells - one for each integer row
  if (hasFractionalWidth) {
    const fracColCss = fractionalEdgeX === 'start' ? 1 : gridCols;
    for (let y = 0; y < integerDepth; y++) {
      fractionalCells.push(
        <div
          key={`frac-col-${y}`}
          style={{
            gridColumn: fracColCss,
            gridRow: getCssRow(y),
            width: fractionalCellWidth,
            height: cellSize,
            backgroundColor: 'var(--grid-cell)',
            borderRadius: '2px',
          }}
        />
      );
    }
  }

  // Fractional row cells - one for each integer column
  if (hasFractionalDepth) {
    const fracRowCss = fractionalEdgeY === 'end' ? 1 : gridRows;
    for (let x = 0; x < integerWidth; x++) {
      fractionalCells.push(
        <div
          key={`frac-row-${x}`}
          style={{
            gridColumn: getCssCol(x),
            gridRow: fracRowCss,
            width: cellSize,
            height: fractionalCellHeight,
            backgroundColor: 'var(--grid-cell)',
            borderRadius: '2px',
          }}
        />
      );
    }
  }

  // Corner cell (if both width and depth are fractional)
  if (hasFractionalWidth && hasFractionalDepth) {
    const fracColCss = fractionalEdgeX === 'start' ? 1 : gridCols;
    const fracRowCss = fractionalEdgeY === 'end' ? 1 : gridRows;
    fractionalCells.push(
      <div
        key="frac-corner"
        style={{
          gridColumn: fracColCss,
          gridRow: fracRowCss,
          width: fractionalCellWidth,
          height: fractionalCellHeight,
          backgroundColor: 'var(--grid-cell)',
          borderRadius: '2px',
        }}
      />
    );
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
          gridTemplateColumns,
          gridTemplateRows,
          gap: `${gap}px`,
          padding: `${gap}px`,
        }}
      >
        {/* Grid cells */}
        {cells}

        {/* Fractional cells (for half-unit drawer dimensions) */}
        {fractionalCells}

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
              cellSize={cellSize}
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

          // Calculate grid position (always use standard grid, no scaling)
          // Apply same fractional edge positioning as bins
          const gridCol = hasFractionalWidth && fractionalEdgeX === 'start'
            ? Math.floor(zone.x) + 2  // +1 for 1-based, +1 to skip fractional column
            : Math.floor(zone.x) + 1;
          const gridColSpan = Math.ceil(zone.x + zone.width) - Math.floor(zone.x);
          const zoneGridRowStart = hasFractionalDepth
            ? fractionalEdgeY === 'end'
              ? integerDepth - Math.ceil(zone.y + zone.depth) + 2  // +2: +1 for 1-based, +1 to skip fractional row at top
              : integerDepth - Math.ceil(zone.y + zone.depth) + 1  // Fractional at bottom, integers from 1
            : integerDepth - Math.ceil(zone.y + zone.depth) + 1;
          const gridRowSpan = Math.ceil(zone.y + zone.depth) - Math.floor(zone.y);

          // Check if zone has fractional dimensions (from half-bin mode bins)
          const hasFractionalDims = zone.x % 1 !== 0 || zone.y % 1 !== 0 || zone.width % 1 !== 0 || zone.depth % 1 !== 0;
          // Calculate true pixel size for fractional zones
          const toPixels = (units: number) => units * cellSize + Math.max(0, units - 1) * gap;
          const zonePixelWidth = hasFractionalDims ? toPixels(zone.width) : undefined;
          const zonePixelHeight = hasFractionalDims ? toPixels(zone.depth) : undefined;
          // Calculate pixel offset for fractional positions
          const fractionalX = zone.x - Math.floor(zone.x);
          const fractionalYFromTop = Math.ceil(zone.y + zone.depth) - (zone.y + zone.depth);
          const offsetX = hasFractionalDims ? fractionalX * (cellSize + gap) : 0;
          const offsetY = hasFractionalDims ? fractionalYFromTop * (cellSize + gap) : 0;

          return (
            <div
              key={zone.sourceBinId}
              className="relative cursor-pointer transition-all duration-150 hover:opacity-50 hover:ring-2 hover:ring-white/60"
              style={{
                gridColumn: `${gridCol} / span ${gridColSpan}`,
                gridRow: `${zoneGridRowStart} / span ${gridRowSpan}`,
                // Override size and position for fractional zones
                ...(hasFractionalDims ? {
                  width: zonePixelWidth,
                  height: zonePixelHeight,
                  marginLeft: offsetX,
                  marginTop: offsetY,
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
              cellSize={cellSize}
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
