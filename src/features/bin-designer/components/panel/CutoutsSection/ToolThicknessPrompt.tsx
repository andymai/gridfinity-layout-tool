/**
 * Asks how thick a freshly imported tool is and sets its pocket depth from the
 * answer. A traced or drawn outline carries no thickness, so without this every
 * import landed at one arbitrary depth that the user had to notice and fix.
 *
 * Non-modal: the new pockets stay on the board while the question is open, and
 * several imports in a row queue up behind one prompt.
 */

import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Cutout } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { heightForCutDepth } from '@/features/bin-designer/utils/heightForCutDepth';
import { Button, Input } from '@/design-system';
import { FeatureToggle } from '@/shared/components/FeatureToggle';
import { useTranslation } from '@/i18n';
import { useLatestRef } from '@/shared/hooks/useLatestRef';
import { cn } from '@/design-system/cn';
import { cutoutDepthFrame, hasDepthModes } from '@/shared/utils/cutoutDepth';

const PLACEMENT = {
  panel: 'rounded-lg border border-stroke-subtle bg-surface-secondary p-3',
  chip: 'absolute top-3 left-1/2 z-30 w-80 -translate-x-1/2 rounded-lg bg-surface-elevated/95 p-3 shadow-lg backdrop-blur',
} as const;

const MIN_PROMPT_DEPTH_MM = 0.5;

function parseMm(text: string): number {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(value) ? Number.NaN : value;
}

export interface ToolThicknessPromptProps {
  /** `chip` floats over the workspace canvas; `panel` sits in the sidebar. */
  readonly placement?: keyof typeof PLACEMENT;
  /** Select the tools being asked about, so the board shows which they are. */
  readonly onFocusTools?: (ids: readonly string[]) => void;
}

export function ToolThicknessPrompt({
  placement = 'panel',
  onFocusTools,
}: ToolThicknessPromptProps) {
  const t = useTranslation();
  const { queued, cutouts, params, target, clearDepthPrompt, updateCutoutsBatch, setParam } =
    useDesignerStore(
      useShallow((s) => ({
        queued: s.ui.depthPromptIds,
        cutouts: s.params.cutouts,
        params: s.params,
        target: s.ui.cutoutTarget,
        clearDepthPrompt: s.clearDepthPrompt,
        updateCutoutsBatch: s.updateCutoutsBatch,
        setParam: s.setParam,
      }))
    );
  const [thicknessText, setThicknessText] = useState('');
  const [proudText, setProudText] = useState('0');
  const [sameForAll, setSameForAll] = useState(true);

  // Undo, delete or a design switch can take a queued cutout away; the prompt
  // only ever asks about pockets that are still there.
  const pending = useMemo(() => {
    const byId = new Map(cutouts.map((c) => [c.id, c]));
    return queued
      .map((id) => byId.get(id))
      .filter((c): c is Cutout => c !== undefined && c.hidden !== true && hasDepthModes(c));
  }, [queued, cutouts]);
  const targets = sameForAll ? pending : pending.slice(0, 1);
  const targetKey = targets.map((c) => c.id).join('|');

  // Selects only when the asked-about tools change. The callback is a fresh
  // arrow on every editor render, and re-selecting on each one would undo any
  // selection the user makes while the prompt is open.
  const focusTools = useLatestRef(onFocusTools);
  useEffect(() => {
    if (targetKey !== '') focusTools.current?.(targetKey.split('|'));
  }, [targetKey, focusTools]);

  if (target !== 'bin' || pending.length === 0) return null;

  const thickness = parseMm(thicknessText);
  const proud = proudText.trim() === '' ? 0 : parseMm(proudText);
  const depth = Math.round((thickness - proud) * 100) / 100;
  const valid = thickness > 0 && proud >= 0 && depth >= MIN_PROMPT_DEPTH_MM;
  const maxDepth = cutoutDepthFrame(params).fillDepthMm;
  const tooDeep = valid && depth > maxDepth + 1e-6;
  const raiseTo = tooDeep ? heightForCutDepth(params, depth) : null;

  const finish = (ids: readonly string[]): void => {
    clearDepthPrompt(ids);
    setThicknessText('');
    setProudText('0');
  };

  const apply = (): void => {
    if (!valid || tooDeep) return;
    updateCutoutsBatch(new Map(targets.map((c) => [c.id, { cutDepth: depth }])));
    finish(targets.map((c) => c.id));
  };

  const title =
    targets.length === 1
      ? t('binDesigner.cutouts.depthPrompt.title.one')
      : t('binDesigner.cutouts.depthPrompt.title.other', { count: targets.length });

  return (
    <section aria-label={title} className={cn('space-y-2', PLACEMENT[placement])}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-label font-medium">{title}</h3>
        {!sameForAll && (
          <span className="text-micro text-content-tertiary">
            {t('binDesigner.cutouts.depthPrompt.remaining', { count: pending.length })}
          </span>
        )}
      </div>
      <form
        className="grid grid-cols-2 gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply();
        }}
      >
        <label className="space-y-0.5 text-micro text-content-secondary">
          <span>{t('binDesigner.cutouts.depthPrompt.thickness')}</span>
          <Input
            size="sm"
            inputMode="decimal"
            value={thicknessText}
            onChange={(e) => setThicknessText(e.target.value)}
          />
        </label>
        <label className="space-y-0.5 text-micro text-content-secondary">
          <span>{t('binDesigner.cutouts.depthPrompt.proud')}</span>
          <Input
            size="sm"
            inputMode="decimal"
            value={proudText}
            onChange={(e) => setProudText(e.target.value)}
          />
        </label>
        <p className="col-span-2 text-micro text-content-tertiary">
          {valid
            ? t('binDesigner.cutouts.cutsDepth', { depth: depth.toFixed(1) })
            : t('binDesigner.cutouts.depthPrompt.hint')}
        </p>
        {tooDeep && (
          <div className="col-span-2 space-y-1">
            <p role="alert" className="text-label leading-snug text-warning">
              {t('binDesigner.cutouts.depthPrompt.tooDeep', { max: maxDepth.toFixed(1) })}
            </p>
            {raiseTo !== null && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setParam('height', raiseTo)}
              >
                {t('binDesigner.cutouts.depthPrompt.raise', { height: raiseTo })}
              </Button>
            )}
          </div>
        )}
        {(pending.length > 1 || !sameForAll) && (
          <div className="col-span-2">
            <FeatureToggle
              label={t('binDesigner.cutouts.depthPrompt.sameForAll', { count: pending.length })}
              checked={sameForAll}
              onChange={() => setSameForAll((on) => !on)}
            />
          </div>
        )}
        <div className="col-span-2 flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => finish(targets.map((c) => c.id))}
          >
            {t('binDesigner.cutouts.depthPrompt.skip')}
          </Button>
          <Button type="submit" variant="primary" size="sm" disabled={!valid || tooDeep}>
            {t('binDesigner.cutouts.depthPrompt.apply')}
          </Button>
        </div>
      </form>
    </section>
  );
}
