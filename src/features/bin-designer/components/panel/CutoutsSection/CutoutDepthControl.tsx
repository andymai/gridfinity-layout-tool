/**
 * Depth for one or more cutouts: how deep the cut goes, and what that depth is
 * held to when the bin changes (a fixed depth, a floor, or cutting through).
 * Shared by the workspace inspector, its multi-selection view and the sidebar
 * editor so the three cannot offer different modes.
 */

import { useMemo } from 'react';
import type { Cutout, CutoutDepthMode } from '@/features/bin-designer/types';
import { CUTOUT_DEPTH_MODES } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { Button, NumberField, SliderInput } from '@/design-system';
import { getSegmentClass, SEGMENT_GROUP_CLASS } from '@/shared/components/segmentedControlClasses';
import { useTranslation } from '@/i18n';
import {
  cutoutDepthFrame,
  cutoutDepthMode,
  cutoutFloorRange,
  floorUnderCutout,
  hasDepthModes,
  throughBlockedReason,
} from '@/shared/utils/cutoutDepth';

export interface CutoutDepthControlProps {
  /** The cutouts being edited, with any live preview already merged in. */
  readonly cutouts: readonly Cutout[];
  readonly maxCutDepth: number;
  readonly onUpdate: (updates: ReadonlyMap<string, Partial<Cutout>>) => void;
  readonly disabled: boolean;
  /** `slider` matches the sidebar editor, `field` the workspace inspector. */
  readonly variant?: 'field' | 'slider';
}

function sharedNumber(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const [first] = values;
  return values.every((v) => v === first) ? first : null;
}

export function CutoutDepthControl({
  cutouts,
  maxCutDepth,
  onUpdate,
  disabled,
  variant = 'field',
}: CutoutDepthControlProps) {
  const t = useTranslation();
  const params = useDesignerStore((s) => s.params);
  const frame = useMemo(() => cutoutDepthFrame(params), [params]);
  const range = cutoutFloorRange(frame);

  const moded = cutouts.length > 0 && cutouts.every(hasDepthModes);
  const modes = new Set(cutouts.map(cutoutDepthMode));
  const mode: CutoutDepthMode | null = modes.size === 1 ? [...modes][0] : null;
  const blocked = cutouts.map((c) => throughBlockedReason(c, params)).find((r) => r !== null);
  const depth = sharedNumber(cutouts.map((c) => c.cutDepth));
  const floor = sharedNumber(cutouts.map((c) => c.floorMm ?? range.initial));

  const writeAll = (patch: (c: Cutout) => Partial<Cutout>): void => {
    onUpdate(new Map(cutouts.map((c) => [c.id, patch(c)])));
  };
  const clampFloor = (mm: number): number => Math.min(range.max, Math.max(range.min, mm));

  // Re-picking the active mode would still push an undo entry and clear redo.
  const pickMode = (next: CutoutDepthMode): void => {
    if (next === mode) return;
    if (next === 'fixed') {
      writeAll(() => ({ depthMode: undefined }));
    } else if (next === 'floor') {
      // Start from the floor the pocket already has, so switching modes alone
      // never moves it.
      writeAll((c) => ({
        depthMode: 'floor',
        floorMm: clampFloor(c.floorMm ?? floorUnderCutout(c.cutDepth, frame)),
      }));
    } else {
      writeAll(() => ({ depthMode: 'through' }));
    }
  };

  const depthField = (
    <DepthNumber
      variant={variant}
      label={t('binDesigner.cutouts.cutDepth')}
      value={depth ?? cutouts[0].cutDepth}
      indeterminate={depth === null}
      onChange={(cutDepth) => writeAll(() => ({ cutDepth }))}
      min={0.5}
      max={maxCutDepth}
      disabled={disabled}
    />
  );
  if (!moded) return depthField;

  return (
    <div className="col-span-2 space-y-1">
      <div
        role="group"
        aria-label={t('binDesigner.cutouts.depthMode')}
        className={SEGMENT_GROUP_CLASS}
      >
        {CUTOUT_DEPTH_MODES.map((opt) => {
          const unavailable = opt === 'through' && blocked !== undefined && mode !== 'through';
          return (
            <Button
              key={opt}
              type="button"
              variant="ghost"
              disabled={disabled || unavailable}
              title={unavailable ? t(`binDesigner.cutouts.throughBlocked.${blocked}`) : undefined}
              onClick={() => pickMode(opt)}
              aria-pressed={mode === opt}
              className={`flex-1 py-0.5 text-micro leading-none ${getSegmentClass(mode === opt)}`}
            >
              {t(`binDesigner.cutouts.depthMode.${opt}`)}
            </Button>
          );
        })}
      </div>
      {(mode === 'fixed' || mode === null) && depthField}
      {mode === 'floor' && (
        <>
          <DepthNumber
            variant={variant}
            label={t('binDesigner.cutouts.floorMm')}
            info={t('binDesigner.cutouts.floorMmDetail')}
            value={floor ?? range.initial}
            indeterminate={floor === null}
            onChange={(floorMm) => writeAll(() => ({ floorMm: clampFloor(floorMm) }))}
            min={range.min}
            max={range.max}
            disabled={disabled}
          />
          {depth !== null && (
            <p className="text-micro text-text-muted">
              {t('binDesigner.cutouts.cutsDepth', { depth: depth.toFixed(1) })}
            </p>
          )}
        </>
      )}
      {mode === 'through' &&
        (blocked === undefined ? (
          <p className="text-micro text-text-muted">{t('binDesigner.cutouts.throughHint')}</p>
        ) : (
          <p role="alert" className="text-label leading-snug text-warning">
            {t(`binDesigner.cutouts.throughBlocked.${blocked}`)}
          </p>
        ))}
    </div>
  );
}

interface DepthNumberProps {
  readonly variant: 'field' | 'slider';
  readonly label: string;
  readonly info?: string;
  readonly value: number;
  readonly indeterminate: boolean;
  readonly onChange: (value: number) => void;
  readonly min: number;
  readonly max: number;
  readonly disabled: boolean;
}

function DepthNumber({ variant, indeterminate, info, ...props }: DepthNumberProps) {
  return variant === 'slider' ? (
    <SliderInput {...props} step={0.5} unit="mm" />
  ) : (
    <NumberField {...props} info={info} indeterminate={indeterminate} step={0.5} unit="mm" />
  );
}
