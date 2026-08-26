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
import {
  cutoutLabelPlacement,
  cutoutWorldAabb,
  expandBandToInterior,
  fitLabelRoom,
  hasExplicitLabelSize,
  labelPlacementForAabb,
  resolveCutoutTextAnchor,
} from '@/shared/utils/cutoutLabel';
import type { CutoutAabb } from '@/shared/utils/cutoutLabel';
import {
  cutoutSocketAnchorAabb,
  isCutoutEngraveMode,
  isCutoutSocketMode,
} from '@/shared/utils/cutoutLabelSocketPlan';
import { expandCutoutArray, labelledInstances } from '@/shared/utils/cutoutArray';
import {
  LABEL_PLATE_CORNER_RADIUS_MM,
  LABEL_PLATE_HEIGHT_MM,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import { useCutoutSocketPlan } from '@/features/bin-designer/hooks/useCutoutSocketPlan';
import { CutoutSocketFootprint } from './CutoutSocketFootprint';
import type { PreviewMap } from '../useCutoutInteraction';
import { cutoutLabelColors } from './cutoutLabelColor';
import { aabbsIntersect, estimateLabelAabb, fitLabelFontSize } from './cutoutLabelFit';
import { OFF_BOARD_COLOR } from './constants';

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

  // Pocket footprints for the explicit-size overlap warning: an exact-size
  // label that crosses a pocket loses the glyph parts over the opening, so its
  // halo goes red — same signal as the off-board frames. Committed positions
  // only; a drag preview warns after release.
  const pocketAabbs = useMemo(() => {
    const list: { id: string; aabb: CutoutAabb }[] = [];
    for (const c of cutouts) {
      if (c.hidden === true) continue;
      for (const instance of expandCutoutArray(c)) {
        list.push({ id: instance.id, aabb: cutoutWorldAabb(instance, 0, 0) });
      }
    }
    return list;
  }, [cutouts]);

  return (
    <>
      {cutouts.map((cutout) => {
        if (cutout.hidden === true) return null;

        if (isCutoutSocketMode(cutout)) {
          const socket = socketPlan.byCutoutId.get(cutout.id);
          if (!socket) return null;
          const plateW = labelPlateWidthMm(socket.widthU);
          // The plan is memoised on committed params, so mid-drag it still
          // describes the grab-point position. Recompute the placement from
          // the live override through the SAME anchor math the plan uses — a
          // raw position delta is not 1:1 on the anchor's gap axis, whose band
          // midpoint moves at half the cutout's rate, so a delta-followed
          // ghost led the cursor and snapped back on release.
          const overrides = preview.get(cutout.id);
          const effective = overrides ? { ...cutout, ...overrides } : cutout;
          const live = overrides
            ? labelPlacementForAabb(
                cutoutSocketAnchorAabb(effective, -socketPlan.innerW / 2, -socketPlan.innerD / 2),
                resolveCutoutTextAnchor(effective),
                effective.textOffset,
                socketPlan.innerW,
                socketPlan.innerD,
                -socketPlan.innerW / 2,
                -socketPlan.innerD / 2
              )
            : null;
          return (
            <CutoutSocketFootprint
              key={`socket-${cutout.id}`}
              // Plan centres are bin-centred; the editor's origin is the
              // interior corner, so shift by half the box the plan measured.
              centerX={(live?.centerX ?? socket.centerX) + socketPlan.innerW / 2}
              centerY={(live?.centerY ?? socket.centerY) + socketPlan.innerD / 2}
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

        const overrides = preview.get(cutout.id);
        const effective = overrides ? { ...cutout, ...overrides } : cutout;

        // Label angle about the glyph center (anchored center/middle). Negated
        // to match the cutout-rotation convention used everywhere else (see
        // CutoutShapeMesh `rotationZ`) and the engraver, so a positive angle
        // turns the same way as a positive cutout rotation.
        const angleRad = -((effective.textAngle ?? 0) * Math.PI) / 180;

        // Drag always nudges the MASTER: the offset is one field shared by
        // every instance, so grabbing the third label in a row has to move the
        // same value grabbing the first one does.
        const handlePointerDown = onLabelDragStart
          ? (e: ThreeEvent<PointerEvent>) => {
              if (e.nativeEvent.button !== 0) return; // left-click only
              e.stopPropagation();
              onLabelDragStart(cutout.id, e.point.x, e.point.y);
            }
          : undefined;

        // The override is applied BEFORE the expansion so a mid-drag repeat
        // carries its labels along; expanding the committed master first would
        // leave them behind at the grab point.
        return labelledInstances(effective).map((instance) => {
          const label = instance.label.trim();
          if (label === '') return null;

          const placement = cutoutLabelPlacement(instance, binWidth, binDepth);
          if (!placement) return null;

          // Same band the engraver uses, so the editor shows the size that
          // will actually be cut: an explicit size widens the band to the
          // interior, auto-fit keeps the anchor band capped to a repeat copy's
          // room.
          const explicit = hasExplicitLabelSize(instance.textStyle);
          const banded = explicit
            ? expandBandToInterior(placement, binWidth, binDepth)
            : {
                ...placement,
                ...fitLabelRoom(placement.availW, placement.availD, effective.array),
              };
          const fontSize = fitLabelFontSize(label, banded, textDefaults, instance.textStyle);
          if (fontSize === null) return null;

          // Explicit sizes are allowed to reach over pockets; warn where they
          // do, since glyph parts over an opening are cut away. A center
          // anchor's own pocket is exempt — sitting over it is the placement.
          // `::a0` is the master's own footprint when an unlabelled repeat
          // engraves once beside the master box.
          let overlapsPocket = false;
          if (explicit) {
            const box = estimateLabelAabb(
              label,
              fontSize,
              placement.centerX,
              placement.centerY,
              effective.textAngle ?? 0
            );
            const anchor = resolveCutoutTextAnchor(instance);
            const ownIds =
              anchor === 'center' ? new Set([instance.id, `${instance.id}::a0`]) : null;
            overlapsPocket = pocketAabbs.some(
              (p) => !ownIds?.has(p.id) && aabbsIntersect(p.aabb, box)
            );
          }

          return (
            <Text
              key={`label-${instance.id}`}
              position={[placement.centerX, placement.centerY, 0.05]}
              rotation={[0, 0, angleRad]}
              fontSize={fontSize}
              color={labelFill}
              fillOpacity={TEXT_OPACITY}
              outlineWidth={OUTLINE_WIDTH}
              outlineColor={overlapsPocket ? OFF_BOARD_COLOR : labelOutline}
              outlineOpacity={1}
              anchorX="center"
              anchorY="middle"
              onPointerDown={handlePointerDown}
            >
              {label}
            </Text>
          );
        });
      })}
    </>
  );
}
