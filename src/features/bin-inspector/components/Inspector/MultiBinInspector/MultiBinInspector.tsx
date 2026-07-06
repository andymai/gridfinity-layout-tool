import { useState } from 'react';
import { STAGING_ID, DEFAULT_CATEGORY_COLOR, CONSTRAINTS } from '@/core/constants';
import { getGridBins } from '@/shared/utils';
import type { UseBinInspectorReturn } from '@/features/bin-inspector/hooks/useBinInspector';
import type { Layer } from '@/core/types';
import { BulkIncrementControl } from '@/shared/components/BulkIncrementControl';
import { Button, IconButton, Select, XIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import { formatHeightUnits } from '@/shared/utils/heightUnits';

const formatMm = (units: number, heightUnitMm: number): string =>
  String(Number((units * heightUnitMm).toFixed(1)));

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
export function MultiBinInspector({ inspector, variant, onClose }: MultiBinInspectorProps) {
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
    existingPropertyKeys,
  } = inspector;

  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [propertyKey, setPropertyKey] = useState('');
  const [propertyValue, setPropertyValue] = useState('');
  const t = useTranslation();

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
  const mmAt = (units: number) => formatMm(units, layout.heightUnitMm);
  const heightDisplay = sameHeight
    ? `${formatHeightUnits(minHeight)}u (${mmAt(minHeight)}mm)`
    : `${formatHeightUnits(minHeight)}–${formatHeightUnits(maxHeight)}u (${mmAt(minHeight)}–${mmAt(maxHeight)}mm)`;

  // Check clearance values
  const clearances = selectedBins.map((b) => b.clearanceHeight || 0);
  const minClearance = Math.min(...clearances);
  const maxClearance = Math.max(...clearances);
  const sameClearance = minClearance === maxClearance;
  const anyClearance = maxClearance > 0;

  // Check if any bins can be moved to staging
  const canMoveToStaging = selectedBins.some((b) => b.layerId !== STAGING_ID);

  // Check if all bins are on the same layer
  const gridBins = getGridBins(selectedBins);
  const commonLayer: Layer | null =
    gridBins.length > 0 && gridBins.every((b) => b.layerId === gridBins[0]?.layerId)
      ? (layout.layers.find((l) => l.id === gridBins[0]?.layerId) ?? null)
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
        <h2 className="flex-1 text-lg font-semibold text-content">{t('inspector.binsSelected')}</h2>
        {onClose && (
          <IconButton
            size="sm"
            touchTarget={false}
            type="button"
            onClick={onClose}
            className="w-7 h-7"
            aria-label={t('inspector.deselectAllBins')}
          >
            <XIcon className="w-4 h-4" />
          </IconButton>
        )}
      </div>

      <p className={`${isMobile ? 'text-base' : 'text-sm'} text-content-secondary mb-4`}>
        {t('inspector.multiBin.dragHint')}
      </p>

      <div className="space-y-3">
        {/* Category */}
        <div>
          <label className={`block ${labelSize} text-content-tertiary`}>
            {t('common.category')}
          </label>
          <Select
            value={commonCategory || ''}
            onValueChange={updateMultiCategory}
            options={categories.map((c) => ({ id: c.id, name: c.name }))}
            placeholder={!commonCategory ? getMixedLabel() : undefined}
            colorSwatch={categoryColor}
            aria-label={t('inspector.multi.categoryAria')}
            size={variant === 'mobile' ? 'lg' : 'md'}
            fullWidth
          />
        </div>

        {/* Layer - only show when there are bins on grid and multiple layers */}
        {gridBins.length > 0 && layout.layers.length > 1 && (
          <div>
            <label className={`block ${labelSize} text-content-tertiary`}>
              {t('inspector.layer')}
            </label>
            <Select
              value={commonLayer?.id || ''}
              onValueChange={updateMultiLayer}
              options={layout.layers.map((l) => ({
                id: l.id,
                name: l.name,
                suffix: l.id === commonLayer?.id ? '(current)' : '',
              }))}
              placeholder={!commonLayer ? getMixedLayerLabel() : undefined}
              aria-label={t('inspector.multi.layerAria')}
              size={variant === 'mobile' ? 'lg' : 'md'}
              fullWidth
            />
          </div>
        )}

        {/* Height control */}
        <div>
          <label className={`block ${labelSize} text-content-tertiary`}>{t('common.height')}</label>
          <BulkIncrementControl
            displayValue={heightDisplay}
            onStep={updateMultiHeight}
            ariaLabelPrefix={t('inspector.multi.heightAriaPrefix')}
            variant={variant}
          />
        </div>

        {/* Clearance control - show if any bin has clearance or if user might want to add it */}
        {anyClearance && (
          <div>
            <label
              className={`block ${labelSize} text-content-tertiary`}
              title={t('inspector.multi.clearanceTooltip')}
            >
              {t('inspector.clearance')}
            </label>
            <BulkIncrementControl
              displayValue={sameClearance ? `${minClearance}u` : `${minClearance}–${maxClearance}u`}
              onStep={updateMultiClearance}
              ariaLabelPrefix={t('inspector.multi.clearanceAriaPrefix')}
              decreaseDisabled={maxClearance <= 0}
              variant={variant}
            />
          </div>
        )}

        {/* Custom Properties - Set same property on all bins */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={`block ${labelSize} text-content-tertiary`}>
              {t('inspector.customProperties')}
            </label>
            {!showPropertyForm && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => setShowPropertyForm(true)}
                className="text-xs text-accent hover:text-accent-hover px-0 py-0 hover:bg-transparent"
              >
                {t('inspector.setProperty')}
              </Button>
            )}
          </div>
          {showPropertyForm ? (
            <div className="bg-surface-elevated border border-stroke-subtle rounded p-2.5 space-y-2">
              <input
                type="text"
                value={propertyKey}
                onChange={(e) =>
                  setPropertyKey(
                    e.target.value.slice(0, CONSTRAINTS.CUSTOM_PROPERTY_KEY_MAX_LENGTH)
                  )
                }
                className={`input w-full ${inputHeight}`}
                placeholder={t('inspector.customProps.multiKeyPlaceholder')}
                aria-label={t('inspector.customProps.multiKeyPlaceholder')}
                list="property-key-suggestions"
                // eslint-disable-next-line jsx-a11y/no-autofocus -- Intentional autofocus for modal/dialog UX
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
                onChange={(e) =>
                  setPropertyValue(
                    e.target.value.slice(0, CONSTRAINTS.CUSTOM_PROPERTY_VALUE_MAX_LENGTH)
                  )
                }
                className={`input w-full ${inputHeight}`}
                placeholder={t('inspector.customProps.multiValuePlaceholder')}
                aria-label={t('inspector.propertyValue')}
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
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
                  className={`flex-1 ${isMobile ? 'h-10' : 'h-8'}`}
                >
                  {t('inspector.setOnAll')}
                </Button>
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => {
                    setPropertyKey('');
                    setPropertyValue('');
                    setShowPropertyForm(false);
                  }}
                  className={`flex-1 ${isMobile ? 'h-10' : 'h-8'}`}
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </div>
          ) : (
            <p className={`text-xs text-content-disabled ${isMobile ? '' : 'mt-1'}`}>
              {t('inspector.setTheSamePropertyOnAllSelectedBins')}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {canMoveToStaging && (
            <Button
              variant="secondary"
              type="button"
              onClick={moveToStaging}
              className={`flex-1 ${isMobile ? 'h-12' : ''}`}
            >
              {t('inspector.toStash')}
            </Button>
          )}
          <Button
            variant="danger"
            type="button"
            onClick={requestDelete}
            className={`flex-1 ${isMobile ? 'h-12' : ''}`}
          >
            {t('inspector.deleteAll')}
          </Button>
        </div>
      </div>
    </div>
  );
}
