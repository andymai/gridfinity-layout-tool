/**
 * Confirmation for turning a group of layout bins into one bento.
 *
 * Everything the merge cannot carry across is stated before it happens: bins
 * whose height is raised, linked designs whose custom geometry is dropped, gaps
 * that become compartments, and a piece that needs splitting for the bed.
 *
 * A bin left OUT of the selection but standing inside the bento's footprint is
 * different in kind from those, and blocks. The piece is built from the
 * bounding box, so it would be printed through a bin that is still in the
 * drawer — two parts in one space is not a trade-off the user can weigh, so it
 * is offered with the two ways out instead of a warning bullet.
 */

import { batch } from '@/core/cqrs';
import { useCallback, useMemo, useState } from 'react';
import {
  Dialog,
  Button,
  CheckboxRow,
  Input,
  SegmentedControl,
  Stepper,
  AlertTriangleIcon,
} from '@/design-system';
import { useTranslation } from '@/i18n';
import { isOk } from '@/core/result';
import { useSelectionStore } from '@/core/store';
import { useMutations } from '@/shared/contexts';
import type { MergeBlockedReason, MergePlan } from '../../../domain/mergeBins';
import { CompartmentPreview } from './CompartmentPreview';
import { useBento } from '../../../hooks/useBento';

export interface MakeBentoDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
}

/** Divider thickness choices, mirroring the designer's wall thickness options. */
const THICKNESS_OPTIONS = [0.8, 1.2, 1.6, 2.4];

function blockedMessage(reason: MergeBlockedReason, t: ReturnType<typeof useTranslation>): string {
  switch (reason.kind) {
    case 'too-few-bins':
      return t('designLinking.bento.blocked.tooFewBins', { count: reason.count });
    case 'grid-overflow':
      return t('designLinking.bento.blocked.gridOverflow', {
        cols: reason.cols,
        rows: reason.rows,
        max: reason.max,
      });
    case 'too-large':
      return t('designLinking.bento.blocked.tooLarge', { max: reason.max });
    case 'invalid-params':
      return reason.message;
  }
}

export function MakeBentoDialog({ open, onClose }: MakeBentoDialogProps) {
  const t = useTranslation();
  const { mergeableBins, previewBento, defaultName, commitBento } = useBento();
  const { moveBinToStaging } = useMutations();
  const setSelectedBins = useSelectionStore((s) => s.setSelectedBins);

  const [flatBase, setFlatBase] = useState(false);
  const [name, setName] = useState<string | null>(null);
  const [heightOverride, setHeightOverride] = useState<number | null>(null);
  const [thickness, setThickness] = useState<number | null>(null);
  const [replaceBins, setReplaceBins] = useState(false);
  const [busy, setBusy] = useState(false);

  const result = useMemo(
    () =>
      previewBento({
        baseStyle: flatBase ? 'flat' : 'standard',
        ...(heightOverride !== null ? { heightUnits: heightOverride } : {}),
        ...(thickness !== null ? { dividerThickness: thickness } : {}),
      }),
    [previewBento, flatBase, heightOverride, thickness]
  );

  const effectiveName = name ?? defaultName;

  const handleConfirm = useCallback(async () => {
    if (!isOk(result)) return;
    setBusy(true);
    try {
      // Stay open when the save failed: dismissing here would leave a toast as
      // the only evidence, with the user's chosen options gone.
      if (await commitBento({ plan: result.value, name: effectiveName, replaceBins })) onClose();
    } finally {
      setBusy(false);
    }
  }, [result, commitBento, effectiveName, replaceBins, onClose]);

  // Every hook has run by here, so the blocked branch may return early — which
  // keeps `result` narrowed for the rest of the component instead of forcing a
  // second null check on a value TypeScript cannot re-derive from `plan`.
  if (!isOk(result)) {
    return (
      <Dialog.Root open={open} onClose={onClose} size="sm">
        <Dialog.Header title={t('designLinking.bento.title')} showCloseButton={false}>
          <AlertTriangleIcon size="sm" className="text-warning" />
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
  const trapped = plan.warnings.trappedBinIds;

  const warnings: string[] = [];
  if (!plan.isRectangular) {
    warnings.push(
      t('designLinking.bento.warning.gaps', { count: plan.warnings.gapCompartmentCount })
    );
  }
  if (plan.warnings.raisedHeightBinIds.length > 0) {
    warnings.push(
      t('designLinking.bento.warning.raisedHeight', {
        count: plan.warnings.raisedHeightBinIds.length,
      })
    );
  }
  if (plan.warnings.linkedDesignBinIds.length > 0) {
    warnings.push(
      t('designLinking.bento.warning.linkedDesigns', {
        count: plan.warnings.linkedDesignBinIds.length,
      })
    );
  }
  if (plan.warnings.splitEnabled) {
    warnings.push(t('designLinking.bento.warning.split'));
  }

  const includeTrapped = () => {
    setSelectedBins([...mergeableBins.map((b) => b.id), ...trapped]);
  };
  const stashTrapped = () => {
    // One undo entry for the whole stash, as the inspector and selection
    // actions already do — per-bin entries leave Ctrl+Z restoring one bin
    // while its companions stay stashed.
    batch(() => {
      for (const id of trapped) moveBinToStaging(id);
    });
  };

  return (
    <Dialog.Root open={open} onClose={onClose} size="md">
      <Dialog.Header title={t('designLinking.bento.title')} showCloseButton={false} />
      <Dialog.Body>
        <p className="mb-1 text-sm text-content">
          {t('designLinking.bento.scope.selection', { count: mergeableBins.length })}
        </p>
        <p className="mb-3 text-sm text-content-secondary">
          {t('designLinking.bento.description', {
            compartments: plan.compartmentCount,
            width: plan.params.width,
            depth: plan.params.depth,
          })}
        </p>

        <div className="mb-3">
          <CompartmentPreview
            cols={plan.params.compartments.cols}
            rows={plan.params.compartments.rows}
            cells={plan.params.compartments.cells}
            widthUnits={plan.params.width}
            depthUnits={plan.params.depth}
            gapCompartmentIds={plan.gapCompartmentIds}
            compartmentTexts={plan.params.compartments.compartmentTexts}
          />
        </div>

        <div className="mb-3 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs text-content-tertiary">
              {t('designLinking.bento.nameLabel')}
            </span>
            <Input
              value={effectiveName}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              aria-label={t('designLinking.bento.nameLabel')}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs text-content-tertiary">
                {t('designLinking.bento.heightLabel')}
              </span>
              <Stepper
                value={plan.params.height}
                onChange={setHeightOverride}
                onStep={(delta: number) => setHeightOverride(plan.params.height + delta)}
                min={1}
                max={30}
                step={1}
                aria-label={t('designLinking.bento.heightLabel')}
              />
            </label>
            <div>
              <span className="mb-1 block text-xs text-content-tertiary">
                {t('designLinking.bento.dividerLabel')}
              </span>
              <SegmentedControl
                value={String(plan.params.compartments.thickness)}
                onChange={(v: string) => setThickness(Number(v))}
                options={THICKNESS_OPTIONS.map((v) => ({ value: String(v), label: `${v}` }))}
                aria-label={t('designLinking.bento.dividerLabel')}
              />
            </div>
          </div>

          <CheckboxRow
            label={t('designLinking.bento.flatBase')}
            checked={flatBase}
            onChange={setFlatBase}
          />
          <CheckboxRow
            label={t('designLinking.bento.replaceBins', { count: mergeableBins.length })}
            checked={replaceBins}
            onChange={setReplaceBins}
          />
        </div>

        {trapped.length > 0 && (
          <div className="mb-3 rounded-lg border border-warning/40 bg-warning/5 p-2.5">
            <div className="flex items-start gap-2">
              <AlertTriangleIcon size="sm" className="mt-0.5 shrink-0 text-warning" />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-content">
                  {t('designLinking.bento.trapped', { count: trapped.length })}
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={includeTrapped}>
                    {t('designLinking.bento.trappedInclude')}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={stashTrapped}>
                    {t('designLinking.bento.trappedStash')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="space-y-1 rounded-lg border border-stroke-subtle bg-surface p-2.5">
            {warnings.map((warning) => (
              <div key={warning} className="flex items-center gap-2 text-sm text-content-secondary">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-warning" />
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
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={busy || trapped.length > 0}
          title={trapped.length > 0 ? t('designLinking.bento.trappedBlocks') : undefined}
        >
          {t('designLinking.bento.confirm')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
