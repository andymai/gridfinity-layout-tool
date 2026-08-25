/**
 * Swappable label plate generation.
 *
 * Builds printable label plates matching the interchange spec pinned in
 * `@/shared/constants/labelPlates` — the mating half of the socket that
 * `labelTabBuilder` cuts into label tabs. Each plate is a single watertight
 * solid: body + perimeter latch groove + (on 1U) the standard's v1
 * backward-compat channels, with per-plate text embossed or debossed at a
 * layer-height-multiple depth so a single filament swap yields clean
 * two-color text. Plates print flat, no supports.
 *
 * Export mirrors `connectorSample.ts` (pieces → one STL/STEP), but fuses the
 * disjoint plates instead of compounding so face-origin metadata survives —
 * TEXT-tagged glyph faces ride along as `faceGroups` for 3MF paint_color.
 */

import {
  draw,
  cut,
  cutAll,
  fuse,
  fuseAll,
  mesh,
  exportSTEP,
  setShapeOrigin,
  translate,
  unwrap,
  withScope,
} from 'brepjs';
import type { Shape3D, ValidSolid, Drawing, DisposalScope } from 'brepjs';
import {
  LABEL_PLATE_CORNER_RADIUS_MM,
  LABEL_PLATE_HEIGHT_MM,
  LABEL_PLATE_LATCH_BAND_MM,
  LABEL_PLATE_LATCH_INSET_MM,
  LABEL_PLATE_LATCH_START_MM,
  LABEL_PLATE_THICKNESS_MM,
  LABEL_PLATE_V1_CAVITY_TOP_MM,
  LABEL_PLATE_V1_CAVITY_WIDTH_MM,
  LABEL_PLATE_V1_CHANNEL_XS_MM,
  LABEL_PLATE_V1_MOUTH_HEIGHT_MM,
  LABEL_PLATE_V1_MOUTH_WIDTH_MM,
  labelPlateV1ChannelsFitText,
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import type { LabelPlateIconId, LabelPlateWidthU } from '@/shared/constants/labelPlates';
import { splitTextLines } from '@/shared/types/bin';
import type { TextStyleDefaults } from '@/shared/types/bin';
import type { ExportFormat, FaceGroupData } from '../../bridge/types';
import { COPLANAR_MARGIN } from './generatorConstants';
import { FeatureTag } from './featureTags';
import { sketch } from './meshUtils';
import { buildTextSolid, fitTextSize, type ResolvedTextStyle } from './textBuilder';
import { buildIconSolid, measureIconBox } from './labelPlateIcons';
import { buildBaseplateSTL } from './baseplateSTL';
import { PREVIEW_ANGULAR_TOLERANCE_RAD } from './utils/tolerances';

/** One plate to build: standard width + the text it carries (may be empty). */
export interface LabelPlateSpec {
  readonly widthU: LabelPlateWidthU;
  readonly text: string;
  /** Hardware icon rendered beside the text. */
  readonly icon?: LabelPlateIconId;
  /** Plate center on the bed (mm); absent = single centered column layout. */
  readonly position?: readonly [number, number];
}

export interface LabelPlateBuildOptions {
  /** Raised or recessed text. */
  readonly textMode: 'emboss' | 'deboss';
  /** Text depth in mm — already snapped to a whole layer-height multiple. */
  readonly textDepthMm: number;
  readonly textDefaults: TextStyleDefaults;
  /**
   * Cut the standard's v1 backward-compat channels into 1U plate
   * undersides (the ecosystem default — plates then fit v1 sockets too).
   */
  readonly v1Channels: boolean;
}

/** Gap between plates on the bed (mm). */
const PLATE_GAP = 4;
/** Keep text clear of the latch flanges. */
const TEXT_MARGIN = 1.6;
/** Readable band between the latch flanges — what both text and icon fill. */
export const TEXT_BAND_MM = LABEL_PLATE_HEIGHT_MM - 2 * TEXT_MARGIN;

/** The band between the latch flanges IS the readable area, so fill it with
 *  glyph ink rather than the font's ascender..descender band (~54% inked for an
 *  all-caps run). */
/**
 * A plate's readable band already excludes the latch flanges, so the design's
 * margin would inset the caption a second time. Height is bound by the band and
 * width by the plate, both handed over as the host box.
 */
const PLATE_TEXT_MARGIN = 0;

/**
 * Stand-in for "width is not the binding constraint" when resolving one size
 * across a set. Finite so the plan's coordinates stay finite; only the size it
 * returns is read.
 */
const UNBOUNDED_WIDTH_MM = 1e6;

/** The plate's effective style: the design's type with the plate's own mode and
 *  band inset. */
function plateTextStyle(opts: LabelPlateBuildOptions): ResolvedTextStyle {
  return { ...opts.textDefaults, mode: plateTextMode(opts), margin: PLATE_TEXT_MARGIN };
}
/**
 * Width ceiling for an icon (mm) and its gap to the text. Side-view fasteners
 * are ~1.5-1.9x wider than tall, so an uncapped fit to the band would spend a
 * third of a 1U plate's text run on the silhouette.
 *
 * 11.5 is where a bolt — the widest silhouette that still reaches band height
 * — stops being width-bound, at a cost of ~9% of the text run. Raising it
 * further only grows the wider outliers (nail, wood screw) while shrinking
 * every label's text.
 */
export const ICON_MAX_WIDTH_MM = 11.5;
const ICON_TEXT_GAP = 1.2;

/**
 * The width a plate's caption actually gets, after the latch margins and any
 * icon sharing the band. Mirrors the `textLeft`/`textRight` budget
 * {@link buildLabelPlate} hands `buildTextSolid`; callers that need to know
 * whether a caption fits must measure against this, not the plate width.
 */
function plateTextHostWidthMm(
  widthU: LabelPlateWidthU,
  icon: LabelPlateIconId | undefined
): number {
  const w = labelPlateWidthMm(widthU);
  const box = icon === undefined ? null : measureIconBox(icon, TEXT_BAND_MM, ICON_MAX_WIDTH_MM);
  const textLeft = box ? -w / 2 + TEXT_MARGIN + box.widthMm + ICON_TEXT_GAP : -w / 2 + TEXT_MARGIN;
  return w / 2 - TEXT_MARGIN - textLeft;
}

/**
 * Whether a plate's caption will render at all.
 *
 * `buildLabelPlate` ships a blank plate when the run overflows its width — a
 * deliberate choice so one long caption can't shrink the whole set, but one
 * with no trace in the mesh. Callers use this to say so before the print.
 */
export function plateTextFits(spec: LabelPlateSpec, opts: LabelPlateBuildOptions): boolean {
  if (!spec.text.trim()) return true;
  return (
    fitTextSize({
      text: spec.text,
      style: plateTextStyle(opts),
      availW: plateTextHostWidthMm(spec.widthU, spec.icon),
      availD: TEXT_BAND_MM,
    }) !== null
  );
}

/**
 * Plan-view cutter for one v1 channel layer: a slot of width `w` centered at
 * `cx` spanning ±`flareY`, flaring outward with radius `r` at both ends and
 * continuing at the flared width to ±`earY` (past the plate, so the cut
 * always exits cleanly). The flare reproduces the r0.5 segment-corner
 * rounding of the standard's v1 plate.
 */
function flaredSlot(cx: number, w: number, flareY: number, earY: number, r: number): Drawing {
  // The ear must extend past the fillet tangent point (which sits exactly r
  // from the wall) or the corner fillet consumes its whole neighbor segment
  // and degenerates. The slack region only ever overlaps already-void space
  // (outside the plate / inside the latch groove).
  const slack = r;
  const wallR = cx + w / 2;
  const earR = wallR + r + slack;
  const wallL = cx - w / 2;
  const earL = wallL - r - slack;
  return draw([cx, -earY])
    .lineTo([earR, -earY])
    .lineTo([earR, -flareY])
    .lineTo([wallR, -flareY])
    .customCorner(r)
    .lineTo([wallR, flareY])
    .customCorner(r)
    .lineTo([earR, flareY])
    .lineTo([earR, earY])
    .lineTo([earL, earY])
    .lineTo([earL, flareY])
    .lineTo([wallL, flareY])
    .customCorner(r)
    .lineTo([wallL, -flareY])
    .customCorner(r)
    .lineTo([earL, -flareY])
    .lineTo([earL, -earY])
    .close();
}

function roundedRect(w: number, h: number, r: number): Drawing {
  const x0 = -w / 2;
  const x1 = w / 2;
  const y0 = -h / 2;
  const y1 = h / 2;
  return draw([0, y0])
    .lineTo([x1, y0])
    .customCorner(r)
    .lineTo([x1, y1])
    .customCorner(r)
    .lineTo([x0, y1])
    .customCorner(r)
    .lineTo([x0, y0])
    .customCorner(r)
    .close();
}

/** `deboss` is the plate spelling of an engraved cut. */
function plateTextMode(opts: LabelPlateBuildOptions): 'emboss' | 'engrave' {
  return opts.textMode === 'emboss' ? 'emboss' : 'engrave';
}

/**
 * One text size for a set of plates, measured on the vertical axis only: the
 * smallest size at which any plate's caption still fits the shared band.
 *
 * Only the band is common to the set. Plate widths are 36/78/120mm, so folding
 * width in would shrink a 3U plate's text to whatever a 1U plate could hold.
 * Each plate's own width budget still caps it inside `buildTextSolid`; a plate
 * whose run cannot fit its width shrinks alone rather than dragging the others
 * down.
 *
 * Under the cap-height datum the vertical box is a constant of the face and
 * size, so every single-line caption in a set resolves to the SAME value here
 * and this pass reads as a no-op. It is kept because it is the thing that
 * states the intent: a set shares one size. Were the band or the face ever to
 * vary per plate, this is where that would be resolved rather than discovered.
 *
 * Multi-line captions sit out. Two lines genuinely need a smaller size in the
 * shared band, so folding one in would shrink every other plate in the set to
 * match it — the same "drags the others down" the width axis is kept out for.
 * They auto-fit alone instead, which lands them on a common size anyway
 * whenever they share a line count.
 *
 * `undefined` when no plate carries text, leaving per-plate auto-fit.
 */
export function resolveUniformPlateTextSize(
  specs: readonly LabelPlateSpec[],
  opts: LabelPlateBuildOptions
): number | undefined {
  let smallest = Number.POSITIVE_INFINITY;
  for (const spec of specs) {
    if (!spec.text.trim()) continue;
    if (splitTextLines(spec.text).length > 1) continue;
    const fitted = fitTextSize({
      text: spec.text,
      style: plateTextStyle(opts),
      availW: UNBOUNDED_WIDTH_MM,
      availD: TEXT_BAND_MM,
      allowWrap: false,
    });
    if (fitted !== null) smallest = Math.min(smallest, fitted);
  }
  return Number.isFinite(smallest) ? smallest : undefined;
}

/**
 * Build one plate as a single watertight solid, centered at the origin,
 * bottom on Z=0.
 *
 * `uniformTextSize` caps the auto-fit so a set of plates built together shares
 * one size; omit it for a standalone plate.
 */
export function buildLabelPlate(
  spec: LabelPlateSpec,
  opts: LabelPlateBuildOptions,
  uniformTextSize?: number
): Shape3D {
  return withScope((scope: DisposalScope): Shape3D => {
    const w = labelPlateWidthMm(spec.widthU);
    const h = LABEL_PLATE_HEIGHT_MM;
    const t = LABEL_PLATE_THICKNESS_MM;
    const inset = LABEL_PLATE_LATCH_INSET_MM;

    let solid: Shape3D = scope.register(
      sketch(roundedRect(w, h, LABEL_PLATE_CORNER_RADIUS_MM), 'XY', 0).extrude(t)
    );

    // Perimeter latch groove: ring = full footprint minus the inset inner
    // footprint, spanning the latch band. Cutting the ring (rather than
    // stacking three slabs) keeps the plate one clean solid.
    const outerBand = scope.register(
      sketch(
        roundedRect(w + COPLANAR_MARGIN, h + COPLANAR_MARGIN, LABEL_PLATE_CORNER_RADIUS_MM),
        'XY',
        LABEL_PLATE_LATCH_START_MM
      ).extrude(LABEL_PLATE_LATCH_BAND_MM)
    );
    const innerBand = scope.register(
      sketch(
        roundedRect(w - 2 * inset, h - 2 * inset, LABEL_PLATE_CORNER_RADIUS_MM - inset),
        'XY',
        LABEL_PLATE_LATCH_START_MM - COPLANAR_MARGIN
      ).extrude(LABEL_PLATE_LATCH_BAND_MM + 2 * COPLANAR_MARGIN)
    );
    const ring = scope.register(unwrap(cut(outerBand as ValidSolid, innerBand as ValidSolid)));
    solid = scope.register(unwrap(cut(solid as ValidSolid, ring)));

    // v1 backward-compat channels (1U only): the profile the legacy sockets'
    // bottom tabs ride in — a narrow mouth at the bottom face widening into
    // the cavity. Cut as two stacked plan-view prisms per channel so the
    // channel ends can flare r0.5 like the standard's rounded segments
    // (Cullenect.scad builds the v1 plate from RoundedCubes; the flare
    // doubles as a lead-in for the tabs). The mouth spans the full plate
    // depth and flares at the outline; the cavity ends at the latch inset
    // and flares there, opening into the perimeter latch groove.
    const hasText = spec.text.trim().length > 0;
    const hasMarkings = hasText || spec.icon !== undefined;
    // A blank plate always keeps the channels; a marked one only when the
    // markings can't breach the cavity roof (`labelPlateV1ChannelsFitText`).
    const withV1Channels =
      opts.v1Channels &&
      spec.widthU === 1 &&
      (!hasMarkings || labelPlateV1ChannelsFitText(opts.textMode, opts.textDepthMm));

    if (withV1Channels) {
      const flareR = LABEL_PLATE_CORNER_RADIUS_MM;
      const earY = h / 2 + COPLANAR_MARGIN;
      const cutters = LABEL_PLATE_V1_CHANNEL_XS_MM.flatMap((cx) => {
        // The mouth prism runs up to the cavity top: its plan silhouette is
        // strictly inside the cavity's, so everything above the mouth zone
        // is already removed by the cavity cut — no separate top margin
        // needed, and the mouth/cavity boundary can't leave a coplanar seam.
        const mouth = sketch(
          flaredSlot(cx, LABEL_PLATE_V1_MOUTH_WIDTH_MM, h / 2, earY, flareR),
          'XY',
          -COPLANAR_MARGIN
        ).extrude(LABEL_PLATE_V1_CAVITY_TOP_MM + COPLANAR_MARGIN);
        const cavity = sketch(
          flaredSlot(
            cx,
            LABEL_PLATE_V1_CAVITY_WIDTH_MM,
            h / 2 - LABEL_PLATE_LATCH_INSET_MM,
            earY,
            flareR
          ),
          'XY',
          LABEL_PLATE_V1_MOUTH_HEIGHT_MM
        ).extrude(LABEL_PLATE_V1_CAVITY_TOP_MM - LABEL_PLATE_V1_MOUTH_HEIGHT_MM);
        return [scope.register(mouth), scope.register(cavity)];
      });
      solid = scope.register(unwrap(cutAll(solid as ValidSolid, cutters as ValidSolid[])));
    }

    // Hardware icon beside the text: band-height, its width
    // set by its own aspect, at the left margin — centered when the plate
    // carries no text. Best-effort like the text: a failed icon boolean ships
    // the plate without it, and the text only shifts right by the width the
    // icon actually took.
    let iconApplied = false;
    let iconWidth = 0;
    if (spec.icon !== undefined) {
      try {
        const box = measureIconBox(spec.icon, TEXT_BAND_MM, ICON_MAX_WIDTH_MM);
        const icon = box
          ? buildIconSolid({
              icon: spec.icon,
              heightMm: TEXT_BAND_MM,
              maxWidthMm: ICON_MAX_WIDTH_MM,
              centerX: hasText ? -w / 2 + TEXT_MARGIN + box.widthMm / 2 : 0,
              centerY: 0,
              topZ: t,
              depthMm: opts.textDepthMm,
              mode: opts.textMode,
            })
          : null;
        if (icon && box) {
          iconWidth = box.widthMm;
          scope.register(icon.solid);
          // Icons take the text color in paint_color mapping — they are
          // markings, same as glyphs.
          setShapeOrigin(icon.solid, FeatureTag.TEXT);
          const op = icon.op === 'cut' ? cut : fuse;
          solid = scope.register(unwrap(op(solid as ValidSolid, icon.solid as ValidSolid)));
          iconApplied = true;
        }
      } catch {
        // ship the plate without the icon
      }
    }

    // Text on the top face, shifted right of the icon when one is present.
    // Empty text yields a blank plate (still useful — ecosystem plates can
    // be relabeled with a marker or reprinted later).
    if (hasText) {
      const textLeft = iconApplied
        ? -w / 2 + TEXT_MARGIN + iconWidth + ICON_TEXT_GAP
        : -w / 2 + TEXT_MARGIN;
      const textRight = w / 2 - TEXT_MARGIN;
      const result = buildTextSolid(scope, {
        text: spec.text,
        style: plateTextStyle(opts),
        availW: textRight - textLeft,
        availD: TEXT_BAND_MM,
        centerX: (textLeft + textRight) / 2,
        centerY: 0,
        topZ: t,
        depth: opts.textDepthMm,
        hostThickness: t,
        ...(uniformTextSize !== undefined ? { sharedSizeMm: uniformTextSize } : {}),
        hostKind: 'plaque',
      });
      if (result) {
        try {
          // Tag the text solid so its faces survive the boolean carrying
          // FeatureTag.TEXT — the 3MF paint_color mapping colors exactly
          // these triangles the text color (raised glyph faces on emboss,
          // cavity faces on deboss).
          setShapeOrigin(result.solid, FeatureTag.TEXT);
          const op = result.op === 'cut' ? cut : fuse;
          solid = scope.register(unwrap(op(solid as ValidSolid, result.solid as ValidSolid)));
        } catch {
          // Mirror the tab-text fallback: a glyph edge case must not tank
          // the whole plate — ship it blank instead.
        }
      }
    }

    // Identity translate instead of clone(): both deep-copy the solid out of
    // the disposal scope, but clone() drops the face-origin metadata the
    // paint_color mapping needs, while translate propagates it.
    return translate(solid, [0, 0, 0]);
  });
}

/**
 * Build every plate, laid out bottom-on-bed in rows along Y with a gap —
 * ready to slice as one file. Returns non-fused separate solids.
 *
 * Every plate in the set shares one text size, so a bin's plates read as a set
 * rather than each filling its own band.
 */
export function buildLabelPlates(
  specs: readonly LabelPlateSpec[],
  opts: LabelPlateBuildOptions
): Shape3D[] {
  const pitch = LABEL_PLATE_HEIGHT_MM + PLATE_GAP;
  const totalY = specs.length * pitch - PLATE_GAP;
  const uniformTextSize = resolveUniformPlateTextSize(specs, opts);
  return specs.map((spec, i) => {
    const plate = buildLabelPlate(spec, opts, uniformTextSize);
    const [x, y] = spec.position ?? [0, -totalY / 2 + LABEL_PLATE_HEIGHT_MM / 2 + i * pitch];
    const placed = translate(plate, [x, y, 0]);
    plate.delete();
    return placed;
  });
}

/**
 * Export the plate set as STL or STEP. Mirrors `exportConnectorSample`'s
 * compound + coarse-tolerance tessellation (plate faces are planar; the
 * fine default only bloats the rounded corners and glyph outlines).
 */
export async function exportLabelPlates(
  specs: readonly LabelPlateSpec[],
  opts: LabelPlateBuildOptions,
  format: ExportFormat
): Promise<{ data: ArrayBuffer; fileName: string; faceGroups?: readonly FaceGroupData[] }> {
  if (specs.length === 0) {
    throw new Error('No label plates to export');
  }
  const pieces = buildLabelPlates(specs, opts);
  let assembled: Shape3D;
  if (pieces.length === 1) {
    // fuseAll would hand back this same handle — keep it directly so the
    // pieces cleanup below can't free the shape we are about to mesh.
    assembled = pieces[0];
  } else {
    try {
      // fuseAll instead of compound(): the plates are disjoint so the result
      // is geometrically identical, but fuseAll propagates the face-origin
      // metadata (compound is a raw builder that drops it) — without which
      // the TEXT faces can't be mapped to paint_color materials.
      assembled = unwrap(fuseAll(pieces as ValidSolid[]));
    } finally {
      for (const p of pieces) p.delete();
    }
  }

  try {
    const name = 'label_plates';
    if (format === 'step') {
      const blob = unwrap(exportSTEP(assembled));
      const data = await blob.arrayBuffer();
      return { data, fileName: `${name}.step` };
    }
    const meshResult = mesh(assembled, {
      tolerance: 0.05,
      angularTolerance: PREVIEW_ANGULAR_TOLERANCE_RAD,
    });
    // Face provenance for STL→3MF paint_color: TEXT-tagged glyph faces map
    // to the text color, everything else to the plate color. The STL below
    // writes from this same tessellation, so the ranges stay aligned.
    const faceGroups: FaceGroupData[] = meshResult.faceGroups.map((g) => ({
      start: g.start,
      count: g.count,
      tag: g.origin === FeatureTag.TEXT ? FeatureTag.TEXT : FeatureTag.UNKNOWN,
    }));
    const data = buildBaseplateSTL(meshResult, name);
    return { data, fileName: `${name}.stl`, faceGroups };
  } finally {
    assembled.delete();
  }
}
