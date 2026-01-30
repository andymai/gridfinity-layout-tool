import type { RefObject, PointerEvent, JSX } from 'react';
import { useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useUIStore, useLayoutStore } from '@/core/store';
import { useGridCoords, useGridTemplate } from '@/features/grid-editor/hooks';
import { toPixels } from '@/features/grid-editor/utils/fractionalPixels';
import { Bin } from '../Bin';
import { getBlockedZones } from '@/shared/utils/collision';
import { DEFAULT_CATEGORY_COLOR } from '@/core/constants';
import type { Coord, ResizeHandle } from '@/core/types';
import { useTranslation } from '@/i18n';

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
export function GridCanvas({
  gridRef,
  cellSize,
  gap,
  onStartDraw,
  onStartDrag,
  onStartResize,
}: GridCanvasProps) {
  const t = useTranslation();
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

  const { getGridCoords } = useGridCoords(gridRef);

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

  // Performance: Create O(1) lookup maps to avoid O(n²) .find() calls in render loops
  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const layerMap = useMemo(() => new Map(layers.map((l) => [l.id, l])), [layers]);
  const binMap = useMemo(() => new Map(bins.map((b) => [b.id, b])), [bins]);
  const selectedBinIdSet = useMemo(() => new Set(selectedBinIds), [selectedBinIds]);

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
        {ghostBins.map((bin) => (
          <Bin
            key={bin.id}
            bin={bin}
            category={categoryMap.get(bin.category)}
            layer={layerMap.get(bin.layerId)}
            drawer={drawer}
            cellSize={cellSize}
            gap={gap}
            isGhost
            isSelected={false}
            onStartDrag={onStartDrag}
            onStartResize={onStartResize}
          />
        ))}

        {/* Blocked zones - bins from lower layers extending into this layer */}
        {blockedZones.map((zone) => {
          const sourceBin = binMap.get(zone.sourceBinId);
          const category = sourceBin ? categoryMap.get(sourceBin.category) : undefined;
          const sourceLayer = sourceBin ? layerMap.get(sourceBin.layerId) : undefined;

          // Calculate grid position (always use standard grid, no scaling)
          // Apply same fractional edge positioning as bins
          const gridCol =
            hasFractionalWidth && fractionalEdgeX === 'start'
              ? Math.floor(zone.x) + 2 // +1 for 1-based, +1 to skip fractional column
              : Math.floor(zone.x) + 1;
          const gridColSpan = Math.ceil(zone.x + zone.width) - Math.floor(zone.x);
          const zoneGridRowStart = hasFractionalDepth
            ? fractionalEdgeY === 'end'
              ? integerDepth - Math.ceil(zone.y + zone.depth) + 2 // +2: +1 for 1-based, +1 to skip fractional row at top
              : integerDepth - Math.ceil(zone.y + zone.depth) + 1 // Fractional at bottom, integers from 1
            : integerDepth - Math.ceil(zone.y + zone.depth) + 1;
          const gridRowSpan = Math.ceil(zone.y + zone.depth) - Math.floor(zone.y);

          // Check if zone has fractional dimensions (from half-bin mode bins)
          const hasFractionalDims =
            zone.x % 1 !== 0 || zone.y % 1 !== 0 || zone.width % 1 !== 0 || zone.depth % 1 !== 0;
          // Calculate true pixel size for fractional zones
          const zonePixelWidth = hasFractionalDims
            ? toPixels(zone.width, cellSize, gap)
            : undefined;
          const zonePixelHeight = hasFractionalDims
            ? toPixels(zone.depth, cellSize, gap)
            : undefined;
          // Calculate pixel offset for fractional positions
          const fractionalX = zone.x - Math.floor(zone.x);
          const fractionalYFromTop = Math.ceil(zone.y + zone.depth) - (zone.y + zone.depth);
          const offsetX = hasFractionalDims ? fractionalX * (cellSize + gap) : 0;
          const offsetY = hasFractionalDims ? fractionalYFromTop * (cellSize + gap) : 0;

          return (
            <div
              key={zone.sourceBinId}
              className="blocked-zone relative cursor-pointer transition-all duration-150 hover:opacity-50 hover:ring-2 hover:ring-white/60"
              style={{
                gridColumn: `${gridCol} / span ${gridColSpan}`,
                gridRow: `${zoneGridRowStart} / span ${gridRowSpan}`,
                // Override size and position for fractional zones
                ...(hasFractionalDims
                  ? {
                      width: zonePixelWidth,
                      height: zonePixelHeight,
                      marginLeft: offsetX,
                      marginTop: offsetY,
                    }
                  : {}),
                backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR,
                opacity: 0.3,
                zIndex: 8,
              }}
              onClick={() => sourceBin && handleBlockedZoneClick(sourceBin.id, sourceBin.layerId)}
              title={
                sourceLayer
                  ? `${t('grid.blockedByBin', { layer: sourceLayer.name })}. ${t('grid.blockedZoneClick')}`
                  : undefined
              }
              role="button"
              aria-label={
                sourceLayer
                  ? `${t('grid.blockedByBin', { layer: sourceLayer.name })}. ${t('grid.blockedZoneClick')}`
                  : t('grid.blockedZone')
              }
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
                <rect width="100%" height="100%" fill={`url(#hatch-${zone.sourceBinId})`} />
              </svg>
            </div>
          );
        })}

        {/* Active layer bins */}
        {activeBins.map((bin) => (
          <Bin
            key={bin.id}
            bin={bin}
            category={categoryMap.get(bin.category)}
            layer={layerMap.get(bin.layerId)}
            drawer={drawer}
            cellSize={cellSize}
            gap={gap}
            isGhost={false}
            isSelected={selectedBinIdSet.has(bin.id)}
            onStartDrag={onStartDrag}
            onStartResize={onStartResize}
          />
        ))}
      </div>
    </div>
  );
}
