import { useMemo } from 'react';
import type { Layout, Layer, LayerId } from '@/core/types';
import type { PrintViewSettings } from '@/core/store/settings';
import { PrintBin } from '../PrintBin';
import {
  getVisibleBinsForPrint,
  getVisibleLayers,
  getUsedCategories,
  formatDrawerDimensions,
  formatPrintDate,
  sortBinsForPrint,
} from '@/features/print-export/utils/printLayout';
import { getDisplayLayers } from '@/shared/utils';
import { useGridTemplate } from '@/shared/hooks';
import { useTranslation } from '@/i18n';

const LIST_SEPARATOR = ', ';

// Page dimensions for print (in pixels at 96 DPI, accounting for 0.5" margins)
const PORTRAIT_WIDTH_PX = 670; // 8.5" - 1" margins = 7" ≈ 670px
const LANDSCAPE_WIDTH_PX = 950; // 11" - 1" margins = 10" ≈ 950px
const PORTRAIT_HEIGHT_PX = 960; // 11" - 1" margins = 10" ≈ 960px
const LANDSCAPE_HEIGHT_PX = 720; // 8.5" - 1" margins = 7.5" ≈ 720px
const ROW_LABELS_WIDTH = 22; // Width reserved for row labels
const COL_LABELS_HEIGHT = 20; // Height reserved for column labels
// Conservative estimates based on print CSS (pt sizes at 96 DPI).
// Intentionally over-budget so the grid doesn't overflow onto a second page.
// Note: legend and bin list are excluded — "fit to page" constrains the grid only.
const HEADER_HEIGHT_ESTIMATE = 100; // h1 (18pt) + info row + margins/padding/border
const LAYER_HEADER_HEIGHT = 48; // 12pt font + 12pt top margin + 8pt bottom margin
const MIN_CELL_SIZE = 20;
const MAX_CELL_SIZE = 120;
const DEFAULT_GAP = 1;

interface PrintLayoutProps {
  layout: Layout;
  selectedLayerIds: LayerId[];
  settings: PrintViewSettings;
  /** Available width in pixels. If not provided, uses default print width. */
  availableWidth?: number;
}

/**
 * Renders the printable layout with header, grid, and legend.
 */
export function PrintLayout({
  layout,
  selectedLayerIds,
  settings,
  availableWidth,
}: PrintLayoutProps) {
  const t = useTranslation();
  const { drawer, bins, layers, categories } = layout;
  const gap = DEFAULT_GAP;

  // Calculate grid dimensions
  const gridCols = Math.ceil(drawer.width);
  const drawerRows = Math.ceil(drawer.depth);

  // Determine target width: use measured width if available, otherwise use orientation setting
  const defaultWidth =
    settings.orientation === 'landscape' ? LANDSCAPE_WIDTH_PX : PORTRAIT_WIDTH_PX;
  const targetWidth = availableWidth ?? defaultWidth;

  // Calculate optimal cell size to fill available width
  // Account for row labels if grid coordinates are shown
  const labelsWidth = settings.showGridCoordinates ? ROW_LABELS_WIDTH : 0;
  const gridAreaWidth = targetWidth - labelsWidth;
  // Formula: gridWidth = gridCols * cellSize + (gridCols - 1) * gap
  // Solving for cellSize: cellSize = (gridWidth - (gridCols - 1) * gap) / gridCols
  const widthConstrainedSize = (gridAreaWidth - (gridCols - 1) * gap) / gridCols;

  // When fitToPage is enabled, constrain by page height so the grid fits on one page.
  // For the modal preview, scale proportionally so the preview matches the printed output.
  const numLayers = selectedLayerIds.length;
  let calculatedCellSize = widthConstrainedSize;
  if (settings.fitToPage && numLayers > 0) {
    const defaultPageWidth =
      settings.orientation === 'landscape' ? LANDSCAPE_WIDTH_PX : PORTRAIT_WIDTH_PX;
    const pageHeight =
      settings.orientation === 'landscape' ? LANDSCAPE_HEIGHT_PX : PORTRAIT_HEIGHT_PX;
    // Scale page height proportionally when rendering in the modal preview
    const scaledPageHeight =
      availableWidth !== undefined ? pageHeight * (availableWidth / defaultPageWidth) : pageHeight;
    const reservedHeight = settings.showHeader ? HEADER_HEIGHT_ESTIMATE : 0;
    // Each layer grid has its own column labels and layer header when multiple layers shown
    const perGridOverhead =
      (settings.showGridCoordinates ? COL_LABELS_HEIGHT : 0) +
      (numLayers > 1 ? LAYER_HEADER_HEIGHT : 0);
    // Divide remaining height equally among all layer grids
    const gridAreaHeight =
      (scaledPageHeight - reservedHeight - perGridOverhead * numLayers) / numLayers;
    const heightConstrainedSize = (gridAreaHeight - (drawerRows - 1) * gap) / drawerRows;
    calculatedCellSize = Math.min(widthConstrainedSize, heightConstrainedSize);
  }

  const cellSize = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, Math.floor(calculatedCellSize)));

  // Get visible layers in display order (top layer first, matching editor UI)
  const visibleLayers = useMemo(
    () => getDisplayLayers(getVisibleLayers(layers, selectedLayerIds)),
    [layers, selectedLayerIds]
  );

  const allVisibleBins = useMemo(
    () => getVisibleBinsForPrint(bins, selectedLayerIds),
    [bins, selectedLayerIds]
  );

  // Get categories used by visible bins
  const usedCategories = useMemo(
    () => getUsedCategories(allVisibleBins, categories),
    [allVisibleBins, categories]
  );

  // Use shared hook for grid template computation
  // Note: gridCols is computed locally above for cellSize calculation, so we don't destructure it here
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
    gridRows,
    getCssColForCell,
    getCssRowForCell,
  } = useGridTemplate({ drawer, cellSize, gap });

  // Generate grid cells for visual reference
  const cells = useMemo(() => {
    const result: React.ReactNode[] = [];

    for (let y = 0; y < integerDepth; y++) {
      for (let x = 0; x < integerWidth; x++) {
        const cssCol = getCssColForCell(x);
        const cssRow = getCssRowForCell(y);
        result.push(
          <div
            key={`cell-${x}-${y}`}
            className="print-grid-cell"
            style={{
              gridColumn: cssCol,
              gridRow: cssRow,
              width: cellSize,
              height: cellSize,
            }}
          />
        );
      }
    }

    // Add fractional column cells if needed
    if (hasFractionalWidth) {
      const fracColCss = fractionalEdgeX === 'start' ? 1 : gridCols;
      for (let y = 0; y < integerDepth; y++) {
        const cssRow = getCssRowForCell(y);
        result.push(
          <div
            key={`frac-col-${y}`}
            className="print-grid-cell"
            style={{
              gridColumn: fracColCss,
              gridRow: cssRow,
              width: fractionalCellWidth,
              height: cellSize,
            }}
          />
        );
      }
    }

    // Add fractional row cells if needed
    if (hasFractionalDepth) {
      const fracRowCss = fractionalEdgeY === 'start' ? gridRows : 1;
      for (let x = 0; x < integerWidth; x++) {
        const cssCol = getCssColForCell(x);
        result.push(
          <div
            key={`frac-row-${x}`}
            className="print-grid-cell"
            style={{
              gridColumn: cssCol,
              gridRow: fracRowCss,
              width: cellSize,
              height: fractionalCellHeight,
            }}
          />
        );
      }
    }

    // Add corner cell if both fractional width and depth
    if (hasFractionalWidth && hasFractionalDepth) {
      const fracColCss = fractionalEdgeX === 'start' ? 1 : gridCols;
      const fracRowCss = fractionalEdgeY === 'start' ? gridRows : 1;
      result.push(
        <div
          key="frac-corner"
          className="print-grid-cell"
          style={{
            gridColumn: fracColCss,
            gridRow: fracRowCss,
            width: fractionalCellWidth,
            height: fractionalCellHeight,
          }}
        />
      );
    }

    return result;
  }, [
    integerWidth,
    integerDepth,
    cellSize,
    gridCols,
    gridRows,
    hasFractionalWidth,
    hasFractionalDepth,
    fractionalEdgeX,
    fractionalEdgeY,
    fractionalCellWidth,
    fractionalCellHeight,
    getCssColForCell,
    getCssRowForCell,
  ]);

  // Generate column labels (1, 2, 3, ...)
  // Note: All hooks must be before any early returns to satisfy React hooks rules
  const columnLabels = useMemo(() => {
    const labels: React.ReactNode[] = [];
    // If fractional edge at start, add fractional column label first
    if (hasFractionalWidth && fractionalEdgeX === 'start') {
      labels.push(
        <div
          key="col-frac"
          className="print-axis-label print-col-label"
          style={{ width: fractionalCellWidth }}
        >
          .5
        </div>
      );
    }
    for (let x = 0; x < integerWidth; x++) {
      labels.push(
        <div
          key={`col-${x}`}
          className="print-axis-label print-col-label"
          style={{ width: cellSize }}
        >
          {x + 1}
        </div>
      );
    }
    // If fractional edge at end (default), add fractional column label last
    if (hasFractionalWidth && fractionalEdgeX === 'end') {
      labels.push(
        <div
          key="col-frac"
          className="print-axis-label print-col-label"
          style={{ width: fractionalCellWidth }}
        >
          .5
        </div>
      );
    }
    return labels;
  }, [integerWidth, hasFractionalWidth, fractionalEdgeX, fractionalCellWidth, cellSize]);

  // Generate row labels (1, 2, 3, ... from bottom)
  // Labels are rendered top-to-bottom in CSS, so we reverse the order
  const rowLabels = useMemo(() => {
    const labels: React.ReactNode[] = [];
    // If fractional edge at end (top), add fractional row label first (at top)
    if (hasFractionalDepth && fractionalEdgeY === 'end') {
      labels.push(
        <div
          key="row-frac"
          className="print-axis-label print-row-label"
          style={{ height: fractionalCellHeight }}
        >
          .5
        </div>
      );
    }
    // Integer rows from top to bottom (y values from high to low)
    for (let y = integerDepth - 1; y >= 0; y--) {
      labels.push(
        <div
          key={`row-${y}`}
          className="print-axis-label print-row-label"
          style={{ height: cellSize }}
        >
          {y + 1}
        </div>
      );
    }
    // If fractional edge at start (bottom), add fractional row label last (at bottom)
    if (hasFractionalDepth && fractionalEdgeY === 'start') {
      labels.push(
        <div
          key="row-frac"
          className="print-axis-label print-row-label"
          style={{ height: fractionalCellHeight }}
        >
          .5
        </div>
      );
    }
    return labels;
  }, [integerDepth, hasFractionalDepth, fractionalEdgeY, fractionalCellHeight, cellSize]);

  // Group bins by category for summary
  const binsByCategory = useMemo(() => {
    const grouped = new Map<string, number>();
    allVisibleBins.forEach((bin) => {
      const count = grouped.get(bin.category) ?? 0;
      grouped.set(bin.category, count + 1);
    });
    return grouped;
  }, [allVisibleBins]);

  // Sort bins based on user-configured sort order
  const sortedBins = useMemo(
    () => sortBinsForPrint(allVisibleBins, settings.binListSortOrder, categories, layers),
    [allVisibleBins, settings.binListSortOrder, categories, layers]
  );

  // No bins to print - early return AFTER all hooks
  if (allVisibleBins.length === 0) {
    return (
      <div className="print-empty-state">
        <svg
          className="print-empty-state-icon"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
        <p>{t('print.noBinsToPrintInSelectedLayerS')}</p>
      </div>
    );
  }

  // Render a single layer's grid
  const renderLayerGrid = (layer: Layer) => {
    const layerBins = allVisibleBins.filter((bin) => bin.layerId === layer.id);
    if (layerBins.length === 0) return null;

    return (
      <div key={layer.id} className="print-grid-with-labels">
        <div className="print-grid-row">
          {/* Row labels */}
          {settings.showGridCoordinates && (
            <div className="print-row-labels" style={{ gap: `${gap}px` }}>
              {rowLabels}
            </div>
          )}
          {/* Grid */}
          <div
            className="print-grid"
            style={{
              display: 'grid',
              gridTemplateColumns,
              gridTemplateRows,
              gap: `${gap}px`,
            }}
          >
            {cells}
            {layerBins.map((bin) => {
              const category = categories.find((c) => c.id === bin.category);
              return (
                <PrintBin
                  key={bin.id}
                  bin={bin}
                  category={category}
                  drawer={drawer}
                  cellSize={cellSize}
                  gap={gap}
                  settings={settings}
                />
              );
            })}
          </div>
        </div>
        {/* Column labels - at bottom like 2D grid */}
        {settings.showGridCoordinates && (
          <div
            className="print-col-labels"
            style={{ marginLeft: ROW_LABELS_WIDTH, gap: `${gap}px` }}
          >
            {columnLabels}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="print-layout-content">
      {/* Header */}
      {settings.showHeader && (
        <div className="print-header">
          <div className="print-header-top">
            {settings.showLayoutName && <h1>{layout.name}</h1>}
            {settings.showDate && <span className="print-header-date">{formatPrintDate()}</span>}
          </div>
          {settings.showDrawerInfo && (
            <div className="print-header-info">
              <div className="print-header-group">
                <span className="print-header-label">{t('print.drawer')}</span>
                <span className="print-header-value">
                  {formatDrawerDimensions(drawer, layout.gridUnitMm)}
                </span>
              </div>
              <div className="print-header-group">
                <span className="print-header-label">{t('common.height')}</span>
                <span className="print-header-value">
                  {t('print.heightValue', {
                    height: drawer.height,
                    mm: drawer.height * layout.heightUnitMm,
                  })}
                </span>
              </div>
              <div className="print-header-group">
                <span className="print-header-label">{t('print.bins')}</span>
                <span className="print-header-value">{allVisibleBins.length}</span>
              </div>
              <div className="print-header-group">
                <span className="print-header-label">{t('common.layers')}</span>
                <span className="print-header-value">
                  {visibleLayers.length === layers.length
                    ? t('print.allLayers', { count: layers.length })
                    : visibleLayers.map((l) => l.name).join(LIST_SEPARATOR)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid(s) - one per layer if multiple selected */}
      {visibleLayers.length === 1 ? (
        <div className="print-grid-container">{renderLayerGrid(visibleLayers[0])}</div>
      ) : (
        visibleLayers.map((layer) => (
          <div key={layer.id} className="print-grid-container">
            <div className="print-layer-header">{layer.name}</div>
            {renderLayerGrid(layer)}
          </div>
        ))
      )}

      {/* Category Legend with Counts */}
      {settings.showLegend && usedCategories.length > 0 && (
        <div className="print-legend">
          <div className="print-legend-title">{t('common.categories')}</div>
          <div className="print-legend-items">
            {usedCategories.map((category) => {
              const count = binsByCategory.get(category.id) ?? 0;
              return (
                <div key={category.id} className="print-legend-item">
                  <div className="print-legend-color" style={{ backgroundColor: category.color }} />
                  <span>{category.name}</span>
                  <span className="print-legend-count">{t('print.countParens', { count })}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bin List Table */}
      {settings.showBinList &&
        sortedBins.length > 0 &&
        (() => {
          // Check if any bins have custom properties
          const hasAnyCustomProps = sortedBins.some(
            (bin) => bin.customProperties && Object.keys(bin.customProperties).length > 0
          );
          // Check if any bins have notes
          const hasAnyNotes = sortedBins.some((bin) => bin.notes);

          return (
            <div className="print-bin-list">
              <div className="print-bin-list-title">{t('print.binDetails')}</div>
              <table className="print-bin-table">
                <thead>
                  <tr>
                    <th>{t('common.label')}</th>
                    <th>{t('common.size')}</th>
                    <th>{t('common.height')}</th>
                    <th>{t('common.category')}</th>
                    {visibleLayers.length > 1 && <th>{t('print.layer')}</th>}
                    <th>{t('print.position')}</th>
                    {hasAnyNotes && <th>{t('common.notes')}</th>}
                    {hasAnyCustomProps && <th>{t('print.customProperties')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {sortedBins.map((bin) => {
                    const category = categories.find((c) => c.id === bin.category);
                    const layer = layers.find((l) => l.id === bin.layerId);
                    const customProps = bin.customProperties || {};
                    const customPropEntries = Object.entries(customProps);
                    return (
                      <tr key={bin.id}>
                        <td className="print-bin-table-label">
                          {bin.label || <span className="print-bin-table-empty">—</span>}
                        </td>
                        <td>
                          {bin.width}×{bin.depth}
                        </td>
                        <td>{bin.height}u</td>
                        <td>
                          {settings.showCategoryColor && category && (
                            <span
                              className="print-bin-table-category-dot"
                              style={{ backgroundColor: category.color }}
                            />
                          )}
                          {category?.name || '—'}
                        </td>
                        {visibleLayers.length > 1 && <td>{layer?.name || '—'}</td>}
                        <td>{t('print.coordinates', { x: bin.x + 1, y: bin.y + 1 })}</td>
                        {hasAnyNotes && (
                          <td className="print-bin-table-notes">
                            {bin.notes || <span className="print-bin-table-empty">—</span>}
                          </td>
                        )}
                        {hasAnyCustomProps && (
                          <td className="print-bin-table-custom-props">
                            {customPropEntries.length > 0 ? (
                              customPropEntries.map(([key, value]) => (
                                <div key={key} className="print-bin-table-prop">
                                  <span className="print-bin-table-prop-key">
                                    {t('print.propEntry', { key, value })}
                                  </span>
                                </div>
                              ))
                            ) : (
                              <span className="print-bin-table-empty">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
    </div>
  );
}
