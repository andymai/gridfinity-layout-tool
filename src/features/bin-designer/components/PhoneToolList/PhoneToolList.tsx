/**
 * The pockets in the bin, for a phone or tablet, where the cut editor doesn't
 * render: enough to fix a scan (depth, a quarter turn, delete, pack them
 * again). Moving and reshaping stay on a computer.
 */

import { useId } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Button, IconButton, RotateCcwIcon, TrashIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import { useToastStore } from '@/core/store/toast';
import type { Cutout } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { binDimensions } from '@/features/bin-designer/utils/binDimensions';
import { CutoutDepthControl } from '../panel/CutoutsSection/CutoutDepthControl';
import { offFloorIds, packIntoBin } from '../panel/CutoutsSection/packIntoBin';
import { derivedLabel } from '../panel/CutoutsSection/shapeListModel';

export function PhoneToolList() {
  const t = useTranslation();
  const headingId = useId();
  const addToast = useToastStore((s) => s.addToast);
  const { params, target, removeCutout, updateCutout, updateCutoutsBatch, setParams } =
    useDesignerStore(
      useShallow((s) => ({
        params: s.params,
        target: s.ui.cutoutTarget,
        removeCutout: s.removeCutout,
        updateCutout: s.updateCutout,
        updateCutoutsBatch: s.updateCutoutsBatch,
        setParams: s.setParams,
      }))
    );
  // The cutout actions write to the current target; this list is the bin's.
  if (target !== 'bin' || params.cutouts.length === 0) return null;

  // Measured from the fill surface, as the editor's inspector does.
  const maxCutDepth = Math.max(0, binDimensions(params).wallHeight - params.cutoutConfig.topOffset);

  // One undo step: the change, then every tool packed again keeping the angle
  // it has, so packing never undoes a turn. Growing can't reshape a custom
  // footprint or pass the size limit, and there's no editor here to show what
  // hangs off, so a pocket newly past the floor gets a toast.
  const packAfter = (change: () => void): void => {
    const { startTransaction, commitTransaction } = useDesignerStore.getState();
    const before = offFloorIds(useDesignerStore.getState().params);
    startTransaction();
    try {
      change();
      const s = useDesignerStore.getState();
      const packing = packIntoBin(s.params, s.ui.halfGridMode, { turn: false });
      if (packing.size) setParams(packing.size);
      updateCutoutsBatch(new Map(Object.entries(packing.placements)));
    } finally {
      commitTransaction();
    }
    const after = offFloorIds(useDesignerStore.getState().params);
    if ([...after].some((id) => !before.has(id))) {
      addToast(t('binDesigner.cutouts.phoneList.offFloor'), 'info');
    }
  };

  const rotate = (cutout: Cutout): void => {
    if (cutout.locked) return;
    packAfter(() => updateCutout(cutout.id, { rotation: (cutout.rotation + 90) % 360 }));
  };

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-2 rounded-lg border border-stroke-subtle bg-surface-elevated p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h4 id={headingId} className="text-xs font-semibold text-content-secondary">
          {t('binDesigner.cutouts.phoneList.title')}
        </h4>
        <Button type="button" variant="ghost" size="sm" onClick={() => packAfter(() => {})}>
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
                  disabled={cutout.locked === true}
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
              {/* Text is cut to its own style's depth. */}
              {cutout.shape !== 'text' && (
                <CutoutDepthControl
                  cutouts={[cutout]}
                  maxCutDepth={maxCutDepth}
                  onUpdate={updateCutoutsBatch}
                  disabled={false}
                />
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-micro text-content-tertiary">{t('binDesigner.cutouts.phoneList.hint')}</p>
    </section>
  );
}
