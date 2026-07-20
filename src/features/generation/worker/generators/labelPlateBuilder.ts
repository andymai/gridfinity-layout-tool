/**
 * Swappable label plate generation (#2666, PR 2).
 *
 * Builds printable label plates matching the interchange spec pinned in
 * `@/shared/constants/labelPlates` — the mating half of the socket that
 * `labelTabBuilder` cuts into label tabs. Each plate is a single watertight
 * solid: body + perimeter latch groove + (on 1U) the standard's v1
 * backward-compat channels, with per-plate text embossed or debossed at a
 * layer-height-multiple depth so a single filament swap yields clean
 * two-color text. Plates print flat, no supports.
 *
 * Export mirrors `connectorSample.ts`: pieces → compound → STL/STEP.
 */

import {
  draw,
  cut,
  cutAll,
  fuse,
  clone,
  compound,
  mesh,
  exportSTEP,
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
  labelPlateWidthMm,
} from '@/shared/constants/labelPlates';
import type { LabelPlateWidthU } from '@/shared/constants/labelPlates';
import type { TextStyleDefaults } from '@/shared/types/bin';
import type { ExportFormat } from '../../bridge/types';
import { COPLANAR_MARGIN } from './generatorConstants';
import { sketch } from './meshUtils';
import { buildTextSolid } from './textBuilder';
import { buildBaseplateSTL } from './baseplateSTL';

/** One plate to build: standard width + the text it carries (may be empty). */
export interface LabelPlateSpec {
  readonly widthU: LabelPlateWidthU;
  readonly text: string;
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

/**
 * Build one plate as a single watertight solid, centered at the origin,
 * bottom on Z=0.
 */
export function buildLabelPlate(spec: LabelPlateSpec, opts: LabelPlateBuildOptions): Shape3D {
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

    // v1 backward-compat channels (1U only): T-profile in the XZ plane cut
    // through the full plate depth. Mouth at the bottom face widening into
    // the cavity — the profile the legacy sockets' bottom tabs ride in.
    if (opts.v1Channels && spec.widthU === 1) {
      const cutters = LABEL_PLATE_V1_CHANNEL_XS_MM.map((cx) => {
        const mouthHalf = LABEL_PLATE_V1_MOUTH_WIDTH_MM / 2;
        const cavityHalf = LABEL_PLATE_V1_CAVITY_WIDTH_MM / 2;
        const profile = draw([cx - mouthHalf, -COPLANAR_MARGIN])
          .lineTo([cx - mouthHalf, LABEL_PLATE_V1_MOUTH_HEIGHT_MM])
          .lineTo([cx - cavityHalf, LABEL_PLATE_V1_MOUTH_HEIGHT_MM])
          .lineTo([cx - cavityHalf, LABEL_PLATE_V1_CAVITY_TOP_MM])
          .lineTo([cx + cavityHalf, LABEL_PLATE_V1_CAVITY_TOP_MM])
          .lineTo([cx + cavityHalf, LABEL_PLATE_V1_MOUTH_HEIGHT_MM])
          .lineTo([cx + mouthHalf, LABEL_PLATE_V1_MOUTH_HEIGHT_MM])
          .lineTo([cx + mouthHalf, -COPLANAR_MARGIN])
          .close();
        const prism = sketch(profile, 'XZ', -(h / 2 + COPLANAR_MARGIN)).extrude(
          h + 2 * COPLANAR_MARGIN
        );
        return scope.register(prism);
      });
      solid = scope.register(unwrap(cutAll(solid as ValidSolid, cutters as ValidSolid[])));
    }

    // Text on the top face. Empty text yields a blank plate (still useful —
    // ecosystem plates can be relabeled with a marker or reprinted later).
    if (spec.text.trim().length > 0) {
      const result = buildTextSolid(scope, {
        text: spec.text,
        fontFamily: opts.textDefaults.font,
        mode: opts.textMode === 'emboss' ? 'emboss' : 'engrave',
        availW: w - 2 * TEXT_MARGIN,
        availD: h - 2 * TEXT_MARGIN,
        centerX: 0,
        centerY: 0,
        topZ: t,
        depth: opts.textDepthMm,
        hostThickness: t,
        margin: 0,
        minFontSize: opts.textDefaults.minFontSize,
        maxFontSize: opts.textDefaults.maxFontSize,
      });
      if (result) {
        try {
          const op = result.op === 'cut' ? cut : fuse;
          solid = scope.register(unwrap(op(solid as ValidSolid, result.solid as ValidSolid)));
        } catch {
          // Mirror the tab-text fallback: a glyph edge case must not tank
          // the whole plate — ship it blank instead.
        }
      }
    }

    return unwrap(clone(solid));
  });
}

/**
 * Build every plate, laid out bottom-on-bed in rows along Y with a gap —
 * ready to slice as one file. Returns non-fused separate solids.
 */
export function buildLabelPlates(
  specs: readonly LabelPlateSpec[],
  opts: LabelPlateBuildOptions
): Shape3D[] {
  const pitch = LABEL_PLATE_HEIGHT_MM + PLATE_GAP;
  const totalY = specs.length * pitch - PLATE_GAP;
  return specs.map((spec, i) => {
    const plate = buildLabelPlate(spec, opts);
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
): Promise<{ data: ArrayBuffer; fileName: string }> {
  if (specs.length === 0) {
    throw new Error('No label plates to export');
  }
  const pieces = buildLabelPlates(specs, opts);
  let assembled: Shape3D;
  try {
    assembled = compound(pieces);
  } finally {
    for (const p of pieces) p.delete();
  }

  try {
    const name = 'label_plates';
    if (format === 'step') {
      const blob = unwrap(exportSTEP(assembled));
      const data = await blob.arrayBuffer();
      return { data, fileName: `${name}.step` };
    }
    const meshResult = mesh(assembled, { tolerance: 0.05, angularTolerance: 10 });
    const data = buildBaseplateSTL(meshResult, name);
    return { data, fileName: `${name}.stl` };
  } finally {
    assembled.delete();
  }
}
