import { CONSTRAINTS, DEFAULT_CATEGORY_COLOR, STAGING_ID } from '../../constants';
import { useUIStore } from '../../store';
import { getBinLocationContext } from '../../utils/binLocation';
import type { UseBinInspectorReturn } from './useBinInspector';
import { SplitWarning } from './SplitWarning';
import { DeferredNumberInput } from '../DeferredNumberInput';
import { CustomPropertiesEditor } from './CustomPropertiesEditor';
import { STLSearchDropdown } from '../STLSearchDropdown';

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
    layer,
    constraints,
    layout,
    categories,
    updateField,
    updateCustomProperties,
    moveToLayer,
    requestDelete,
    moveToStaging,
    clearSelection,
    rotateBin,
    existingPropertyKeys,
  } = inspector;

  const halfBinMode = useUIStore(state => state.halfBinMode);

  if (!bin) return null;

  const isMobile = variant === 'mobile';
  const locationContext = getBinLocationContext(bin);
  const canMoveToStaging = locationContext.canMoveToStash;

  // Format dimensions - show decimal if fractional (half-bin mode)
  const formatDim = (val: number) => val % 1 === 0 ? val.toString() : val.toFixed(1);
  const minSize = halfBinMode ? 0.5 : 1;
  const stepSize = halfBinMode ? 0.5 : 1;

  // Sizing for mobile vs desktop
  const inputHeight = isMobile ? 'h-12' : '';
  const stepperHeight = isMobile ? 'h-12' : 'h-8';
  const labelSize = isMobile ? 'text-sm mb-2' : 'text-xs mb-1';

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
        {/* Size inputs with flip button between */}
        <div className="flex items-end gap-2">
          {/* Width control */}
          <div className="flex-1">
            <label className={`block ${labelSize} text-content-tertiary`}>
              Width
            </label>
            <div className={`flex items-center ${stepperHeight}`}>
              <button
                type="button"
                onClick={() => updateField('width', bin.width - stepSize)}
                disabled={bin.width <= minSize}
                className={isMobile
                  ? "btn btn-secondary w-12 h-12 p-0 rounded-r-none"
                  : "h-full px-2 rounded-l border border-r-0 border-stroke-subtle bg-surface-elevated text-content-tertiary hover:text-content hover:bg-surface-hover disabled:opacity-30 transition-colors"
                }
                aria-label="Decrease width"
              >
                <svg className={isMobile ? "w-5 h-5" : "w-3 h-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isMobile ? 2 : 2.5}>
                  <path strokeLinecap="round" d="M20 12H4" />
                </svg>
              </button>
              <DeferredNumberInput
                value={bin.width}
                onChange={(val) => updateField('width', val)}
                min={minSize}
                max={layout.drawer.width}
                step={stepSize}
                className={isMobile
                  ? "input flex-1 h-12 text-center font-semibold tabular-nums border-x-0 rounded-none"
                  : "input flex-1 h-full text-center font-medium tabular-nums border-x-0 rounded-none text-sm"
                }
                aria-label="Bin width"
              />
              <button
                type="button"
                onClick={() => updateField('width', bin.width + stepSize)}
                disabled={bin.width >= layout.drawer.width}
                className={isMobile
                  ? "btn btn-secondary w-12 h-12 p-0 rounded-l-none"
                  : "h-full px-2 rounded-r border border-l-0 border-stroke-subtle bg-surface-elevated text-content-tertiary hover:text-content hover:bg-surface-hover disabled:opacity-30 transition-colors"
                }
                aria-label="Increase width"
              >
                <svg className={isMobile ? "w-5 h-5" : "w-3 h-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isMobile ? 2 : 2.5}>
                  <path strokeLinecap="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          {/* Flip button */}
          <button
            type="button"
            onClick={rotateBin}
            className={isMobile
              ? "btn btn-secondary w-12 h-12 p-0 flex-shrink-0"
              : "flex-shrink-0 h-8 w-8 flex items-center justify-center rounded border border-stroke-subtle bg-surface-elevated text-content-tertiary hover:text-content hover:bg-surface-hover transition-colors"
            }
            title="Swap width ↔ depth (R)"
            aria-label="Swap width and depth"
          >
            <svg className={isMobile ? "w-5 h-5" : "w-3 h-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isMobile ? 2 : 2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>

          {/* Depth control */}
          <div className="flex-1">
            <label className={`block ${labelSize} text-content-tertiary`}>
              Depth
            </label>
            <div className={`flex items-center ${stepperHeight}`}>
              <button
                type="button"
                onClick={() => updateField('depth', bin.depth - stepSize)}
                disabled={bin.depth <= minSize}
                className={isMobile
                  ? "btn btn-secondary w-12 h-12 p-0 rounded-r-none"
                  : "h-full px-2 rounded-l border border-r-0 border-stroke-subtle bg-surface-elevated text-content-tertiary hover:text-content hover:bg-surface-hover disabled:opacity-30 transition-colors"
                }
                aria-label="Decrease depth"
              >
                <svg className={isMobile ? "w-5 h-5" : "w-3 h-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isMobile ? 2 : 2.5}>
                  <path strokeLinecap="round" d="M20 12H4" />
                </svg>
              </button>
              <DeferredNumberInput
                value={bin.depth}
                onChange={(val) => updateField('depth', val)}
                min={minSize}
                max={layout.drawer.depth}
                step={stepSize}
                className={isMobile
                  ? "input flex-1 h-12 text-center font-semibold tabular-nums border-x-0 rounded-none"
                  : "input flex-1 h-full text-center font-medium tabular-nums border-x-0 rounded-none text-sm"
                }
                aria-label="Bin depth"
              />
              <button
                type="button"
                onClick={() => updateField('depth', bin.depth + stepSize)}
                disabled={bin.depth >= layout.drawer.depth}
                className={isMobile
                  ? "btn btn-secondary w-12 h-12 p-0 rounded-l-none"
                  : "h-full px-2 rounded-r border border-l-0 border-stroke-subtle bg-surface-elevated text-content-tertiary hover:text-content hover:bg-surface-hover disabled:opacity-30 transition-colors"
                }
                aria-label="Increase depth"
              >
                <svg className={isMobile ? "w-5 h-5" : "w-3 h-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isMobile ? 2 : 2.5}>
                  <path strokeLinecap="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Real-world dimensions */}
        <div className="flex items-center gap-1.5 text-sm text-content-tertiary">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 12h16M4 12v-2M8 12v-1M12 12v-2M16 12v-1M20 12v-2" />
          </svg>
          <span className="tabular-nums">
            {(bin.width * layout.gridUnitMm).toFixed(0)} × {(bin.depth * layout.gridUnitMm).toFixed(0)} × {(bin.height * layout.heightUnitMm).toFixed(0)} mm
          </span>
        </div>

        {/* Height and Clearance - compact inline controls */}
        <div className={`grid gap-3 ${constraints.maxClearance > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {/* Height control */}
          <div>
            <label className={`block ${labelSize} text-content-tertiary`}>
              Height
            </label>
            <div className={`flex items-center ${stepperHeight}`}>
              <button
                type="button"
                onClick={() => updateField('height', bin.height - 1)}
                disabled={bin.height <= constraints.minHeight}
                className={isMobile
                  ? "btn btn-secondary w-12 h-12 p-0 rounded-r-none"
                  : "h-full px-2 rounded-l border border-r-0 border-stroke-subtle bg-surface-elevated text-content-tertiary hover:text-content hover:bg-surface-hover disabled:opacity-30 transition-colors"
                }
                aria-label="Decrease height"
              >
                <svg className={isMobile ? "w-5 h-5" : "w-3 h-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isMobile ? 2 : 2.5}>
                  <path strokeLinecap="round" d="M20 12H4" />
                </svg>
              </button>
              <span className={isMobile
                ? "flex-1 h-12 flex items-center justify-center font-semibold bg-surface-elevated text-content tabular-nums"
                : "flex-1 h-full flex items-center justify-center border-y border-stroke-subtle bg-surface text-center tabular-nums text-content font-medium text-sm"
              }>
                {bin.height}u
              </span>
              <button
                type="button"
                onClick={() => updateField('height', bin.height + 1)}
                disabled={bin.height >= constraints.maxHeight}
                className={isMobile
                  ? "btn btn-secondary w-12 h-12 p-0 rounded-l-none"
                  : "h-full px-2 rounded-r border border-l-0 border-stroke-subtle bg-surface-elevated text-content-tertiary hover:text-content hover:bg-surface-hover disabled:opacity-30 transition-colors"
                }
                aria-label="Increase height"
              >
                <svg className={isMobile ? "w-5 h-5" : "w-3 h-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isMobile ? 2 : 2.5}>
                  <path strokeLinecap="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
            <div className="text-center mt-1 text-[10px] text-content-disabled">
              {constraints.heightRange}
            </div>
          </div>

          {/* Clearance control */}
          {constraints.maxClearance > 0 && (
            <div>
              <label
                className={`block ${labelSize} text-content-tertiary`}
                title="Extra blocked space above for tall contents"
              >
                Clearance
              </label>
              <div className={`flex items-center ${stepperHeight}`}>
                <button
                  type="button"
                  onClick={() => updateField('clearanceHeight', (bin.clearanceHeight || 0) - 1)}
                  disabled={(bin.clearanceHeight || 0) <= 0}
                  className={isMobile
                    ? "btn btn-secondary w-12 h-12 p-0 rounded-r-none"
                    : "h-full px-2 rounded-l border border-r-0 border-stroke-subtle bg-surface-elevated text-content-tertiary hover:text-content hover:bg-surface-hover disabled:opacity-30 transition-colors"
                  }
                  aria-label="Decrease clearance"
                >
                  <svg className={isMobile ? "w-5 h-5" : "w-3 h-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isMobile ? 2 : 2.5}>
                    <path strokeLinecap="round" d="M20 12H4" />
                  </svg>
                </button>
                <span className={isMobile
                  ? "flex-1 h-12 flex items-center justify-center font-semibold bg-surface-elevated text-content tabular-nums"
                  : "flex-1 h-full flex items-center justify-center border-y border-stroke-subtle bg-surface text-center tabular-nums text-content font-medium text-sm"
                }>
                  {bin.clearanceHeight || 0}u
                </span>
                <button
                  type="button"
                  onClick={() => updateField('clearanceHeight', (bin.clearanceHeight || 0) + 1)}
                  disabled={(bin.clearanceHeight || 0) >= constraints.maxClearance}
                  className={isMobile
                    ? "btn btn-secondary w-12 h-12 p-0 rounded-l-none"
                    : "h-full px-2 rounded-r border border-l-0 border-stroke-subtle bg-surface-elevated text-content-tertiary hover:text-content hover:bg-surface-hover disabled:opacity-30 transition-colors"
                  }
                  aria-label="Increase clearance"
                >
                  <svg className={isMobile ? "w-5 h-5" : "w-3 h-3"} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isMobile ? 2 : 2.5}>
                    <path strokeLinecap="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              <div className="text-center mt-1 text-[10px] text-content-disabled">
                +{((bin.clearanceHeight || 0) * layout.heightUnitMm).toFixed(0)}mm above
              </div>
            </div>
          )}
        </div>

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

        {/* Layer - only show for bins on grid (not in staging) */}
        {bin.layerId !== STAGING_ID && layout.layers.length > 1 && (
          <div>
            <label className={`block ${labelSize} text-content-tertiary`}>
              Layer
            </label>
            <div className="relative">
              <select
                value={bin.layerId}
                onChange={(e) => moveToLayer(e.target.value)}
                className={`input w-full pr-8 appearance-none ${inputHeight}`}
                aria-label="Bin layer"
              >
                {layout.layers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}{l.id === layer?.id ? ' (current)' : ''}
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

        {/* Find STL */}
        <STLSearchDropdown
          width={bin.width}
          depth={bin.depth}
          variant="button"
          needsSplit={bin.width > constraints.maxGridUnits || bin.depth > constraints.maxGridUnits}
          className="w-full justify-center py-2 rounded-lg bg-surface-elevated/50 hover:bg-surface-hover border border-stroke-subtle"
        />

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

        {/* Custom Properties */}
        <CustomPropertiesEditor
          customProperties={bin.customProperties}
          onChange={updateCustomProperties}
          variant={variant}
          suggestedKeys={existingPropertyKeys}
        />

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
