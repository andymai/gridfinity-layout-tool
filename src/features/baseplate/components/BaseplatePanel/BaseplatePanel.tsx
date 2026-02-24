/**
 * Parameter panel for the standalone baseplate page.
 *
 * Reads baseplateParams from the layout store (with DEFAULT_BASEPLATE_PARAMS fallback)
 * and writes changes back via setBaseplateParams. Drawer dimensions are read-only
 * since they come from the layout's drawer.
 */

import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/constants';
import { Checkbox } from '@/design-system/Checkbox';
import { useTranslation } from '@/i18n';
import type { BaseplateParams } from '@/core/types';

export function BaseplatePanel() {
  const t = useTranslation();

  const { drawerWidth, drawerDepth, baseplateParams } = useLayoutStore(
    useShallow((state) => ({
      drawerWidth: state.layout.drawer.width,
      drawerDepth: state.layout.drawer.depth,
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

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Title */}
      <h2 className="text-sm font-semibold text-content">{t('baseplate.title')}</h2>

      {/* Drawer size (read-only) */}
      <div className="rounded-lg border border-stroke-subtle bg-surface-elevated px-3 py-2">
        <div className="text-sm font-medium text-content">
          {t('baseplate.drawerSize', { width: drawerWidth, depth: drawerDepth })}
        </div>
      </div>

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

      {/* Half-cell pegs */}
      <Checkbox
        checked={baseplateParams.halfCellPegs}
        onChange={(checked) => updateParam('halfCellPegs', checked)}
        label={t('baseplate.halfCellPegs')}
      />

      {/* Padding */}
      <label className="flex items-center justify-between gap-2 text-xs text-content-secondary">
        <span>{t('baseplate.padding')}</span>
        <input
          type="number"
          value={baseplateParams.paddingMm}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (Number.isFinite(val) && val >= 0 && val <= 5) {
              updateParam('paddingMm', val);
            }
          }}
          min={0}
          max={5}
          step={0.1}
          className="w-20 rounded border border-stroke bg-surface px-2 py-1 text-right text-xs text-content"
        />
      </label>

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
          {baseplateParams.halfCellPegs && <li>{t('baseplate.halfCellPegs')}</li>}
          {baseplateParams.paddingMm > 0 && (
            <li>
              {t('baseplate.padding')}: {baseplateParams.paddingMm}mm
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
