/**
 * Cutout labels drawn on the 2D editor surface.
 *
 * Mirrors what the generation worker puts on the bin top, in whichever form
 * the cutout asked for: engraved (or embossed) text, or the footprint of a
 * swappable plate clicked into a socket. Position
 * and side come from the shared `cutoutLabelPlacement` helper so the on-screen
 * text tracks the printed label. Font size is auto-fit to the available band
 * (approximated — the worker measures exact glyph metrics via brepjs). Text
 * color is chosen for contrast against the cutout fill (see `cutoutLabelColors`),
 * with a contrasting outline halo so glyphs read on any fill,
 * rather than the theme, so a light filament color no longer makes white labels
 * vanish.
 */

import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { Cutout } from '@/features/bin-designer/types';
import { useDesignerStore } from '@/features/bin-designer/store';
import { cutoutLabelPlacement } from '@/shared/utils/cutoutLabel';
import { isCutoutEngraveMode, isCutoutSocketMode } from '@/shared/utils/cutoutLabelSocketPlan';
import {
  LABEL_PLATE_CORNER_RADIUS_MM,
  LABEL_PLATE_HEIGHT_MM,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import { useCutoutSocketPlan } from '@/features/bin-designer/hooks/useCutoutSocketPlan';
import { CutoutSocketFootprint } from './CutoutSocketFootprint';
import type { PreviewMap } from '../useCutoutInteraction';
import { cutoutLabelColors } from './cutoutLabelColor';
import { fitLabelFontSize } from './cutoutLabelFit';

interface CutoutLabel3DProps {
  readonly cutouts: readonly Cutout[];
  readonly binWidth: number;
  readonly binDepth: number;
  /** Bin surface color — the label sits on the darkened cutout fill derived
   *  from it, so text contrast is computed against that, not the theme. */
  readonly binColor: string;
  /** Live drag/resize overrides so labels follow their cutout mid-interaction. */
  readonly preview: PreviewMap;
  /** Start a free-nudge drag of this cutout's label from a world-mm grab point.
   *  Omitted (or undefined) makes labels non-interactive. */
  readonly onLabelDragStart?: (id: string, mmX: number, mmY: number) => void;
}

const TEXT_OPACITY = 0.92;
/** Glyph halo thickness as a fraction of font size (drei accepts a `%` string).
 *  Scales with the auto-fit size so small and large labels read the same. */
const OUTLINE_WIDTH = '7%';

export function CutoutLabel3D({
  cutouts,
  binWidth,
  binDepth,
  binColor,
  preview,
  onLabelDragStart,
}: CutoutLabel3DProps) {
  const textDefaults = useDesignerStore((s) => s.params.textDefaults);
  const socketPlan = useCutoutSocketPlan();

  // The label floats over the darkened cutout fill, so derive its colors from
  // that fill's luminance — matching the darkening in `CutoutShapeMesh`. The
  // outline is the inverse, drawn as a halo so glyphs read on any fill.
  const { fill: labelFill, outline: labelOutline } = useMemo(
    () => cutoutLabelColors(binColor),
    [binColor]
  );

  return (
    <>
      {cutouts.map((cutout) => {
        if (cutout.hidden === true) return null;

        if (isCutoutSocketMode(cutout)) {
          const socket = socketPlan.byCutoutId.get(cutout.id);
          if (!socket) return null;
          const plateW = labelPlateWidthMm(socket.widthU);
          // The plan is memoised on committed params, so mid-drag it still
          // describes the grab-point position. Follow the live override by the
          // same delta the cutout (or its label nudge) has moved — both feed
          // the plan's placement 1:1, and the exact re-plan lands on release.
          const overrides = preview.get(cutout.id);
          const effective = overrides ? { ...cutout, ...overrides } : cutout;
          const dragX =
            effective.x - cutout.x + (effective.textOffset?.x ?? 0) - (cutout.textOffset?.x ?? 0);
          const dragY =
            effective.y - cutout.y + (effective.textOffset?.y ?? 0) - (cutout.textOffset?.y ?? 0);
          return (
            <CutoutSocketFootprint
              key={`socket-${cutout.id}`}
              // Plan centres are bin-centred; the editor's origin is the
              // interior corner, so shift by half the box the plan measured.
              centerX={socket.centerX + socketPlan.innerW / 2 + dragX}
              centerY={socket.centerY + socketPlan.innerD / 2 + dragY}
              // PLATE-frame extents, always: the footprint applies the
              // vertical rotation itself, so world-swapped extents here would
              // be rotated back and draw the plate on the wrong axis.
              widthMm={plateW}
              depthMm={LABEL_PLATE_HEIGHT_MM}
              cornerRadiusMm={LABEL_PLATE_CORNER_RADIUS_MM}
              text={socket.text}
              hasIcon={socket.icon !== undefined}
              vertical={socket.vertical}
              fill={labelOutline}
              textColor={labelFill}
              onPointerDown={
                onLabelDragStart ? (mmX, mmY) => onLabelDragStart(cutout.id, mmX, mmY) : undefined
              }
            />
          );
        }

        if (!isCutoutEngraveMode(cutout)) return null;
        const label = cutout.label.trim();
        if (label === '') return null;

        const overrides = preview.get(cutout.id);
        const effective = overrides ? { ...cutout, ...overrides } : cutout;

        const placement = cutoutLabelPlacement(effective, binWidth, binDepth);
        if (!placement) return null;

        const fontSize = fitLabelFontSize(
          label,
          placement,
          textDefaults,
          effective.textStyle?.fontSizeOverride
        );
        if (fontSize === null) return null;

        // Label angle about the glyph center (anchored center/middle). Negated
        // to match the cutout-rotation convention used everywhere else (see
        // CutoutShapeMesh `rotationZ`) and the engraver, so a positive angle
        // turns the same way as a positive cutout rotation.
        const angleRad = -((effective.textAngle ?? 0) * Math.PI) / 180;

        const handlePointerDown = onLabelDragStart
          ? (e: ThreeEvent<PointerEvent>) => {
              if (e.nativeEvent.button !== 0) return; // left-click only
              e.stopPropagation();
              onLabelDragStart(cutout.id, e.point.x, e.point.y);
            }
          : undefined;

        return (
          <Text
            key={`label-${cutout.id}`}
            position={[placement.centerX, placement.centerY, 0.05]}
            rotation={[0, 0, angleRad]}
            fontSize={fontSize}
            color={labelFill}
            fillOpacity={TEXT_OPACITY}
            outlineWidth={OUTLINE_WIDTH}
            outlineColor={labelOutline}
            outlineOpacity={1}
            anchorX="center"
            anchorY="middle"
            onPointerDown={handlePointerDown}
          >
            {label}
          </Text>
        );
      })}
    </>
  );
}
