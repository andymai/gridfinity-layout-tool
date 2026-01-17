import { useState } from 'react';
import { STAGING_ID, DEFAULT_CATEGORY_COLOR, CONSTRAINTS } from '../../core/constants';
import type { UseBinInspectorReturn } from '../../hooks/useBinInspector';
import type { Layer } from '../../core/types';
import { SelectDropdown } from '../SelectDropdown';
import { BulkIncrementControl } from '../BulkIncrementControl';

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
    updateMultiCustomProperty,
    updateMultiHeight,
    updateMultiClearance,
    updateMultiLayer,
    requestDelete,
    moveToStaging,
    clearSelection,
    existingPropertyKeys,
  } = inspector;

  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [propertyKey, setPropertyKey] = useState('');
  const [propertyValue, setPropertyValue] = useState('');

  if (selectedBins.length === 0) return null;

  const isMobile = variant === 'mobile';

  // Sizing for mobile vs desktop
  const inputHeight = isMobile ? 'h-12' : '';
  const labelSize = isMobile ? 'text-sm mb-2' : 'text-xs mb-1';

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
          <SelectDropdown
            value={commonCategory || ''}
            onChange={updateMultiCategory}
            options={categories.map((c) => ({ id: c.id, name: c.name }))}
            placeholder={!commonCategory ? { value: '', label: getMixedLabel(), disabled: true } : undefined}
            colorSwatch={categoryColor}
            ariaLabel="Category for selected bins"
            variant={variant}
          />
        </div>

        {/* Layer - only show when there are bins on grid and multiple layers */}
        {gridBins.length > 0 && layout.layers.length > 1 && (
          <div>
            <label className={`block ${labelSize} text-content-tertiary`}>
              Layer
            </label>
            <SelectDropdown
              value={commonLayer?.id || ''}
              onChange={updateMultiLayer}
              options={layout.layers.map((l) => ({
                id: l.id,
                name: l.name,
                suffix: l.id === commonLayer?.id ? ' (current)' : '',
              }))}
              placeholder={!commonLayer ? { value: '', label: getMixedLayerLabel(), disabled: true } : undefined}
              ariaLabel="Layer for selected bins"
              variant={variant}
            />
          </div>
        )}

        {/* Height control */}
        <div>
          <label className={`block ${labelSize} text-content-tertiary`}>
            Height
          </label>
          <BulkIncrementControl
            displayValue={sameHeight ? `${minHeight}u` : `${minHeight}–${maxHeight}u`}
            onStep={updateMultiHeight}
            ariaLabelPrefix="height for all bins"
            variant={variant}
          />
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
            <BulkIncrementControl
              displayValue={sameClearance ? `${minClearance}u` : `${minClearance}–${maxClearance}u`}
              onStep={updateMultiClearance}
              ariaLabelPrefix="clearance for all bins"
              decreaseDisabled={maxClearance <= 0}
              variant={variant}
            />
          </div>
        )}

        {/* Custom Properties - Set same property on all bins */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={`block ${labelSize} text-content-tertiary`}>
              Custom Properties
            </label>
            {!showPropertyForm && (
              <button
                type="button"
                onClick={() => setShowPropertyForm(true)}
                className="text-xs text-accent hover:text-accent-hover transition-colors"
              >
                + Set Property
              </button>
            )}
          </div>
          {showPropertyForm ? (
            <div className="bg-surface-elevated border border-stroke-subtle rounded p-2.5 space-y-2">
              <input
                type="text"
                value={propertyKey}
                onChange={(e) => setPropertyKey(e.target.value.slice(0, CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH))}
                className={`input w-full ${inputHeight}`}
                placeholder="Property name"
                aria-label="Property name"
                list="property-key-suggestions"
                autoFocus
              />
              <datalist id="property-key-suggestions">
                {existingPropertyKeys.map((key) => (
                  <option key={key} value={key} />
                ))}
              </datalist>
              <input
                type="text"
                value={propertyValue}
                onChange={(e) => setPropertyValue(e.target.value.slice(0, CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH))}
                className={`input w-full ${inputHeight}`}
                placeholder="Value"
                aria-label="Property value"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (propertyKey.trim()) {
                      updateMultiCustomProperty(propertyKey, propertyValue);
                      setPropertyKey('');
                      setPropertyValue('');
                      setShowPropertyForm(false);
                    }
                  }}
                  disabled={!propertyKey.trim()}
                  className={`btn btn-primary flex-1 ${isMobile ? 'h-10' : 'h-8'}`}
                >
                  Set on All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPropertyKey('');
                    setPropertyValue('');
                    setShowPropertyForm(false);
                  }}
                  className={`btn btn-ghost flex-1 ${isMobile ? 'h-10' : 'h-8'}`}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className={`text-xs text-content-disabled ${isMobile ? '' : 'mt-1'}`}>
              Set the same property on all selected bins
            </p>
          )}
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
            Delete All
          </button>
        </div>
      </div>
    </div>
  );
}
