import { Suspense } from 'react';
import { CONSTRAINTS, DEFAULT_CATEGORY_COLOR, STAGING_ID } from '@/core/constants';
import { RulerIcon } from '@/design-system/Icon';
import { useHalfGridModeStore } from '@/core/store/halfGridMode';
import { getBinLocationContext } from '@/shared/utils/binLocation';
import type { UseBinInspectorReturn } from '@/features/bin-inspector/hooks/useBinInspector';
import { SplitWarning } from '../SplitWarning';
import { StepperControl } from '@/shared/components/StepperControl';
import { SelectDropdown } from '@/shared/components/SelectDropdown';
import { CustomPropertiesEditor } from '../CustomPropertiesEditor';
import { STLSearchDropdown } from '@/shell/STLSearchDropdown';
import { useTranslation } from '@/i18n';
import { lazyWithRetry, namedExport } from '@/shared/utils/lazyWithRetry';

const LinkedDesignSection = lazyWithRetry(() =>
  import('@/features/design-linking/components/LinkedDesignSection').then(
    namedExport('LinkedDesignSection')
  )
);

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
export function SingleBinInspector({ inspector, variant, onClose }: SingleBinInspectorProps) {
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
    rotateBin,
    existingPropertyKeys,
  } = inspector;

  const halfGridMode = useHalfGridModeStore((state) => state.halfGridMode);
  const t = useTranslation();

  if (!bin) return null;

  const isMobile = variant === 'mobile';
  const locationContext = getBinLocationContext(bin);
  const canMoveToStaging = locationContext.canMoveToStash;

  // Format dimensions - show decimal if fractional (half-bin mode)
  const formatDim = (val: number) => (val % 1 === 0 ? val.toString() : val.toFixed(1));
  const minSize = halfGridMode ? 0.5 : 1;
  const stepSize = halfGridMode ? 0.5 : 1;

  // Sizing for mobile vs desktop
  const inputHeight = isMobile ? 'h-12' : '';
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
          {t('inspector.bin', { width: formatDim(bin.width), depth: formatDim(bin.depth) })}
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost w-7 h-7 p-0 min-w-0 min-h-0"
            aria-label={t('inspector.deselectBin')}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
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
              {t('common.width')}
            </label>
            <StepperControl
              value={bin.width}
              onChange={(val) => updateField('width', val)}
              onStep={(delta) => updateField('width', bin.width + delta * stepSize)}
              min={minSize}
              max={layout.drawer.width}
              step={stepSize}
              variant={variant}
              ariaLabel="Bin width"
            />
          </div>

          {/* Flip button */}
          <button
            type="button"
            onClick={rotateBin}
            className={
              isMobile
                ? 'btn btn-secondary w-12 h-12 p-0 flex-shrink-0'
                : 'flex-shrink-0 h-8 w-8 flex items-center justify-center rounded border border-stroke-subtle bg-surface-elevated text-content-tertiary hover:text-content hover:bg-surface-hover transition-colors'
            }
            title={t('inspector.swapDimensions')}
            aria-label={t('inspector.swapWidthAndDepth')}
          >
            <svg
              className={isMobile ? 'w-5 h-5' : 'w-3 h-3'}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={isMobile ? 2 : 2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
              />
            </svg>
          </button>

          {/* Depth control */}
          <div className="flex-1">
            <label className={`block ${labelSize} text-content-tertiary`}>
              {t('common.depth')}
            </label>
            <StepperControl
              value={bin.depth}
              onChange={(val) => updateField('depth', val)}
              onStep={(delta) => updateField('depth', bin.depth + delta * stepSize)}
              min={minSize}
              max={layout.drawer.depth}
              step={stepSize}
              variant={variant}
              ariaLabel="Bin depth"
            />
          </div>
        </div>

        {/* Real-world dimensions */}
        <div className="flex items-center gap-1.5 text-sm text-content-tertiary">
          <RulerIcon size="sm" />
          <span className="tabular-nums">
            {(bin.width * layout.gridUnitMm).toFixed(0)} ×{' '}
            {(bin.depth * layout.gridUnitMm).toFixed(0)} ×{' '}
            {(bin.height * layout.heightUnitMm).toFixed(0)} mm
          </span>
        </div>

        {/* Height and Clearance - compact inline controls */}
        <div
          className={`grid gap-3 ${constraints.maxClearance > 0 ? 'grid-cols-2' : 'grid-cols-1'}`}
        >
          {/* Height control */}
          <div>
            <label className={`block ${labelSize} text-content-tertiary`}>
              {t('common.height')}
            </label>
            <StepperControl
              value={bin.height}
              onStep={(delta) => updateField('height', bin.height + delta)}
              min={constraints.minHeight}
              max={constraints.maxHeight}
              variant={variant}
              ariaLabel="Bin height"
              displayValue={`${bin.height}u`}
            />
            <div className="mt-1 space-y-0.5 text-[10px] text-content-disabled">
              <div>
                {constraints.minHeightReason === 'layer_height'
                  ? t('inspector.minHeightHint', {
                      min: constraints.minHeight,
                      reason: t('inspector.heightReasonLayerHeight'),
                    })
                  : t('inspector.minHeightHintNoReason', { min: constraints.minHeight })}
              </div>
              <div>
                {t('inspector.maxHeightHint', {
                  max: constraints.maxHeight,
                  reason:
                    constraints.maxHeightReason === 'remaining_space'
                      ? t('inspector.heightReasonRemainingSpace')
                      : t('inspector.heightReasonDrawerHeight'),
                })}
              </div>
            </div>
          </div>

          {/* Clearance control */}
          {constraints.maxClearance > 0 && (
            <div>
              <label
                className={`block ${labelSize} text-content-tertiary`}
                title={t('inspector.clearanceTooltip')}
              >
                {t('inspector.clearance')}
              </label>
              <StepperControl
                value={bin.clearanceHeight || 0}
                onStep={(delta) =>
                  updateField('clearanceHeight', (bin.clearanceHeight || 0) + delta)
                }
                min={0}
                max={constraints.maxClearance}
                variant={variant}
                ariaLabel="Bin clearance"
                displayValue={`${bin.clearanceHeight || 0}u`}
              />
              <div className="text-center mt-1 text-[10px] text-content-disabled">
                {t('inspector.clearanceMm', {
                  mm: ((bin.clearanceHeight || 0) * layout.heightUnitMm).toFixed(0),
                })}
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
          printBedDepth={layout.printBedDepth ?? layout.printBedSize}
          compact={isMobile}
        />

        {/* Category */}
        <div>
          <label className={`block ${labelSize} text-content-tertiary`}>
            {t('common.category')}
          </label>
          <SelectDropdown
            value={bin.category}
            onChange={(value) => updateField('category', value)}
            options={categories.map((c) => ({ id: c.id, name: c.name }))}
            colorSwatch={category?.color || DEFAULT_CATEGORY_COLOR}
            ariaLabel="Bin category"
            variant={variant}
          />
        </div>

        {/* Layer - only show for bins on grid (not in staging) */}
        {bin.layerId !== STAGING_ID && layout.layers.length > 1 && (
          <div>
            <label className={`block ${labelSize} text-content-tertiary`}>
              {t('inspector.layer')}
            </label>
            <SelectDropdown
              value={bin.layerId}
              onChange={moveToLayer}
              options={layout.layers.map((l) => ({
                id: l.id,
                name: l.name,
                suffix: l.id === layer?.id ? ' (current)' : '',
              }))}
              ariaLabel="Bin layer"
              variant={variant}
            />
          </div>
        )}

        {/* Label */}
        <div>
          <label className={`block ${labelSize} text-content-tertiary`}>{t('common.label')}</label>
          <input
            type="text"
            value={bin.label}
            onChange={(e) =>
              updateField('label', e.target.value.slice(0, CONSTRAINTS.LABEL_MAX_LENGTH))
            }
            className={`input w-full ${inputHeight}`}
            placeholder={t('inspector.labelPlaceholder')}
            aria-label={t('inspector.binLabel')}
          />
        </div>

        {/* Find STL */}
        <STLSearchDropdown
          width={bin.width}
          depth={bin.depth}
          variant="button"
          needsSplit={
            bin.width > constraints.maxGridUnits.width || bin.depth > constraints.maxGridUnits.depth
          }
          className="w-full justify-center py-2 rounded-lg bg-surface-elevated/50 hover:bg-surface-hover border border-stroke-subtle"
        />

        {/* Linked Design */}
        <Suspense fallback={null}>
          <LinkedDesignSection bin={bin} variant={variant} />
        </Suspense>

        {/* Notes */}
        <div>
          <label className={`block ${labelSize} text-content-tertiary`}>{t('common.notes')}</label>
          <textarea
            value={bin.notes}
            onChange={(e) =>
              updateField('notes', e.target.value.slice(0, CONSTRAINTS.NOTES_MAX_LENGTH))
            }
            className="input w-full"
            placeholder={t('inspector.notesPlaceholder')}
            aria-label={t('inspector.binNotes')}
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
              {t('inspector.toStash')}
            </button>
          )}
          <button
            type="button"
            onClick={requestDelete}
            className={`btn btn-danger flex-1 ${isMobile ? 'h-12' : ''}`}
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  );
}
