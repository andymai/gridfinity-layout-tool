import { STAGING_ID, CONSTRAINTS, DEFAULT_CATEGORY_COLOR } from '../../constants';
import { useUIStore } from '../../store';
import type { UseBinInspectorReturn } from './useBinInspector';
import { SplitWarning } from './SplitWarning';

interface SingleBinInspectorProps {
  inspector: UseBinInspectorReturn;
  /** Platform variant affects touch targets and sizing */
  variant: 'desktop' | 'mobile';
  /** Optional: callback when close button is clicked */
  onClose?: () => void;
}

/**
 * Single bin property editor.
 * Matches original RightPanel design with separate inputs.
 */
export function SingleBinInspector({
  inspector,
  variant,
  onClose,
}: SingleBinInspectorProps) {
  const {
    bin,
    category,
    constraints,
    layout,
    categories,
    updateField,
    requestDelete,
    moveToStaging,
    clearSelection,
  } = inspector;

  const halfBinMode = useUIStore(state => state.halfBinMode);

  if (!bin) return null;

  const isMobile = variant === 'mobile';
  const canMoveToStaging = bin.layerId !== STAGING_ID;

  // Format dimensions - show decimal if fractional (half-bin mode)
  const formatDim = (val: number) => val % 1 === 0 ? val.toString() : val.toFixed(1);
  const minSize = halfBinMode ? 0.5 : 1;
  const stepSize = halfBinMode ? 0.5 : 1;

  // Button sizing for mobile vs desktop
  const btnSize = isMobile ? 'w-12 h-12' : 'w-10 h-10';
  const btnMinSize = isMobile ? 'min-w-[48px] min-h-[48px]' : 'min-w-[40px] min-h-[40px]';
  const inputHeight = isMobile ? 'h-12' : '';
  const labelSize = isMobile ? 'text-sm mb-2' : 'text-xs mb-1';
  const valueSize = isMobile ? 'text-xl' : 'text-lg';

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-5 h-5 rounded flex-shrink-0 shadow-sm"
          style={{ backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR }}
          aria-hidden="true"
        />
        <h2 className="flex-1 text-lg font-semibold text-content">
          {formatDim(bin.width)}×{formatDim(bin.depth)} Bin
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose || clearSelection}
            className="btn btn-ghost w-7 h-7 p-0 min-w-0 min-h-0"
            aria-label="Deselect bin"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Size inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={`block ${labelSize} text-content-tertiary`}>
              Width
            </label>
            <input
              type="number"
              value={bin.width}
              onChange={(e) => updateField('width', e.target.value)}
              className={`input w-full ${inputHeight}`}
              min={minSize}
              step={stepSize}
              aria-label="Bin width"
            />
          </div>
          <div>
            <label className={`block ${labelSize} text-content-tertiary`}>
              Depth
            </label>
            <input
              type="number"
              value={bin.depth}
              onChange={(e) => updateField('depth', e.target.value)}
              className={`input w-full ${inputHeight}`}
              min={minSize}
              step={stepSize}
              aria-label="Bin depth"
            />
          </div>
        </div>

        {/* Real-world dimensions */}
        <div className="px-3 py-2 bg-surface-secondary rounded-md">
          <div className="text-xs text-content-tertiary mb-1">Real dimensions</div>
          <div className="text-sm text-content-secondary">
            {(bin.width * layout.gridUnitMm).toFixed(0)} × {(bin.depth * layout.gridUnitMm).toFixed(0)} × {(bin.height * layout.heightUnitMm).toFixed(0)} mm
          </div>
        </div>

        {/* Height control with +/- buttons */}
        <div>
          <label className={`block ${labelSize} text-content-tertiary`}>
            Height
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => updateField('height', bin.height - 1)}
              disabled={bin.height <= constraints.minHeight}
              className={`btn btn-secondary ${btnSize} p-0 ${btnMinSize}`}
              aria-label="Decrease height"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span className={`flex-1 text-center font-semibold ${valueSize} text-content`}>
              {bin.height}u
            </span>
            <button
              type="button"
              onClick={() => updateField('height', bin.height + 1)}
              disabled={bin.height >= constraints.maxHeight}
              className={`btn btn-secondary ${btnSize} p-0 ${btnMinSize}`}
              aria-label="Increase height"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <div className="text-center mt-1 text-xs text-content-disabled">
            Range: {constraints.heightRange}
          </div>
        </div>

        {/* Clearance control */}
        {constraints.maxClearance > 0 && (
          <div>
            <label
              className={`block ${labelSize} text-content-tertiary`}
              title="Extra blocked space above this bin for tall contents (e.g., scissors, tools)"
            >
              Clearance
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateField('clearanceHeight', (bin.clearanceHeight || 0) - 1)}
                disabled={(bin.clearanceHeight || 0) <= 0}
                className={`btn btn-secondary ${btnSize} p-0 ${btnMinSize}`}
                aria-label="Decrease clearance"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                </svg>
              </button>
              <span className={`flex-1 text-center font-semibold ${valueSize} text-content`}>
                {bin.clearanceHeight || 0}u
              </span>
              <button
                type="button"
                onClick={() => updateField('clearanceHeight', (bin.clearanceHeight || 0) + 1)}
                disabled={(bin.clearanceHeight || 0) >= constraints.maxClearance}
                className={`btn btn-secondary ${btnSize} p-0 ${btnMinSize}`}
                aria-label="Increase clearance"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <div className="text-center mt-1 text-xs text-content-disabled">
              Blocks {bin.clearanceHeight || 0}u above bin
            </div>
          </div>
        )}

        {/* Split warning with print bed visualization */}
        <SplitWarning
          binWidth={bin.width}
          binDepth={bin.depth}
          maxGridUnits={constraints.maxGridUnits}
          gridUnitMm={layout.gridUnitMm}
          printBedSize={layout.printBedSize}
          compact={isMobile}
        />

        {/* Category */}
        <div>
          <label className={`block ${labelSize} text-content-tertiary`}>
            Category
          </label>
          <div className="relative">
            <div
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded pointer-events-none"
              style={{ backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR }}
            />
            <select
              value={bin.category}
              onChange={(e) => updateField('category', e.target.value)}
              className={`input w-full pl-8 pr-8 appearance-none ${inputHeight}`}
              aria-label="Bin category"
            >
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

        {/* Label */}
        <div>
          <label className={`block ${labelSize} text-content-tertiary`}>
            Label
          </label>
          <input
            type="text"
            value={bin.label}
            onChange={(e) => updateField('label', e.target.value.slice(0, CONSTRAINTS.LABEL_MAX_LENGTH))}
            className={`input w-full ${inputHeight}`}
            placeholder="Optional label"
            aria-label="Bin label"
          />
        </div>

        {/* Notes */}
        <div>
          <label className={`block ${labelSize} text-content-tertiary`}>
            Notes
          </label>
          <textarea
            value={bin.notes}
            onChange={(e) => updateField('notes', e.target.value.slice(0, CONSTRAINTS.NOTES_MAX_LENGTH))}
            className="input w-full"
            placeholder="e.g., 2 dividers, STL link, contents"
            aria-label="Bin notes"
            rows={3}
            style={{ resize: 'vertical', minHeight: '60px' }}
          />
          <div className="text-right mt-1 text-[10px] text-content-disabled">
            {bin.notes.length}/{CONSTRAINTS.NOTES_MAX_LENGTH}
          </div>
        </div>

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
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
