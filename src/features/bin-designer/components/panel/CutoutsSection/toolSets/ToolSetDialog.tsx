import { useMemo, useState } from 'react';
import { Button, Dialog, NumberField, SegmentedControl } from '@/design-system';
import { useTranslation } from '@/i18n';
import { isErr } from '@/core/result';
import { useDesignerStore } from '@/features/bin-designer/store';
import { useLayoutPrintBed } from '@/features/bin-designer/hooks/useLayoutPrintBed';
import type { ToolSetSpec, ToolUnits } from '@/features/bin-designer/types';
import {
  DEFAULT_TOOL_SET_CLEARANCE_MM,
  DEFAULT_TOOL_SET_LABEL_MM,
  TOOL_SET_LIMITS,
} from '@/features/bin-designer/types';
import { ExperimentalBadge } from '@/shared/components/ExperimentalBadge/ExperimentalBadge';
import { FeatureToggle } from '@/shared/components/FeatureToggle/FeatureToggle';
import { setLimitOnBed, TOOL_FAMILIES } from '@/shared/toolSets/catalog';
import { generateToolSet } from '@/shared/toolSets/generateToolSet';
import { ToolSetPreview } from './ToolSetPreview';
import { useToolSets } from './useToolSets';
import { planToolSetPlacement, planToolSetRebuild } from './planToolSetPlacement';
import { binBedFit, binNeedsSplit } from '@/shared/utils/binSplitFit';

export interface ToolSetDialogProps {
  /** The set to edit, or null to add a new one. */
  readonly setId: string | null;
  readonly onClose: () => void;
}

const FAMILY = TOOL_FAMILIES.combinationWrench;

function defaultSpec(): ToolSetSpec {
  return {
    family: 'combinationWrench',
    units: 'metric',
    sizes: [...(FAMILY.presets.metric.at(0) ?? [])],
    style: 'flat',
    clearanceMm: DEFAULT_TOOL_SET_CLEARANCE_MM,
    labelSizeMm: DEFAULT_TOOL_SET_LABEL_MM,
    fingerChannel: true,
  };
}

const PREVIEW_NAMES = { pocket: (s: string) => s, channel: '' };

export function ToolSetDialog({ setId, onClose }: ToolSetDialogProps) {
  const t = useTranslation();
  const existing = useDesignerStore((s) =>
    setId === null ? undefined : s.params.cutoutToolSets?.[setId]
  );
  const [spec, setSpec] = useState<ToolSetSpec>(() => existing ?? defaultSpec());
  const { insertSet, rebuildSet } = useToolSets();
  const { printBedSize, printBedDepth } = useLayoutPrintBed();
  const editing = setId !== null && existing !== undefined;

  const entries = FAMILY.table[spec.units];
  const preview = useMemo(() => {
    let n = 0;
    return generateToolSet(spec, FAMILY, {
      setId: 'preview',
      idFactory: () => `preview-${n++}`,
      names: PREVIEW_NAMES,
      maxWidthMm: setLimitOnBed(printBedSize),
    });
  }, [spec, printBedSize]);
  const params = useDesignerStore((s) => s.params);
  const halfGridMode = useDesignerStore((s) => s.ui.halfGridMode);
  // Read off the bin the add or update would make, through the same plan and
  // the same bed-fit test the export uses, so a bin that fits turned or on the
  // diagonal is not reported.
  const bedNote = useMemo((): 'pieces' | 'whole' | null => {
    if (!preview) return null;
    const plan = editing
      ? planToolSetRebuild(params, setId, preview, halfGridMode)
      : planToolSetPlacement(params, preview, halfGridMode);
    if (!plan) return null;
    const planned = {
      ...params,
      ...(plan.size ?? {}),
      ...(plan.height !== null ? { height: plan.height } : {}),
    };
    // Asked with splitting on: with it off the fit keeps the bin whole and
    // reports no split, which would hide that the bin overruns the bed.
    const splittable = { ...planned, splitToFitBed: undefined };
    if (!binNeedsSplit(splittable, binBedFit(splittable, printBedSize, printBedDepth))) return null;
    return params.splitToFitBed === false ? 'whole' : 'pieces';
  }, [preview, editing, params, setId, halfGridMode, printBedSize, printBedDepth]);

  const update = (patch: Partial<ToolSetSpec>) => {
    setNoRoom(false);
    setSpec((s) => ({ ...s, ...patch }));
  };
  const toggleSize = (key: string) =>
    update({
      sizes: spec.sizes.includes(key) ? spec.sizes.filter((k) => k !== key) : [...spec.sizes, key],
    });
  const setUnits = (units: ToolUnits) =>
    units !== spec.units && update({ units, sizes: [...(FAMILY.presets[units].at(0) ?? [])] });

  const [noRoom, setNoRoom] = useState(false);
  const submit = () => {
    const result = editing ? rebuildSet(setId, spec) : insertSet(spec);
    if (isErr(result)) {
      setNoRoom(result.error === 'noRoom');
      return;
    }
    onClose();
  };

  const rangeLabel = (keys: readonly string[]) => {
    const sorted = entries.filter((e) => keys.includes(e.key));
    return t('binDesigner.toolSets.presetRange', {
      from: sorted.at(0)?.key ?? '',
      to: sorted.at(-1)?.key ?? '',
      n: sorted.length,
    });
  };

  return (
    <Dialog.Root open onClose={onClose} size="lg">
      <Dialog.Header
        title={t(editing ? 'binDesigner.toolSets.editTitle' : 'binDesigner.toolSets.addTitle')}
      />
      <Dialog.Body>
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <p className="text-sm text-content-secondary">{t('binDesigner.toolSets.intro')}</p>
            <ExperimentalBadge />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-content">
              {t('binDesigner.toolSets.family.combinationWrench')}
            </span>
            <SegmentedControl<ToolUnits>
              aria-label={t('binDesigner.toolSets.units')}
              size="sm"
              value={spec.units}
              onChange={setUnits}
              options={[
                { value: 'metric', label: t('binDesigner.toolSets.unitsMetric') },
                { value: 'sae', label: t('binDesigner.toolSets.unitsSae') },
              ]}
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-content-secondary">
                {t('binDesigner.toolSets.presets')}
              </span>
              {FAMILY.presets[spec.units].map((preset) => (
                <Button
                  key={preset.join(',')}
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => update({ sizes: [...preset] })}
                >
                  {rangeLabel(preset)}
                </Button>
              ))}
            </div>
            <div
              role="group"
              aria-label={t('binDesigner.toolSets.sizes')}
              className="flex flex-wrap gap-1"
            >
              {entries.map((entry) => {
                const on = spec.sizes.includes(entry.key);
                return (
                  <Button
                    key={entry.key}
                    type="button"
                    variant={on ? 'primary' : 'ghost'}
                    size="sm"
                    aria-pressed={on}
                    disabled={!on && spec.sizes.length >= TOOL_SET_LIMITS.maxSizes}
                    onClick={() => toggleSize(entry.key)}
                  >
                    {entry.key}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <FeatureToggle
              label={t('binDesigner.toolSets.engraveSizes')}
              checked={spec.labelSizeMm > 0}
              onChange={() =>
                update({ labelSizeMm: spec.labelSizeMm > 0 ? 0 : DEFAULT_TOOL_SET_LABEL_MM })
              }
            />
            <FeatureToggle
              label={t('binDesigner.toolSets.fingerChannel')}
              checked={spec.fingerChannel}
              onChange={() => update({ fingerChannel: !spec.fingerChannel })}
            />
            <NumberField
              label={t('binDesigner.toolSets.clearance')}
              value={spec.clearanceMm}
              onChange={(v) => update({ clearanceMm: v })}
              min={TOOL_SET_LIMITS.clearanceMm.min}
              max={TOOL_SET_LIMITS.clearanceMm.max}
              step={0.05}
              unit="mm"
              precision={2}
              size="sm"
            />
          </div>

          {preview ? (
            <ToolSetPreview set={preview} />
          ) : (
            <p className="text-sm text-content-secondary">{t('binDesigner.toolSets.noSizes')}</p>
          )}
          {preview && (
            <p className="text-xs text-content-secondary">
              {t('binDesigner.toolSets.summary', {
                width: Math.round(preview.width),
                depth: Math.round(preview.depth),
              })}{' '}
              {t('binDesigner.toolSets.fitNote')}
            </p>
          )}
          {bedNote && (
            <p className="text-xs text-content-secondary">
              {t(
                bedNote === 'pieces'
                  ? 'binDesigner.toolSets.overBed'
                  : 'binDesigner.toolSets.overBedWhole'
              )}
            </p>
          )}
          {noRoom && (
            <p role="alert" className="text-xs text-error">
              {t('binDesigner.toolSets.noRoom')}
            </p>
          )}
          {editing && (
            <p className="text-xs text-warning">{t('binDesigner.toolSets.rebuildWarning')}</p>
          )}
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button type="button" variant="primary" onClick={submit} disabled={!preview}>
          {t(editing ? 'binDesigner.toolSets.update' : 'binDesigner.toolSets.add')}
        </Button>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
