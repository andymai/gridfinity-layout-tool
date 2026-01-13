import { useMemo, useCallback } from 'react';
import { useSandboxState, DEFAULT_SANDBOX_CATEGORIES } from '../hooks/useSandboxState';
import type { SandboxBin, SandboxCategory } from '../hooks/useSandboxState';
import { SandboxGrid } from './SandboxGrid';

/**
 * Features that can be enabled/disabled in the sandbox.
 */
interface SandboxFeatures {
  canDraw: boolean;
  canDrag: boolean;
  canResize: boolean;
  canDelete: boolean;
  canChangeCategory: boolean;
}

/**
 * Props for InteractiveSandbox component.
 */
interface InteractiveSandboxProps {
  /** Drawer width in grid units */
  width?: number;
  /** Drawer depth in grid units */
  depth?: number;
  /** Initial bins to populate */
  initialBins?: SandboxBin[];
  /** Available categories */
  categories?: SandboxCategory[];
  /** Which interactions are enabled */
  features?: Partial<SandboxFeatures>;
  /** Cell size in pixels */
  cellSize?: number;
  /** Gap between cells in pixels */
  gap?: number;
  /** Cells to highlight (for tutorials) */
  highlightCells?: Array<[number, number]>;
  /** Called when a bin is created */
  onBinCreated?: (binId: string) => void;
  /** Called when selection changes */
  onBinSelected?: (binId: string | null) => void;
  /** Called when a bin is deleted */
  onBinDeleted?: (binId: string) => void;
  /** Called when a bin is updated */
  onBinUpdated?: (binId: string) => void;
  /** Called on any state change (for validation) */
  onStateChange?: (bins: SandboxBin[], selectedBinId: string | null) => void;
}

const DEFAULT_FEATURES: SandboxFeatures = {
  canDraw: true,
  canDrag: true,
  canResize: true,
  canDelete: true,
  canChangeCategory: true,
};

/**
 * Interactive sandbox for guide lessons.
 * Provides an isolated grid environment with configurable interactions.
 */
export function InteractiveSandbox({
  width = 6,
  depth = 6,
  initialBins = [],
  categories = DEFAULT_SANDBOX_CATEGORIES,
  features = {},
  cellSize = 40,
  gap = 2,
  highlightCells = [],
  onBinCreated,
  onBinSelected,
  onBinDeleted,
  onBinUpdated: _onBinUpdated,
  onStateChange,
}: InteractiveSandboxProps) {
  // Merge features with defaults
  const mergedFeatures = useMemo(
    () => ({ ...DEFAULT_FEATURES, ...features }),
    [features]
  );

  // Initialize sandbox state
  const state = useSandboxState({
    width,
    depth,
    initialBins,
    categories,
  });

  // Wrap callbacks to trigger state change notification
  const handleBinCreated = useCallback(
    (binId: string) => {
      onBinCreated?.(binId);
      onStateChange?.(state.bins, state.selectedBinId);
    },
    [onBinCreated, onStateChange, state.bins, state.selectedBinId]
  );

  const handleBinSelected = useCallback(
    (binId: string | null) => {
      onBinSelected?.(binId);
      onStateChange?.(state.bins, binId);
    },
    [onBinSelected, onStateChange, state.bins]
  );

  const handleBinDeleted = useCallback(
    (binId: string) => {
      onBinDeleted?.(binId);
      // State will update after deletion, need to filter
      const remainingBins = state.bins.filter((b) => b.id !== binId);
      onStateChange?.(remainingBins, state.selectedBinId === binId ? null : state.selectedBinId);
    },
    [onBinDeleted, onStateChange, state.bins, state.selectedBinId]
  );

  return (
    <div className="flex flex-col gap-4" data-testid="interactive-sandbox">
      {/* Category selector (if enabled) */}
      {mergedFeatures.canChangeCategory && categories.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => state.setActiveCategory(category.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                state.activeCategory === category.id
                  ? 'ring-2 ring-offset-2 ring-offset-surface ring-white/50 shadow-md'
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={{
                backgroundColor: category.color,
                color: '#fff',
              }}
              aria-pressed={state.activeCategory === category.id}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <SandboxGrid
        state={state}
        cellSize={cellSize}
        gap={gap}
        canDraw={mergedFeatures.canDraw}
        canDrag={mergedFeatures.canDrag}
        canResize={mergedFeatures.canResize}
        canDelete={mergedFeatures.canDelete}
        highlightCells={highlightCells}
        onBinCreated={handleBinCreated}
        onBinSelected={handleBinSelected}
        onBinDeleted={handleBinDeleted}
      />

      {/* Controls row */}
      <div className="flex gap-2 items-center justify-between text-sm">
        <div className="text-content-secondary">
          {state.bins.length} bin{state.bins.length !== 1 ? 's' : ''}
          {state.selectedBinId && ' • 1 selected'}
        </div>

        <div className="flex gap-2">
          {/* Delete button (if a bin is selected and deletion is enabled) */}
          {mergedFeatures.canDelete && state.selectedBinId && (
            <button
              onClick={() => {
                if (state.selectedBinId) {
                  state.deleteBin(state.selectedBinId);
                  handleBinDeleted(state.selectedBinId);
                }
              }}
              className="px-3 py-1.5 text-sm bg-error/10 text-error hover:bg-error/20 rounded-lg transition-colors"
            >
              Delete
            </button>
          )}

          {/* Reset button */}
          <button
            onClick={() => {
              state.resetBins();
              onStateChange?.(initialBins, null);
            }}
            className="px-3 py-1.5 text-sm text-content-secondary hover:text-content hover:bg-surface-elevated rounded-lg transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export type { InteractiveSandboxProps, SandboxFeatures };
