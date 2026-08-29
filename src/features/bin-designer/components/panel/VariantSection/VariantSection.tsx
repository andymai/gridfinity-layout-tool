import { useState } from 'react';
import { Alert, Button } from '@/design-system';
import { useTranslation } from '@/i18n';
import { CompactNumberInput } from '@/shared/components/CompactNumberInput';
import { PanelSection } from '../PanelSection';
import type {
  BinParams,
  CutoutOverride,
  CutoutOverrideField,
  DesignOverrides,
  DimensionOverrideField,
  OrphanedOverride,
} from '@/features/bin-designer/types';
import {
  CUTOUT_OVERRIDE_FIELDS,
  DIMENSION_OVERRIDE_FIELDS,
  isEmptyOverrides,
} from '@/features/bin-designer/types';

export interface VariantSectionProps {
  readonly parentName: string;
  readonly parentParams: BinParams;
  readonly overrides: DesignOverrides;
  readonly orphans: readonly OrphanedOverride[];
  readonly onChange: (next: DesignOverrides) => void;
  readonly onDetach: () => void;
  readonly onClearOrphans: () => void;
  readonly busy?: boolean;
}

/**
 * The only editable surface in a variant.
 *
 * Everything else in the panel is inert, because a variant's `params` is a
 * materialized cache of `applyOverrides(parent.params, overrides)` and the next
 * propagation rewrites anything these controls do not claim. Claiming a value
 * here is what moves it out of the parent's reach.
 */
export function VariantSection({
  parentName,
  parentParams,
  overrides,
  orphans,
  onChange,
  onDetach,
  onClearOrphans,
  busy = false,
}: VariantSectionProps) {
  const t = useTranslation();
  const [openCutoutId, setOpenCutoutId] = useState<string | null>(null);

  const setDimension = (field: DimensionOverrideField, value: number | undefined) => {
    const dimensions = Object.fromEntries(
      Object.entries({ ...overrides.dimensions, [field]: value }).filter(([, v]) => v !== undefined)
    );
    onChange({ ...overrides, dimensions });
  };

  const setCutoutField = (
    cutoutId: string,
    field: CutoutOverrideField,
    value: number | undefined
  ) => {
    const current = Object.fromEntries(
      Object.entries({ ...overrides.cutouts?.[cutoutId], [field]: value }).filter(
        ([, v]) => v !== undefined
      )
    );
    // A cutout entry with nothing left in it is dropped, so `isEmptyOverrides`
    // and the claimed-count badge cannot report a claim that no longer exists.
    const cutouts: Record<string, CutoutOverride> = Object.fromEntries(
      Object.entries({ ...overrides.cutouts, [cutoutId]: current }).filter(
        ([, v]) => Object.keys(v).length > 0
      )
    );
    onChange({ ...overrides, cutouts });
  };

  const cutouts = parentParams.cutouts ?? [];

  return (
    <PanelSection>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-content">
        {t('binDesigner.variants.label')}
      </h3>
      <p className="mb-3 text-xs text-content-secondary">
        {t('binDesigner.variants.panelLocked', { name: parentName })}
      </p>

      {orphans.length > 0 && (
        <Alert intent="warning" className="mb-3">
          <p className="text-xs font-medium">
            {t('binDesigner.variants.orphanTitle', { count: orphans.length })}
          </p>
          <p className="mt-1 text-xs">{t('binDesigner.variants.orphanBody')}</p>
          <Button variant="ghost" size="sm" className="mt-1" onClick={onClearOrphans}>
            {t('binDesigner.variants.orphanClear')}
          </Button>
        </Alert>
      )}

      {isEmptyOverrides(overrides) && (
        <p className="mb-3 text-xs text-content-tertiary">
          {t('binDesigner.variants.noneClaimed')}
        </p>
      )}

      <h4 className="mb-1.5 text-label font-semibold uppercase tracking-wide text-content-tertiary">
        {t('binDesigner.variants.dimensions')}
      </h4>
      <div className="mb-4 flex flex-col gap-1.5">
        {DIMENSION_OVERRIDE_FIELDS.map((field) => {
          const claimed = overrides.dimensions?.[field];
          const inherited = parentParams[field];
          return (
            <div key={field} className="flex items-center gap-2">
              <span className="w-24 flex-shrink-0 text-xs text-content-secondary">
                {t(`binDesigner.variants.field.${field}`)}
              </span>
              {claimed === undefined ? (
                <>
                  <span className="flex-1 text-xs text-content-tertiary">
                    {t('binDesigner.variants.inherited', { value: inherited })}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setDimension(field, inherited)}
                  >
                    {t('binDesigner.variants.claim')}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex-1">
                    <CompactNumberInput
                      label={t(`binDesigner.variants.field.${field}`)}
                      value={claimed}
                      onChange={(value) => setDimension(field, value)}
                      min={0.5}
                      max={100}
                      step={0.5}
                      disabled={busy}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setDimension(field, undefined)}
                  >
                    {t('binDesigner.variants.release')}
                  </Button>
                </>
              )}
              {claimed !== undefined && claimed !== inherited && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  title={t('binDesigner.variants.inherited', { value: inherited })}
                  onClick={() => setDimension(field, inherited)}
                >
                  {t('binDesigner.variants.takeParent')}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {cutouts.length > 0 && (
        <>
          <h4 className="mb-1.5 text-label font-semibold uppercase tracking-wide text-content-tertiary">
            {t('binDesigner.variants.cutouts')}
          </h4>
          <div className="flex flex-col gap-1">
            {cutouts.map((cutout) => {
              const claimedFields = Object.keys(overrides.cutouts?.[cutout.id] ?? {});
              const open = openCutoutId === cutout.id;
              return (
                <div key={cutout.id} className="rounded border border-stroke-subtle">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between text-xs"
                    aria-expanded={open}
                    onClick={() => setOpenCutoutId(open ? null : cutout.id)}
                  >
                    {/* `||`, not `??`: `label` is a required string and is usually '', which
                        `??` would treat as a real name and render a blank row. */}
                    <span className="truncate">{cutout.name || cutout.label || cutout.shape}</span>
                    {claimedFields.length > 0 && (
                      <span className="ml-2 text-accent">{claimedFields.length}</span>
                    )}
                  </Button>
                  {open && (
                    <div className="flex flex-col gap-1.5 border-t border-stroke-subtle p-2">
                      {CUTOUT_OVERRIDE_FIELDS.map((field) => {
                        const claimed = overrides.cutouts?.[cutout.id]?.[field];
                        const inherited = cutout[field] ?? 0;
                        return (
                          <div key={field} className="flex items-center gap-2">
                            <span className="w-20 flex-shrink-0 text-label text-content-secondary">
                              {t(`binDesigner.variants.field.${field}`)}
                            </span>
                            {claimed === undefined ? (
                              <>
                                <span className="flex-1 text-label text-content-tertiary">
                                  {t('binDesigner.variants.inherited', { value: inherited })}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => setCutoutField(cutout.id, field, inherited)}
                                >
                                  {t('binDesigner.variants.claim')}
                                </Button>
                              </>
                            ) : (
                              <>
                                <div className="flex-1">
                                  <CompactNumberInput
                                    label={t(`binDesigner.variants.field.${field}`)}
                                    value={claimed}
                                    onChange={(value) => setCutoutField(cutout.id, field, value)}
                                    min={0}
                                    max={500}
                                    softMax
                                    step={0.05}
                                    unit="mm"
                                    disabled={busy}
                                  />
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => setCutoutField(cutout.id, field, undefined)}
                                >
                                  {t('binDesigner.variants.release')}
                                </Button>
                              </>
                            )}
                            {/* Live rather than a "parent changed" notice: a
                                notification can be missed, and the question is
                                what differs now. */}
                            {claimed !== undefined && claimed !== inherited && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                title={t('binDesigner.variants.inherited', { value: inherited })}
                                onClick={() => setCutoutField(cutout.id, field, inherited)}
                              >
                                {t('binDesigner.variants.takeParent')}
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <Button variant="ghost" size="sm" className="mt-3" disabled={busy} onClick={onDetach}>
        {t('binDesigner.variants.detach')}
      </Button>
    </PanelSection>
  );
}
