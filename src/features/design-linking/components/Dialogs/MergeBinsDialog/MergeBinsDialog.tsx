/**
 * Confirmation for merging a group of layout bins into one divided insert.
 *
 * Everything the merge cannot carry across is stated before it happens: bins
 * whose height is raised, linked designs whose custom geometry is dropped,
 * gaps that become compartments, and a piece that needs splitting for the bed.
 * The layout itself is never modified, so the only cost of confirming is a new
 * saved design.
 */

import { useCallback, useMemo, useState } from 'react';
import { Dialog, Button, AlertTriangleIcon } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import type { MergeBlockedReason, MergePlan } from '../../../domain/mergeBins';
import { useMergeBins } from '../../../hooks/useMergeBins';

export interface MergeBinsDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

function blockedMessage(reason: MergeBlockedReason, t: ReturnType<typeof useTranslation>): string {
  switch (reason.kind) {
    case 'no-bins':
      return t('designLinking.merge.blocked.noBins');
    case 'grid-overflow':
      return t('designLinking.merge.blocked.gridOverflow', {
        cols: reason.cols,
        rows: reason.rows,
        max: reason.max,
      });
    case 'too-large':
      return t('designLinking.merge.blocked.tooLarge', { max: reason.max });
    case 'invalid-params':
      return reason.message;
  }
}

export function MergeBinsDialog({ open, onClose }: MergeBinsDialogProps) {
  const t = useTranslation();
  const { mergeableBins, previewMerge, commitMerge } = useMergeBins();
  const [flatBase, setFlatBase] = useState(false);
  const [busy, setBusy] = useState(false);

  const result = useMemo(
    () => previewMerge({ baseStyle: flatBase ? 'flat' : 'standard' }),
    [previewMerge, flatBase]
  );

  const handleConfirm = useCallback(async () => {
    if (!isOk(result)) return;
    setBusy(true);
    try {
      await commitMerge(result.value);
      onClose();
    } finally {
      setBusy(false);
    }
  }, [result, commitMerge, onClose]);

  // Every hook has run by here, so the blocked branch may return early — which
  // keeps `result` narrowed for the rest of the component instead of forcing a
  // second null check on a value TypeScript cannot re-derive from `plan`.
  if (!isOk(result)) {
    return (
      <Dialog.Root open={open} onClose={onClose} size="sm">
        <Dialog.Header title={t('designLinking.merge.title')} showCloseButton={false}>
          <AlertTriangleIcon size="sm" className="text-status-warning" />
        </Dialog.Header>
        <Dialog.Body>
          <p className="text-sm text-content-secondary">{blockedMessage(result.error, t)}</p>
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" onClick={onClose}>
            {t('common.dismiss')}
          </Button>
        </Dialog.Footer>
      </Dialog.Root>
    );
  }

  const plan: MergePlan = result.value;
  const warnings: string[] = [];
  {
    if (!plan.isRectangular) {
      warnings.push(
        t('designLinking.merge.warning.gaps', { count: plan.warnings.gapCompartmentCount })
      );
    }
    if (plan.warnings.raisedHeightBinIds.length > 0) {
      warnings.push(
        t('designLinking.merge.warning.raisedHeight', {
          count: plan.warnings.raisedHeightBinIds.length,
        })
      );
    }
    if (plan.warnings.linkedDesignBinIds.length > 0) {
      warnings.push(
        t('designLinking.merge.warning.linkedDesigns', {
          count: plan.warnings.linkedDesignBinIds.length,
        })
      );
    }
    if (plan.warnings.splitEnabled) {
      warnings.push(t('designLinking.merge.warning.split'));
    }
  }

  return (
    <Dialog.Root open={open} onClose={onClose} size="sm">
      <Dialog.Header title={t('designLinking.merge.title')} showCloseButton={false} />
      <Dialog.Body>
        <p className="mb-3 text-sm text-content-secondary">
          {t('designLinking.merge.description', {
            bins: mergeableBins.length,
            compartments: plan.compartmentCount,
            width: plan.params.width,
            depth: plan.params.depth,
          })}
        </p>

        <label className="flex items-center gap-2 mb-3 text-sm text-content-secondary">
          <input
            type="checkbox"
            checked={flatBase}
            onChange={(e) => setFlatBase(e.target.checked)}
          />
          {t('designLinking.merge.flatBase')}
        </label>

        {warnings.length > 0 && (
          <div className="p-2.5 bg-surface rounded-lg border border-stroke-subtle space-y-1">
            {warnings.map((warning) => (
              <div key={warning} className="flex items-center gap-2 text-sm text-content-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-status-warning flex-shrink-0" />
                {warning}
              </div>
            ))}
          </div>
        )}
      </Dialog.Body>
      <Dialog.Footer>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={busy}>
          {t('designLinking.merge.confirm')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
