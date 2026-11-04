/**
 * The pockets in the bin, for a phone or tablet, where the cut editor doesn't
 * render: enough to fix a scan (depth, a quarter turn, delete, pack them
 * again). Moving and reshaping stay on a computer.
 */

import { useId } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, IconButton, RotateCcwIcon, TrashIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import type { Cutout } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { CutoutDepthControl } from '../panel/CutoutsSection/CutoutDepthControl';
import { packIntoBin } from '../panel/CutoutsSection/packIntoBin';
import { derivedLabel } from '../panel/CutoutsSection/shapeListModel';

export function PhoneToolList() {
  const t = useTranslation();
  const headingId = useId();
  const { params, removeCutout, updateCutout, updateCutoutsBatch, setParams } = useDesignerStore(
    useShallow((s) => ({
      params: s.params,
      removeCutout: s.removeCutout,
      updateCutout: s.updateCutout,
      updateCutoutsBatch: s.updateCutoutsBatch,
      setParams: s.setParams,
    }))
  );
  if (params.cutouts.length === 0) return null;

  // Measured from the fill surface, as the editor's inspector does.
  const maxCutDepth = Math.max(0, binDimensions(params).wallHeight - params.cutoutConfig.topOffset);

  const inOneStep = (change: () => void): void => {
    const { startTransaction, commitTransaction } = useDesignerStore.getState();
    startTransaction();
    try {
      change();
    } finally {
      commitTransaction();
    }
  };

  // Each tool keeps the angle it has, so packing again never undoes a turn.
  const repack = (): void => {
    const s = useDesignerStore.getState();
    const packing = packIntoBin(s.params, s.ui.halfGridMode, { turn: false });
    if (packing.size) setParams(packing.size);
    updateCutoutsBatch(new Map(Object.entries(packing.placements)));
  };

  const rotate = (cutout: Cutout): void =>
    inOneStep(() => {
      updateCutout(cutout.id, { rotation: (cutout.rotation + 90) % 360 });
      repack();
    });

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-2 rounded-lg border border-stroke-subtle bg-surface-elevated p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 id={headingId} className="text-xs font-semibold text-content-secondary">
          {t('binDesigner.cutouts.phoneList.title')}
        </h4>
        <Button type="button" variant="ghost" size="sm" onClick={() => inOneStep(repack)}>
          {t('binDesigner.cutouts.autoArrange')}
        </Button>
      </div>
      <ul className="space-y-2" role="list">
        {params.cutouts.map((cutout) => {
          const named = cutout.name?.trim();
          const derived = derivedLabel(cutout);
          const label = named ? named : t(derived.key, derived.values);
          return (
            <li key={cutout.id} className="space-y-1.5 rounded-md border border-stroke-subtle p-2">
              <div className="flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-xs text-content-primary">
                  {label}
                </span>
                <IconButton
                  type="button"
                  size="sm"
                  aria-label={`${t('binDesigner.cutouts.rotate90')} ${label}`}
                  title={t('binDesigner.cutouts.rotate90')}
                  onClick={() => rotate(cutout)}
                >
                  <RotateCcwIcon size="sm" className="-scale-x-100" />
                </IconButton>
                <IconButton
                  type="button"
                  size="sm"
                  aria-label={`${t('common.delete')} ${label}`}
                  title={t('common.delete')}
                  onClick={() => removeCutout(cutout.id)}
                >
                  <TrashIcon size="sm" />
                </IconButton>
              </div>
              <CutoutDepthControl
                cutouts={[cutout]}
                maxCutDepth={maxCutDepth}
                onUpdate={updateCutoutsBatch}
                disabled={false}
              />
            </li>
          );
        })}
      </ul>
      <p className="text-micro text-content-tertiary">{t('binDesigner.cutouts.phoneList.hint')}</p>
    </section>
  );
}
