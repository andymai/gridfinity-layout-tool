/**
 * Parameter panel for the standalone baseplate page.
 *
 * Shows grid dimensions (read-only), per-side padding steppers, magnet options,
 * and a summary card. Padding values are stored directly — the total drawer
 * dimension is computed for display as grid + left + right / front + back.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { Checkbox } from '@/design-system/Checkbox';
import { Stepper } from '@/design-system/Stepper';
import { useTranslation } from '@/i18n';
import type { BaseplateParams } from '@/core/types';

export function BaseplatePanel() {
  const t = useTranslation();

  const { drawerWidth, drawerDepth, gridUnitMm, baseplateParams } = useLayoutStore(
    useShallow((state) => ({
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
      gridUnitMm: state.layout.gridUnitMm,
      baseplateParams: state.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
    }))
  );

  const updateParam = useCallback(
    <K extends keyof BaseplateParams>(key: K, value: BaseplateParams[K]) => {
      const current = useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
      useLayoutStore.getState().setBaseplateParams({ ...current, [key]: value });
    },
    []
  );

  const gridWidthMm = drawerWidth * gridUnitMm;
  const gridDepthMm = drawerDepth * gridUnitMm;

  const totalWidthMm = gridWidthMm + baseplateParams.paddingLeft + baseplateParams.paddingRight;
  const totalDepthMm = gridDepthMm + baseplateParams.paddingFront + baseplateParams.paddingBack;
  const hasPadding =
    baseplateParams.paddingLeft > 0 ||
    baseplateParams.paddingRight > 0 ||
    baseplateParams.paddingFront > 0 ||
    baseplateParams.paddingBack > 0;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Title */}
      <h2 className="text-sm font-semibold text-content">{t('baseplate.title')}</h2>

      {/* Magnet holes */}
      <fieldset className="flex flex-col gap-2">
        <Checkbox
          checked={baseplateParams.magnetHoles}
          onChange={(checked) => updateParam('magnetHoles', checked)}
          label={t('baseplate.magnetHoles')}
        />

        {baseplateParams.magnetHoles && (
          <div className="ml-6 flex flex-col gap-2">
            <label className="flex items-center justify-between gap-2 text-xs text-content-secondary">
              <span>{t('baseplate.magnetDiameter')}</span>
              <input
                type="number"
                value={baseplateParams.magnetDiameter}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (Number.isFinite(val) && val > 0 && val <= 20) {
                    updateParam('magnetDiameter', val);
                  }
                }}
                min={1}
                max={20}
                step={0.1}
                className="w-20 rounded border border-stroke bg-surface px-2 py-1 text-right text-xs text-content"
              />
            </label>

            <label className="flex items-center justify-between gap-2 text-xs text-content-secondary">
              <span>{t('baseplate.magnetDepth')}</span>
              <input
                type="number"
                value={baseplateParams.magnetDepth}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (Number.isFinite(val) && val > 0 && val <= 10) {
                    updateParam('magnetDepth', val);
                  }
                }}
                min={0.5}
                max={10}
                step={0.1}
                className="w-20 rounded border border-stroke bg-surface px-2 py-1 text-right text-xs text-content"
              />
            </label>
          </div>
        )}
      </fieldset>

      {/* Padding */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-content-secondary">{t('baseplate.padding')}</h3>

        {/* Grid dimensions (read-only) */}
        <div className="text-[11px] text-content-tertiary">
          {t('baseplate.gridDimensions', {
            width: Math.round(gridWidthMm),
            depth: Math.round(gridDepthMm),
          })}
        </div>

        {/* Per-side padding steppers */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <PaddingStepper
            label={t('baseplate.paddingLeft')}
            value={baseplateParams.paddingLeft}
            onChange={(v) => updateParam('paddingLeft', v)}
          />
          <PaddingStepper
            label={t('baseplate.paddingRight')}
            value={baseplateParams.paddingRight}
            onChange={(v) => updateParam('paddingRight', v)}
          />
          <PaddingStepper
            label={t('baseplate.paddingFront')}
            value={baseplateParams.paddingFront}
            onChange={(v) => updateParam('paddingFront', v)}
          />
          <PaddingStepper
            label={t('baseplate.paddingBack')}
            value={baseplateParams.paddingBack}
            onChange={(v) => updateParam('paddingBack', v)}
          />
        </div>
      </div>

      {/* Summary */}
      <div className="mt-2 rounded-lg border border-stroke-subtle bg-surface-elevated px-3 py-2 text-xs text-content-secondary">
        <div className="font-medium text-content">
          {t('baseplate.summary', { width: drawerWidth, depth: drawerDepth })}
        </div>
        <ul className="mt-1 space-y-0.5">
          <li>
            {baseplateParams.magnetHoles
              ? `${baseplateParams.magnetDiameter}mm \u00d7 ${baseplateParams.magnetDepth}mm ${t('baseplate.magnetHoles')}`
              : `${t('baseplate.magnetHoles')}: ---`}
          </li>
          {hasPadding && (
            <>
              <li>
                {t('baseplate.paddingSummary', {
                  left: baseplateParams.paddingLeft.toFixed(1),
                  right: baseplateParams.paddingRight.toFixed(1),
                  front: baseplateParams.paddingFront.toFixed(1),
                  back: baseplateParams.paddingBack.toFixed(1),
                })}
              </li>
              <li className="text-content-tertiary">
                {t('baseplate.totalDimensions', {
                  width: Math.round(totalWidthMm),
                  depth: Math.round(totalDepthMm),
                })}
              </li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}

/** Compact stepper for a single padding value (mm). */
function PaddingStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-content-tertiary">{label}</span>
      <Stepper
        size="sm"
        value={value}
        onChange={onChange}
        onStep={(delta) => onChange(Math.max(0, value + delta))}
        min={0}
        max={100}
        step={0.5}
        aria-label={label}
      />
    </div>
  );
}
