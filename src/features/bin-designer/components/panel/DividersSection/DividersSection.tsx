/**
 * Divider pieces section: controls for removable divider configuration.
 *
 * Only visible when bin style is 'slotted'. Shows thickness, height,
 * clearance controls and calculated divider lengths per axis.
 */

import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDesignerStore } from '@/features/bin-designer/store';
import { CollapsibleSection } from '@/shared/components/CollapsibleSection';
import { StepperControl } from '@/shared/components/StepperControl';
import { DESIGNER_CONSTRAINTS, GRIDFINITY } from '../../../constants';
import { DividersIcon } from '../SectionIllustrations';
import { useTranslation } from '@/i18n';
import { calculateDividerLength, calculateDividerHeight } from '@/shared/utils/slotMath';
import type { DividerPieceConfig } from '../../../types';

export function DividersSection() {
  const {
    style,
    dividerPieces,
    slotConfig,
    width,
    depth,
    height,
    wallThickness,
    stackingLip,
    setParam,
  } = useDesignerStore(
    useShallow((s) => ({
      style: s.params.style,
      dividerPieces: s.params.dividerPieces,
      slotConfig: s.params.slotConfig,
      width: s.params.width,
      depth: s.params.depth,
      height: s.params.height,
      wallThickness: s.params.wallThickness,
      stackingLip: s.params.base.stackingLip,
      setParam: s.setParam,
    }))
  );
  const t = useTranslation();

  const updateDividerPieces = useCallback(
    (updates: Partial<DividerPieceConfig>) => {
      setParam('dividerPieces', { ...dividerPieces, ...updates });
    },
    [dividerPieces, setParam]
  );

  // Calculate dimensions for display
  const outerW = width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const totalH = height * GRIDFINITY.HEIGHT_UNIT;
  const wallHeight = totalH - GRIDFINITY.SOCKET_HEIGHT;

  const dividerHeight = useMemo(
    () => calculateDividerHeight(dividerPieces, wallHeight, stackingLip),
    [dividerPieces, wallHeight, stackingLip]
  );

  // Effective slot depth: 50% of wall thickness, clamped to [0.5, 1.5]mm
  const effectiveSlotDepth = Math.min(1.5, Math.max(0.5, wallThickness * 0.5));

  // Only one axis is active at a time
  const activeInnerDim = slotConfig.y.enabled ? innerD : innerW;
  const dividerLength = useMemo(() => {
    if (!slotConfig.x.enabled && !slotConfig.y.enabled) return null;
    return calculateDividerLength(activeInnerDim, effectiveSlotDepth, dividerPieces.clearance);
  }, [
    slotConfig.x.enabled,
    slotConfig.y.enabled,
    activeInnerDim,
    effectiveSlotDepth,
    dividerPieces.clearance,
  ]);

  if (style !== 'slotted') return null;

  const summary = `${dividerPieces.thickness}mm ${t('binDesigner.dividerThickness').toLowerCase()}`;

  return (
    <CollapsibleSection
      title={t('binDesigner.dividers')}
      defaultExpanded
      illustration={<DividersIcon />}
      summary={summary}
    >
      <div className="space-y-3">
        {/* Height */}
        <div>
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('binDesigner.dividerHeight')}
          </span>
          <StepperControl
            value={dividerPieces.height === 'auto' ? dividerHeight : dividerPieces.height}
            displayValue={
              dividerPieces.height === 'auto'
                ? `${t('binDesigner.dividerAutoHeight')} (${Math.round(dividerHeight * 10) / 10}mm)`
                : undefined
            }
            onChange={(v) => {
              const rounded = Math.round(v * 10) / 10;
              if (rounded >= Math.round(dividerHeight * 10) / 10) {
                updateDividerPieces({ height: 'auto' });
              } else {
                updateDividerPieces({ height: Math.max(5, rounded) });
              }
            }}
            onStep={(delta) => {
              if (dividerPieces.height === 'auto') {
                if (delta < 0) {
                  updateDividerPieces({
                    height: Math.round((dividerHeight + delta) * 10) / 10,
                  });
                }
                // Ignore step up when already at auto (maximum)
              } else {
                const next = Math.round((dividerPieces.height + delta) * 10) / 10;
                const maxRounded = Math.round(dividerHeight * 10) / 10;
                if (next >= maxRounded) {
                  updateDividerPieces({ height: 'auto' });
                } else {
                  updateDividerPieces({ height: Math.max(5, next) });
                }
              }
            }}
            min={5}
            max={Math.round(dividerHeight * 10) / 10}
            step={1}
            variant="desktop"
            ariaLabel="Divider height"
          />
        </div>

        {/* Thickness */}
        <div>
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('binDesigner.dividerThickness')}
          </span>
          <StepperControl
            value={dividerPieces.thickness}
            onChange={(v) =>
              updateDividerPieces({
                thickness: Math.min(
                  DESIGNER_CONSTRAINTS.MAX_DIVIDER_THICKNESS,
                  Math.max(DESIGNER_CONSTRAINTS.MIN_DIVIDER_THICKNESS, v)
                ),
              })
            }
            onStep={(delta) =>
              updateDividerPieces({
                thickness: Math.min(
                  DESIGNER_CONSTRAINTS.MAX_DIVIDER_THICKNESS,
                  Math.max(
                    DESIGNER_CONSTRAINTS.MIN_DIVIDER_THICKNESS,
                    Math.round(
                      (dividerPieces.thickness +
                        delta * DESIGNER_CONSTRAINTS.DIVIDER_THICKNESS_STEP) *
                        10
                    ) / 10
                  )
                ),
              })
            }
            min={DESIGNER_CONSTRAINTS.MIN_DIVIDER_THICKNESS}
            max={DESIGNER_CONSTRAINTS.MAX_DIVIDER_THICKNESS}
            step={DESIGNER_CONSTRAINTS.DIVIDER_THICKNESS_STEP}
            variant="desktop"
            ariaLabel="Divider thickness"
          />
        </div>

        {/* Fit tolerance */}
        <div>
          <span className="mb-1 block text-xs text-content-tertiary">
            {t('binDesigner.dividerClearance')}
          </span>
          <StepperControl
            value={dividerPieces.clearance}
            onChange={(v) =>
              updateDividerPieces({
                clearance: Math.min(
                  DESIGNER_CONSTRAINTS.MAX_DIVIDER_CLEARANCE,
                  Math.max(DESIGNER_CONSTRAINTS.MIN_DIVIDER_CLEARANCE, v)
                ),
              })
            }
            onStep={(delta) =>
              updateDividerPieces({
                clearance: Math.min(
                  DESIGNER_CONSTRAINTS.MAX_DIVIDER_CLEARANCE,
                  Math.max(
                    DESIGNER_CONSTRAINTS.MIN_DIVIDER_CLEARANCE,
                    Math.round(
                      (dividerPieces.clearance +
                        delta * DESIGNER_CONSTRAINTS.DIVIDER_CLEARANCE_STEP) *
                        100
                    ) / 100
                  )
                ),
              })
            }
            min={DESIGNER_CONSTRAINTS.MIN_DIVIDER_CLEARANCE}
            max={DESIGNER_CONSTRAINTS.MAX_DIVIDER_CLEARANCE}
            step={DESIGNER_CONSTRAINTS.DIVIDER_CLEARANCE_STEP}
            variant="desktop"
            ariaLabel="Divider fit tolerance"
          />
        </div>

        {/* Calculated lengths */}
        <div className="flex items-center gap-1.5 text-xs text-content-tertiary">
          <svg
            className="h-3.5 w-3.5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 12h16M4 12v-2M8 12v-1M12 12v-2M16 12v-1M20 12v-2"
            />
          </svg>
          <span className="tabular-nums">
            {dividerLength !== null
              ? t('binDesigner.dividerDimensions', {
                  length: String(Math.round(dividerLength * 10) / 10),
                  height: String(Math.round(dividerHeight * 10) / 10),
                })
              : t('binDesigner.dividerHeightOnly', {
                  height: String(Math.round(dividerHeight * 10) / 10),
                })}
          </span>
        </div>
      </div>
    </CollapsibleSection>
  );
}
