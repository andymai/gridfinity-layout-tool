import { Suspense } from 'react';
import { CONSTRAINTS, DEFAULT_CATEGORY_COLOR, STAGING_ID } from '@/core/constants';
import { mm, mmToHeightUnits, roundHeightUnits } from '@/core/types';
import { Button, IconButton, Select, Stepper, XIcon } from '@/design-system';
import { ArrowLeftRightIcon, RulerIcon } from '@/design-system/Icon';
import { useHalfGridModeStore } from '@/core/store/halfGridMode';
import { getBinLocationContext } from '@/shared/utils/binLocation';
import { formatHeightUnits, isStandardStackHeight } from '@/shared/utils/heightUnits';
import type { UseBinInspectorReturn } from '@/features/bin-inspector/hooks/useBinInspector';
import { SplitWarning } from '../SplitWarning';
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
          <IconButton
            size="sm"
            touchTarget={false}
            type="button"
            onClick={onClose}
            className="w-7 h-7"
            aria-label={t('inspector.deselectBin')}
          >
            <XIcon className="w-4 h-4" />
          </IconButton>
        )}
      </div>

      <div className="space-y-4">
        {/* Size inputs with flip button between */}
        <div className="flex items-end justify-center gap-2">
          {/* Width control */}
          <div className="flex flex-col">
            <label className={`block ${labelSize} text-content-tertiary`}>
              {t('common.width')}
            </label>
            <Stepper
              value={bin.width}
              onChange={(val) => updateField('width', val)}
              onStep={(delta) => updateField('width', bin.width + delta * stepSize)}
              min={minSize}
              max={layout.drawer.width}
              step={stepSize}
              size={isMobile ? 'lg' : 'md'}
              aria-label={t('common.width')}
            />
          </div>

          {/* Flip button */}
          <IconButton
            variant={isMobile ? 'secondary' : 'ghost'}
            size={isMobile ? 'lg' : 'sm'}
            touchTarget={isMobile}
            type="button"
            onClick={rotateBin}
            className={
              isMobile
                ? 'w-12 h-12 flex-shrink-0'
                : 'flex-shrink-0 h-8 w-8 rounded-sm border border-stroke-subtle bg-surface-elevated text-content-tertiary hover:bg-surface-hover hover:text-content'
            }
            title={t('inspector.swapDimensions')}
            aria-label={t('inspector.swapWidthAndDepth')}
          >
            <ArrowLeftRightIcon size={isMobile ? 'md' : 'xs'} />
          </IconButton>

          {/* Depth control */}
          <div className="flex flex-col">
            <label className={`block ${labelSize} text-content-tertiary`}>
              {t('common.depth')}
            </label>
            <Stepper
              value={bin.depth}
              onChange={(val) => updateField('depth', val)}
              onStep={(delta) => updateField('depth', bin.depth + delta * stepSize)}
              min={minSize}
              max={layout.drawer.depth}
              step={stepSize}
              size={isMobile ? 'lg' : 'md'}
              aria-label={t('common.depth')}
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
          {/* Height control — entered in mm, stored as free fractional units */}
          <div>
            <label className={`block ${labelSize} text-content-tertiary`}>
              {t('common.heightMm')}
            </label>
            <Stepper
              value={bin.height * layout.heightUnitMm}
              onChange={(mmValue) =>
                updateField('height', mmToHeightUnits(mm(mmValue), layout.heightUnitMm))
              }
              onStep={(delta) => updateField('height', roundHeightUnits(bin.height + delta))}
              min={constraints.minHeight * layout.heightUnitMm}
              max={constraints.maxHeight * layout.heightUnitMm}
              step={layout.heightUnitMm}
              inputDecimals={2}
              size={isMobile ? 'lg' : 'md'}
              aria-label={t('inspector.single.heightAria')}
            />
            <div className="mt-1 space-y-0.5 text-[10px] text-content-disabled">
              <div>{t('inspector.heightUnitsEquiv', { units: formatHeightUnits(bin.height) })}</div>
              {!isStandardStackHeight(bin.height, layout.heightUnitMm) && (
                <div className="text-warning">{t('inspector.nonStandardStackWarning')}</div>
              )}
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
              <Stepper
                value={bin.clearanceHeight || 0}
                onStep={(delta) =>
                  updateField('clearanceHeight', (bin.clearanceHeight || 0) + delta)
                }
                min={0}
                max={constraints.maxClearance}
                size={isMobile ? 'lg' : 'md'}
                aria-label={t('inspector.single.clearanceAria')}
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
          <Select
            value={bin.category}
            onValueChange={(value) => updateField('category', value)}
            options={categories.map((c) => ({ id: c.id, name: c.name }))}
            colorSwatch={category?.color || DEFAULT_CATEGORY_COLOR}
            aria-label={t('inspector.single.categoryAria')}
            size={variant === 'mobile' ? 'lg' : 'md'}
            fullWidth
          />
        </div>

        {/* Layer - only show for bins on grid (not in staging) */}
        {bin.layerId !== STAGING_ID && layout.layers.length > 1 && (
          <div>
            <label className={`block ${labelSize} text-content-tertiary`}>
              {t('inspector.layer')}
            </label>
            <Select
              value={bin.layerId}
              onValueChange={moveToLayer}
              options={layout.layers.map((l) => ({
                id: l.id,
                name: l.name,
                suffix: l.id === layer?.id ? '(current)' : '',
              }))}
              aria-label={t('inspector.single.layerAria')}
              size={variant === 'mobile' ? 'lg' : 'md'}
              fullWidth
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
            {t('common.delete')}
          </Button>
        </div>
      </div>
    </div>
  );
}
