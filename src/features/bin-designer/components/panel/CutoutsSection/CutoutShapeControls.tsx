/**
 * Shape-specific cutout controls: polygon side-count + across-flats sizing,
 * hardware presets, and the insertion-clearance field. Rectangle corner-radius
 * stays in the parent panel; this component only renders for the shapes that
 * need extra parameters (polygon / circle / slot).
 */

import type { Cutout } from '@/features/bin-designer/types';
import {
  MIN_POLYGON_SIDES,
  MAX_POLYGON_SIDES,
  DEFAULT_POLYGON_SIDES,
  CLEARANCE_SHAPES,
} from '@/features/bin-designer/types';
import { polygonBoxFromAcrossFlats, acrossFlatsFromBox } from '@/shared/utils/cutoutPolygon';
import { useTranslation } from '@/i18n';
import { Select } from '@/design-system';
import type { SelectOption } from '@/design-system';
import { SliderInput } from '../../controls/SliderInput';
import { resizeKeepingCenter } from './cutoutHelpers';
import {
  HEX_ACROSS_FLATS_PRESETS,
  CIRCLE_DIAMETER_PRESETS,
  type CutoutSizePreset,
} from './cutoutShapePresets';

interface CutoutShapeControlsProps {
  readonly cutout: Cutout;
  readonly maxWidth: number;
  readonly maxDepth: number;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
  readonly disabled?: boolean;
}

function presetOptions(presets: readonly CutoutSizePreset[]): SelectOption[] {
  return presets.map((p) => ({ id: p.id, name: p.label }));
}

export function CutoutShapeControls({
  cutout,
  maxWidth,
  maxDepth,
  onUpdate,
  disabled = false,
}: CutoutShapeControlsProps) {
  const t = useTranslation();
  const sides = cutout.sides ?? DEFAULT_POLYGON_SIDES;
  const isClearanceShape = CLEARANCE_SHAPES.includes(cutout.shape);

  /** Apply a new across-flats value, preserving the regular-polygon aspect + center. */
  const applyAcrossFlats = (acrossFlats: number, nextSides: number = sides): void => {
    const box = polygonBoxFromAcrossFlats(nextSides, acrossFlats);
    const resized = resizeKeepingCenter(cutout, box.width, box.depth, maxWidth, maxDepth);
    onUpdate({ sides: nextSides, ...resized });
  };

  /** Apply a new circle diameter, preserving center. */
  const applyDiameter = (diameter: number): void => {
    const resized = resizeKeepingCenter(cutout, diameter, diameter, maxWidth, maxDepth);
    onUpdate(resized);
  };

  return (
    <>
      {cutout.shape === 'polygon' && (
        <>
          <SliderInput
            label={t('binDesigner.cutouts.sides')}
            value={sides}
            onChange={(s) => applyAcrossFlats(acrossFlatsFromBox(s, cutout.depth), s)}
            min={MIN_POLYGON_SIDES}
            max={MAX_POLYGON_SIDES}
            step={1}
            disabled={disabled}
          />
          <SliderInput
            label={t('binDesigner.cutouts.acrossFlats')}
            value={acrossFlatsFromBox(sides, cutout.depth)}
            onChange={(af) => applyAcrossFlats(af)}
            min={2}
            max={maxDepth}
            step={0.5}
            unit="mm"
            disabled={disabled}
          />
          <Select
            aria-label={t('binDesigner.cutouts.sizePreset')}
            placeholder={t('binDesigner.cutouts.sizePreset')}
            value=""
            options={presetOptions(HEX_ACROSS_FLATS_PRESETS)}
            onValueChange={(id) => {
              const preset = HEX_ACROSS_FLATS_PRESETS.find((p) => p.id === id);
              if (preset) applyAcrossFlats(preset.mm);
            }}
            disabled={disabled}
          />
        </>
      )}

      {cutout.shape === 'circle' && (
        <Select
          aria-label={t('binDesigner.cutouts.sizePreset')}
          placeholder={t('binDesigner.cutouts.sizePreset')}
          value=""
          options={presetOptions(CIRCLE_DIAMETER_PRESETS)}
          onValueChange={(id) => {
            const preset = CIRCLE_DIAMETER_PRESETS.find((p) => p.id === id);
            if (preset) applyDiameter(preset.mm);
          }}
          disabled={disabled}
        />
      )}

      {isClearanceShape && (
        <SliderInput
          label={t('binDesigner.cutouts.clearance')}
          value={cutout.clearance ?? 0}
          onChange={(clearance) => onUpdate({ clearance })}
          min={0}
          max={2}
          step={0.05}
          unit="mm"
          info={t('binDesigner.cutouts.clearanceInfo')}
          disabled={disabled}
        />
      )}
    </>
  );
}
