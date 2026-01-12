import { STAGING_ID, DEFAULT_CATEGORY_COLOR } from '../../constants';
import type { UseBinInspectorReturn } from './useBinInspector';
import type { Layer } from '../../types';

interface MultiBinInspectorProps {
  inspector: UseBinInspectorReturn;
  /** Platform variant affects touch targets and sizing */
  variant: 'desktop' | 'mobile';
  /** Optional: callback when close button is clicked */
  onClose?: () => void;
}

/**
 * Multi-selection bin editor.
 * Shows aggregate info and bulk edit controls.
 */
export function MultiBinInspector({
  inspector,
  variant,
  onClose,
}: MultiBinInspectorProps) {
  const {
    selectedBins,
    categories,
    layout,
    updateMultiCategory,
    updateMultiHeight,
    updateMultiClearance,
    updateMultiLayer,
    requestDelete,
    moveToStaging,
    clearSelection,
  } = inspector;

  if (selectedBins.length === 0) return null;

  const isMobile = variant === 'mobile';

  // Button sizing for mobile vs desktop
  const btnSize = isMobile ? 'w-12 h-12' : 'w-10 h-10';
  const btnMinSize = isMobile ? 'min-w-[48px] min-h-[48px]' : 'min-w-[40px] min-h-[40px]';
  const inputHeight = isMobile ? 'h-12' : '';
  const labelSize = isMobile ? 'text-sm mb-2' : 'text-xs mb-1';
  const valueSize = isMobile ? 'text-xl' : 'text-lg';

  // Check if all bins have the same category
  const commonCategory = selectedBins.every((b) => b.category === selectedBins[0]?.category)
    ? selectedBins[0]?.category
    : null;

  // Get category breakdown for mixed label
  const getMixedLabel = () => {
    const counts = new Map<string, number>();
    for (const b of selectedBins) {
      counts.set(b.category, (counts.get(b.category) || 0) + 1);
    }
    const parts: string[] = [];
    counts.forEach((count, catId) => {
      const cat = categories.find((c) => c.id === catId);
      parts.push(`${count} ${cat?.name || 'Unknown'}`);
    });
    return parts.slice(0, 3).join(', ') + (parts.length > 3 ? '...' : '');
  };

  // Check if all bins have the same height
  const heights = selectedBins.map((b) => b.height);
  const minHeight = Math.min(...heights);
  const maxHeight = Math.max(...heights);
  const sameHeight = minHeight === maxHeight;

  // Check clearance values
  const clearances = selectedBins.map((b) => b.clearanceHeight || 0);
  const minClearance = Math.min(...clearances);
  const maxClearance = Math.max(...clearances);
  const sameClearance = minClearance === maxClearance;
  const anyClearance = maxClearance > 0;

  // Check if any bins can be moved to staging
  const canMoveToStaging = selectedBins.some((b) => b.layerId !== STAGING_ID);

  // Check if all bins are on the same layer
  const gridBins = selectedBins.filter((b) => b.layerId !== STAGING_ID);
  const commonLayer: Layer | null = gridBins.length > 0 && gridBins.every((b) => b.layerId === gridBins[0]?.layerId)
    ? layout.layers.find((l) => l.id === gridBins[0]?.layerId) ?? null
    : null;

  // Get layer breakdown for mixed label
  const getMixedLayerLabel = () => {
    const counts = new Map<string, number>();
    for (const b of gridBins) {
      counts.set(b.layerId, (counts.get(b.layerId) || 0) + 1);
    }
    const parts: string[] = [];
    counts.forEach((count, layerId) => {
      const layer = layout.layers.find((l) => l.id === layerId);
      parts.push(`${count} on ${layer?.name || 'Unknown'}`);
    });
    return parts.slice(0, 2).join(', ') + (parts.length > 2 ? '...' : '');
  };

  // Get category color for swatch
  const categoryColor = commonCategory
    ? layout.categories.find((c) => c.id === commonCategory)?.color || DEFAULT_CATEGORY_COLOR
    : null;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center bg-accent shadow-sm"
          aria-hidden="true"
        >
          <span className="text-[10px] font-bold text-black">{selectedBins.length}</span>
        </div>
        <h2 className="flex-1 text-lg font-semibold text-content">
          Bins Selected
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose || clearSelection}
            className="btn btn-ghost w-7 h-7 p-0 min-w-0 min-h-0"
            aria-label="Deselect all bins"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <p className={`${isMobile ? 'text-base' : 'text-sm'} text-content-secondary mb-4`}>
        Drag to move together, or use arrow keys to nudge.
      </p>

      <div className="space-y-3">
        {/* Category */}
        <div>
          <label className={`block ${labelSize} text-content-tertiary`}>
            Category
          </label>
          <div className="relative">
            {categoryColor ? (
              <div
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded pointer-events-none"
                style={{ backgroundColor: categoryColor }}
              />
            ) : (
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded pointer-events-none bg-surface-hover border border-stroke-subtle" />
            )}
            <select
              value={commonCategory || ''}
              onChange={(e) => updateMultiCategory(e.target.value)}
              className={`input w-full pl-8 pr-8 appearance-none ${inputHeight}`}
              aria-label="Category for selected bins"
            >
              {!commonCategory && (
                <option value="" disabled>
                  {getMixedLabel()}
                </option>
              )}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <svg
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-content-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {/* Layer - only show when there are bins on grid and multiple layers */}
        {gridBins.length > 0 && layout.layers.length > 1 && (
          <div>
            <label className={`block ${labelSize} text-content-tertiary`}>
              Layer
            </label>
            <div className="relative">
              <select
                value={commonLayer?.id || ''}
                onChange={(e) => updateMultiLayer(e.target.value)}
                className={`input w-full pr-8 appearance-none ${inputHeight}`}
                aria-label="Layer for selected bins"
              >
                {!commonLayer && (
                  <option value="" disabled>
                    {getMixedLayerLabel()}
                  </option>
                )}
                {layout.layers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}{l.id === commonLayer?.id ? ' (current)' : ''}
                  </option>
                ))}
              </select>
              <svg
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-content-tertiary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}

        {/* Height control */}
        <div>
          <label className={`block ${labelSize} text-content-tertiary`}>
            Height
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateMultiHeight(-1)}
              className={`btn btn-secondary ${btnSize} p-0 ${btnMinSize}`}
              aria-label="Decrease height for all bins"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className={`flex-1 text-center font-semibold ${valueSize} text-content`}>
              {sameHeight ? `${minHeight}u` : `${minHeight}–${maxHeight}u`}
            </span>
            <button
              type="button"
              onClick={() => updateMultiHeight(1)}
              className={`btn btn-secondary ${btnSize} p-0 ${btnMinSize}`}
              aria-label="Increase height for all bins"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>

        {/* Clearance control - show if any bin has clearance or if user might want to add it */}
        {anyClearance && (
          <div>
            <label
              className={`block ${labelSize} text-content-tertiary`}
              title="Extra blocked space above bins for tall contents"
            >
              Clearance
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateMultiClearance(-1)}
                disabled={maxClearance <= 0}
                className={`btn btn-secondary ${btnSize} p-0 ${btnMinSize}`}
                aria-label="Decrease clearance for all bins"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className={`flex-1 text-center font-semibold ${valueSize} text-content`}>
                {sameClearance ? `${minClearance}u` : `${minClearance}–${maxClearance}u`}
              </span>
              <button
                type="button"
                onClick={() => updateMultiClearance(1)}
                className={`btn btn-secondary ${btnSize} p-0 ${btnMinSize}`}
                aria-label="Increase clearance for all bins"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {canMoveToStaging && (
            <button
              type="button"
              onClick={moveToStaging}
              className={`btn btn-secondary flex-1 ${isMobile ? 'h-12' : ''}`}
            >
              To Stash
            </button>
          )}
          <button
            type="button"
            onClick={requestDelete}
            className={`btn btn-danger flex-1 ${isMobile ? 'h-12' : ''}`}
          >
            Delete All
          </button>
        </div>
      </div>
    </div>
  );
}
