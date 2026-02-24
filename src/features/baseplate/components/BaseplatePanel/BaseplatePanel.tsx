/**
 * Parameter panel for the standalone baseplate page.
 *
 * Reads baseplateParams from the layout store (with DEFAULT_BASEPLATE_PARAMS fallback)
 * and writes changes back via setBaseplateParams. Features "Fit to Drawer" controls
 * for editable drawer dimensions and asymmetric padding distribution.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { Checkbox } from '@/design-system/Checkbox';
import { useTranslation } from '@/i18n';
import { resolveDrawerMm } from '../../utils/buildFullParams';
import { PaddingDistributionControl } from '../PaddingDistributionControl/PaddingDistributionControl';
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

  // Effective drawer dimensions in mm
  const effectiveWidthMm = resolveDrawerMm(baseplateParams.drawerWidthMm, drawerWidth, gridUnitMm);
  const effectiveDepthMm = resolveDrawerMm(baseplateParams.drawerDepthMm, drawerDepth, gridUnitMm);

  const gridWidthMm = drawerWidth * gridUnitMm;
  const gridDepthMm = drawerDepth * gridUnitMm;

  // Compute per-side padding for summary display
  const remainderX = Math.max(0, effectiveWidthMm - gridWidthMm);
  const remainderY = Math.max(0, effectiveDepthMm - gridDepthMm);
  const padLeft = Math.round(remainderX * baseplateParams.paddingRatioX * 10) / 10;
  const padRight = Math.round(remainderX * (1 - baseplateParams.paddingRatioX) * 10) / 10;
  const padFront = Math.round(remainderY * baseplateParams.paddingRatioY * 10) / 10;
  const padBack = Math.round(remainderY * (1 - baseplateParams.paddingRatioY) * 10) / 10;
  const hasPadding = remainderX > 0 || remainderY > 0;

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
            {/* Magnet diameter */}
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

            {/* Magnet depth */}
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

      {/* Fit to Drawer */}
      <div className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold text-content-secondary">
          {t('baseplate.fitToDrawer')}
        </h3>

        {/* Width axis */}
        <PaddingDistributionControl
          axis="width"
          drawerMm={effectiveWidthMm}
          gridMm={gridWidthMm}
          ratio={baseplateParams.paddingRatioX}
          onDrawerMmChange={(v) => updateParam('drawerWidthMm', v)}
          onRatioChange={(v) => updateParam('paddingRatioX', v)}
        />

        {/* Depth axis */}
        <PaddingDistributionControl
          axis="depth"
          drawerMm={effectiveDepthMm}
          gridMm={gridDepthMm}
          ratio={baseplateParams.paddingRatioY}
          onDrawerMmChange={(v) => updateParam('drawerDepthMm', v)}
          onRatioChange={(v) => updateParam('paddingRatioY', v)}
        />
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
            <li>
              {t('baseplate.paddingSummary', {
                left: padLeft.toFixed(1),
                right: padRight.toFixed(1),
                front: padFront.toFixed(1),
                back: padBack.toFixed(1),
              })}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
