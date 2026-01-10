import { useState, useCallback, useMemo } from 'react';
import { useLayoutStore, useUndoableAction } from '../store';
import { useShallow } from 'zustand/shallow';
import { CONSTRAINTS } from '../constants';

interface CalculatedDimensions {
  width: number;
  depth: number;
  height: number;
  actualWidthMm: number;
  actualDepthMm: number;
  actualHeightMm: number;
}

interface DrawerDimensionCalculatorProps {
  /** Compact variant for mobile/tight spaces */
  compact?: boolean;
}

/**
 * Calculator that converts real drawer dimensions (mm) to grid units.
 * Shows users exactly how many grid units will fit and the actual usable space.
 */
export function DrawerDimensionCalculator({ compact = false }: DrawerDimensionCalculatorProps) {
  const { gridUnitMm, heightUnitMm, drawerWidth, drawerDepth, drawerHeight, updateDrawer } = useLayoutStore(
    useShallow((state) => ({
      gridUnitMm: state.layout.gridUnitMm,
      heightUnitMm: state.layout.heightUnitMm,
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      drawerHeight: state.layout.drawer.height,
      updateDrawer: state.updateDrawer,
    }))
  );

  const { execute } = useUndoableAction();

  // Current dimensions in mm (used as placeholders)
  const currentWidthMm = drawerWidth * gridUnitMm;
  const currentDepthMm = drawerDepth * gridUnitMm;
  const currentHeightMm = drawerHeight * heightUnitMm;

  // Input state for mm dimensions
  const [widthMm, setWidthMm] = useState('');
  const [depthMm, setDepthMm] = useState('');
  const [heightMm, setHeightMm] = useState('');

  // Calculate grid units from mm inputs
  const calculated = useMemo((): CalculatedDimensions | null => {
    const w = parseFloat(widthMm);
    const d = parseFloat(depthMm);
    const h = parseFloat(heightMm);

    // Need at least width and depth for a valid calculation
    if (isNaN(w) || isNaN(d) || w <= 0 || d <= 0) {
      return null;
    }

    const widthUnits = Math.floor(w / gridUnitMm);
    const depthUnits = Math.floor(d / gridUnitMm);
    const heightUnits = !isNaN(h) && h > 0 ? Math.floor(h / heightUnitMm) : 0;

    // Clamp to valid ranges
    const clampedWidth = Math.max(CONSTRAINTS.GRID_MIN, Math.min(CONSTRAINTS.GRID_MAX, widthUnits));
    const clampedDepth = Math.max(CONSTRAINTS.GRID_MIN, Math.min(CONSTRAINTS.GRID_MAX, depthUnits));
    const clampedHeight = heightUnits > 0 ? Math.max(1, heightUnits) : 0;

    return {
      width: clampedWidth,
      depth: clampedDepth,
      height: clampedHeight,
      actualWidthMm: clampedWidth * gridUnitMm,
      actualDepthMm: clampedDepth * gridUnitMm,
      actualHeightMm: clampedHeight * heightUnitMm,
    };
  }, [widthMm, depthMm, heightMm, gridUnitMm, heightUnitMm]);

  const handleApply = useCallback(() => {
    if (!calculated) return;

    execute(() => {
      updateDrawer({
        width: calculated.width,
        depth: calculated.depth,
        ...(calculated.height > 0 ? { height: calculated.height } : {}),
      });
    });

    // Clear inputs after applying
    setWidthMm('');
    setDepthMm('');
    setHeightMm('');
  }, [calculated, execute, updateDrawer]);

  const handleInputChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && calculated) {
      handleApply();
    }
  };

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-xs mb-1 text-content-tertiary">
              Width (mm)
            </label>
            <input
              type="number"
              value={widthMm}
              onChange={handleInputChange(setWidthMm)}
              onKeyDown={handleKeyDown}
              placeholder={String(currentWidthMm)}
              className="input w-full h-10 text-center text-sm"
              min={1}
            />
          </div>
          <div>
            <label className="block text-xs mb-1 text-content-tertiary">
              Depth (mm)
            </label>
            <input
              type="number"
              value={depthMm}
              onChange={handleInputChange(setDepthMm)}
              onKeyDown={handleKeyDown}
              placeholder={String(currentDepthMm)}
              className="input w-full h-10 text-center text-sm"
              min={1}
            />
          </div>
          <div>
            <label className="block text-xs mb-1 text-content-tertiary">
              Height (mm)
            </label>
            <input
              type="number"
              value={heightMm}
              onChange={handleInputChange(setHeightMm)}
              onKeyDown={handleKeyDown}
              placeholder={String(currentHeightMm)}
              className="input w-full h-10 text-center text-sm"
              min={1}
            />
          </div>
        </div>

        {calculated && (
          <div className="bg-surface-elevated rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-content-secondary">Result:</span>
              <span className="font-semibold text-content">
                {calculated.width} × {calculated.depth}
                {calculated.height > 0 && ` × ${calculated.height}u`}
              </span>
            </div>
            <div className="text-xs text-content-tertiary mb-3">
              Actual: {calculated.actualWidthMm} × {calculated.actualDepthMm}
              {calculated.height > 0 && ` × ${calculated.actualHeightMm}`} mm
            </div>
            <button
              onClick={handleApply}
              className="btn btn-primary w-full h-10"
            >
              Apply Dimensions
            </button>
          </div>
        )}
      </div>
    );
  }

  // Desktop/expanded variant
  return (
    <div className="space-y-2">
      <div className="text-[10px] text-content-disabled mb-2">
        Enter your drawer's inner dimensions (current: {currentWidthMm}×{currentDepthMm}×{currentHeightMm}mm)
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <label className="text-xs text-content-tertiary w-12">Width</label>
          <input
            type="number"
            value={widthMm}
            onChange={handleInputChange(setWidthMm)}
            onKeyDown={handleKeyDown}
            placeholder={String(currentWidthMm)}
            className="input flex-1 py-0.5 px-1.5 text-xs text-right"
            min={1}
          />
          <span className="text-xs text-content-tertiary w-6">mm</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-content-tertiary w-12">Depth</label>
          <input
            type="number"
            value={depthMm}
            onChange={handleInputChange(setDepthMm)}
            onKeyDown={handleKeyDown}
            placeholder={String(currentDepthMm)}
            className="input flex-1 py-0.5 px-1.5 text-xs text-right"
            min={1}
          />
          <span className="text-xs text-content-tertiary w-6">mm</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-content-tertiary w-12">Height</label>
          <input
            type="number"
            value={heightMm}
            onChange={handleInputChange(setHeightMm)}
            onKeyDown={handleKeyDown}
            placeholder={String(currentHeightMm)}
            className="input flex-1 py-0.5 px-1.5 text-xs text-right"
            min={1}
          />
          <span className="text-xs text-content-tertiary w-6">mm</span>
        </div>
      </div>

      {calculated && (
        <div className="bg-surface-elevated rounded p-2 mt-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-content-tertiary">Grid units:</span>
            <span className="font-medium text-content tabular-nums">
              {calculated.width} × {calculated.depth}
              {calculated.height > 0 && (
                <span className="text-content-secondary"> × {calculated.height}u</span>
              )}
            </span>
          </div>
          <div className="flex items-center justify-between text-[10px] text-content-disabled mt-0.5">
            <span>Actual size:</span>
            <span className="tabular-nums">
              {calculated.actualWidthMm} × {calculated.actualDepthMm}
              {calculated.height > 0 && ` × ${calculated.actualHeightMm}`} mm
            </span>
          </div>
          <button
            onClick={handleApply}
            className="btn btn-primary w-full mt-2 py-1 text-xs"
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
}
