/**
 * Cutout labels drawn on the 2D editor surface.
 *
 * Mirrors what the generation worker engraves or embosses on the bin top: one
 * label per cutout that has `engraveLabel` set and a non-empty label. Position
 * and side come from the shared `cutoutLabelPlacement` helper so the on-screen
 * text tracks the printed label. Font size is auto-fit to the available band
 * (approximated — the worker measures exact glyph metrics via brepjs). Text
 * color is chosen for contrast against the cutout fill (see `cutoutLabelColor`)
 * rather than the theme, so a light filament color no longer makes white labels
 * vanish.
 */

import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import type { Cutout } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { cutoutLabelPlacement, type CutoutLabelPlacement } from '@/shared/utils/cutoutLabel';
import type { TextStyleDefaults } from '@/features/bin-designer/types';
import type { PreviewMap } from '../useCutoutInteraction';
import { cutoutLabelColor } from './cutoutLabelColor';

interface CutoutLabel3DProps {
  readonly cutouts: readonly Cutout[];
  readonly binWidth: number;
  readonly binDepth: number;
  /** Bin surface color — the label sits on the darkened cutout fill derived
   *  from it, so text contrast is computed against that, not the theme. */
  readonly binColor: string;
  /** Live drag/resize overrides so labels follow their cutout mid-interaction. */
  readonly preview: PreviewMap;
}

const TEXT_OPACITY = 0.85;
/** Approximate width of a glyph relative to font size for drei's SDF font. */
const CHAR_WIDTH_RATIO = 0.6;

/**
 * Largest font size (mm) whose estimated bbox fits the band, clamped to the
 * design's min/max. Returns `null` when even the floor overflows — matching
 * the worker, which skips the engraving rather than shrink it illegibly.
 */
function fitLabelFontSize(
  label: string,
  placement: CutoutLabelPlacement,
  textDefaults: TextStyleDefaults
): number | null {
  const availW = placement.availW - 2 * textDefaults.margin;
  const availD = placement.availD - 2 * textDefaults.margin;
  if (availW <= 0 || availD <= 0) return null;
  const widthLimited = availW / (label.length * CHAR_WIDTH_RATIO);
  const fitted = Math.min(widthLimited, availD);
  if (fitted < textDefaults.minFontSize) return null;
  return Math.min(fitted, textDefaults.maxFontSize);
}

export function CutoutLabel3D({
  cutouts,
  binWidth,
  binDepth,
  binColor,
  preview,
}: CutoutLabel3DProps) {
  const textDefaults = useDesignerStore((s) => s.params.textDefaults);

  // The label floats over the darkened cutout fill, so derive its color from
  // that fill's luminance — matching the darkening in `CutoutShapeMesh`.
  const labelColor = useMemo(() => cutoutLabelColor(binColor), [binColor]);

  return (
    <>
      {cutouts.map((cutout) => {
        if (cutout.hidden === true || cutout.engraveLabel !== true) return null;
        const label = cutout.label.trim();
        if (label === '') return null;

        const overrides = preview.get(cutout.id);
        const effective = overrides ? { ...cutout, ...overrides } : cutout;

        const placement = cutoutLabelPlacement(effective, binWidth, binDepth);
        if (!placement) return null;

        const fontSize = fitLabelFontSize(label, placement, textDefaults);
        if (fontSize === null) return null;

        return (
          <Text
            key={`label-${cutout.id}`}
            position={[placement.centerX, placement.centerY, 0.05]}
            fontSize={fontSize}
            color={labelColor}
            fillOpacity={TEXT_OPACITY}
            anchorX="center"
            anchorY="middle"
          >
            {label}
          </Text>
        );
      })}
    </>
  );
}
