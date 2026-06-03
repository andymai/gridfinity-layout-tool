/**
 * Shape-sizing controls: polygon side-count + across-flats, and hardware
 * presets (hex/Allen for polygons, socket drives/diameters for circles).
 * Insertion fit (clearance/chamfer) lives in {@link CutoutFitControls}.
 *
 * Renders nothing for shapes without parametric sizing (rectangle/slot/path).
 */

import { useEffect, useRef, useState } from 'react';
import type { Cutout } from '@/features/bin-designer/types';
import {
  MIN_POLYGON_SIDES,
  MAX_POLYGON_SIDES,
  DEFAULT_POLYGON_SIDES,
} from '@/features/bin-designer/types';
import {
  polygonBoxFromAcrossFlats,
  acrossFlatsFromBox,
  maxAcrossFlats,
} from '@/shared/utils/cutoutPolygon';
import { useTranslation } from '@/i18n';
import { SliderInput } from '../../controls/SliderInput';
import { resizeKeepingCenter } from './cutoutHelpers';
import { HEX_ACROSS_FLATS_PRESETS, CIRCLE_DIAMETER_PRESETS } from './cutoutShapePresets';
import { CutoutPresetMenu } from './CutoutPresetMenu';

interface CutoutShapeControlsProps {
  readonly cutout: Cutout;
  readonly maxWidth: number;
  readonly maxDepth: number;
  readonly onUpdate: (patch: Partial<Cutout>) => void;
  readonly disabled?: boolean;
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

  // Briefly emphasize the size field when a hardware preset sets it, so the
  // change is noticed even when it's a small nudge.
  const [flashSize, setFlashSize] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (): void => {
    setFlashSize(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashSize(false), 900);
  };
  useEffect(() => () => (flashTimer.current ? clearTimeout(flashTimer.current) : undefined), []);

  /**
   * Apply a new across-flats value, preserving the regular-polygon aspect +
   * center. Clamped so the derived width can't exceed maxWidth (which would
   * otherwise distort the polygon when resizeKeepingCenter clips one axis).
   */
  const applyAcrossFlats = (acrossFlats: number, nextSides: number = sides): void => {
    const af = Math.min(acrossFlats, maxAcrossFlats(nextSides, maxWidth, maxDepth));
    const box = polygonBoxFromAcrossFlats(nextSides, af);
    const resized = resizeKeepingCenter(cutout, box.width, box.depth, maxWidth, maxDepth);
    onUpdate({ sides: nextSides, ...resized });
  };

  /** Apply a new circle diameter, preserving center. */
  const applyDiameter = (diameter: number): void => {
    const resized = resizeKeepingCenter(cutout, diameter, diameter, maxWidth, maxDepth);
    onUpdate(resized);
  };

  if (cutout.shape === 'polygon') {
    return (
      <div className="space-y-1.5">
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
          max={maxAcrossFlats(sides, maxWidth, maxDepth)}
          step={0.5}
          unit="mm"
          info={t('binDesigner.cutouts.acrossFlatsInfo')}
          disabled={disabled}
          highlight={flashSize}
        />
        <CutoutPresetMenu
          presets={HEX_ACROSS_FLATS_PRESETS}
          label={t('binDesigner.cutouts.sizePreset')}
          onPick={(mm) => {
            applyAcrossFlats(mm);
            flash();
          }}
          disabled={disabled}
        />
      </div>
    );
  }

  if (cutout.shape === 'circle') {
    return (
      <CutoutPresetMenu
        presets={CIRCLE_DIAMETER_PRESETS}
        label={t('binDesigner.cutouts.sizePreset')}
        onPick={applyDiameter}
        disabled={disabled}
      />
    );
  }

  return null;
}
