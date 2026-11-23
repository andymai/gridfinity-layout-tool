/**
 * Exact width and depth for the Bento compartment inspector. A typed size
 * moves the walls the compartment shares with other drawn compartments, so a
 * pocket can be 23 mm whatever the grid pitch is.
 */

import { useEffect, useMemo } from 'react';
import { useTranslation } from '@/i18n';
import { Stepper } from '@/design-system';
import { trackEvent } from '@/shared/analytics/posthog/trackEvent';
import { useDesignerStore } from '@/features/bin-designer/store';
import type { CompartmentConfig } from '@/features/bin-designer/types';
import { compartmentCavityExact } from '@/features/bin-designer/utils/compartmentDimensions';
import {
  planCompartmentResize,
  resizedDividerOverrides,
  type CompartmentResizePlan,
  type ResizeAxis,
  type ResizeWall,
} from '@/features/bin-designer/utils/compartmentResize';
import { SHIFT_UI_STEP_MM } from '@/features/bin-designer/utils/dividerAngle';
import { createTrailingTrack } from '@/features/bin-designer/components/CompartmentEditor/useDividerTiltSubsection';

export interface BentoCompartmentSizeControlsProps {
  readonly config: CompartmentConfig;
  readonly compartmentId: number;
  readonly interiorW: number;
  readonly interiorD: number;
  /** Walls this compartment may move: only those shared with drawn compartments. */
  readonly walls: readonly ResizeWall[];
}

const AXES: readonly ResizeAxis[] = ['width', 'depth'];

export function BentoCompartmentSizeControls({
  config,
  compartmentId,
  interiorW,
  interiorD,
  walls,
}: BentoCompartmentSizeControlsProps) {
  const t = useTranslation();
  const setDividerOverrides = useDesignerStore((s) => s.setDividerOverrides);

  const cavity = compartmentCavityExact(config, compartmentId, interiorW, interiorD);
  const plans = useMemo(
    () => ({
      width: planCompartmentResize(config, compartmentId, 'width', interiorW, interiorD, walls),
      depth: planCompartmentResize(config, compartmentId, 'depth', interiorW, interiorD, walls),
    }),
    [config, compartmentId, interiorW, interiorD, walls]
  );

  const resizeTrack = useMemo(
    () => createTrailingTrack((payload) => trackEvent('bento_compartment_resized', payload), 2000),
    []
  );
  useEffect(() => () => resizeTrack.flush(), [resizeTrack]);

  if (!cavity) return null;

  const commit = (axis: ResizeAxis, plan: CompartmentResizePlan, targetMm: number): void => {
    setDividerOverrides(resizedDividerOverrides(config, plan, targetMm));
    resizeTrack.queue({
      axis,
      side: plan.direction === 1 ? 'far' : 'near',
      walls_moved: plan.walls.length,
      size_mm: Math.round(targetMm * 10) / 10,
    });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-2 gap-2">
        {AXES.map((axis) => {
          const plan = plans[axis];
          const label = t(
            axis === 'width' ? 'binDesigner.bento.widthField' : 'binDesigner.bento.depthField'
          );
          const current = Math.round((axis === 'width' ? cavity.width : cavity.depth) * 10) / 10;
          return (
            <label key={axis} className="flex flex-col gap-0.5 text-micro text-content-tertiary">
              {label}
              <Stepper
                value={current}
                onChange={(next: number) => {
                  if (plan) commit(axis, plan, next);
                }}
                onStep={(delta: number) => {
                  if (plan) commit(axis, plan, plan.currentMm + delta * SHIFT_UI_STEP_MM);
                }}
                min={plan ? Math.ceil(plan.minMm * 10) / 10 : current}
                max={plan ? Math.floor(plan.maxMm * 10) / 10 : current}
                step={SHIFT_UI_STEP_MM}
                size="sm"
                disabled={!plan}
                aria-label={label}
              />
            </label>
          );
        })}
      </div>
      {(!plans.width || !plans.depth) && (
        <p className="text-micro leading-relaxed text-content-tertiary">
          {t('binDesigner.bento.sizeLockedHint')}
        </p>
      )}
    </div>
  );
}
