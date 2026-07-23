/**
 * Lid-top text (issue #2695).
 *
 * Engraves, embosses, or through-cuts the design's surface text into the lid's
 * top face — or the tray floor when a tray recess is active (the recess owns
 * the visible surface then). Skipped entirely for stackable lids (the stack
 * grid owns the top) and polygon (cellMask) lids — both are gated upstream in
 * `resolveLidInputs`, so `inputs.text` is non-null only when text applies.
 *
 * Print orientation: `exportLid` flips non-tray lids 180° so the top face
 * prints against the bed — engraved text becomes crisp first-layer recesses
 * and embossed glyphs print bed-first under the plate. Tray lids follow the
 * existing tray orientation rules (`keepsNaturalOrientation`).
 */

import { unwrap, fuse, cut } from 'brepjs';
import type { Shape3D, DisposalScope, ValidSolid } from 'brepjs';
import { buildTextSolid } from './textBuilder';
import { FeatureTag } from './featureTags';
import { collectOrigins } from './pipeline/collectOrigins';
import type { LidInputs } from './lidInputs';

/** Solid floor kept below an engraving so it can't pierce into the mating
 *  cavity (plain top) or the enclosed lid interior (tray floor). Engrave
 *  depth is clamped against the host plate minus this. Through-cut mode
 *  pierces deliberately and ignores it. */
export const LID_TEXT_ENGRAVE_FLOOR = 0.4;

/** Effective engrave depth below which the cut is skipped as unprintable
 *  (and geometrically degenerate — the extrusion would be ~epsilon). */
const MIN_ENGRAVE_DEPTH = 0.05;

/**
 * Apply the resolved lid text to the built lid body. Returns the new body
 * (caller-owned via `scope`); returns the input unchanged when the text
 * doesn't fit (auto-fit floor exceeded) or the font isn't loaded — the
 * established silent-skip convention for undersized features.
 */
export function applyLidText(
  scope: DisposalScope,
  body: Shape3D,
  inputs: LidInputs,
  originToTag?: Map<number, number>
): Shape3D {
  const text = inputs.text;
  if (!text) return body;

  const tray = inputs.tray.enabled;
  const inset = tray ? inputs.tray.wallMm : 0;
  // The host face is a rounded rectangle; keeping the fit box clear of the
  // corner radius guarantees the text bbox never overhangs the rounded
  // outline (style margin applies additionally inside buildTextSolid).
  const cornerR = Math.max(inputs.lidCornerR - inset, 0);
  const availW = inputs.lidOuterW - 2 * inset - 2 * cornerR;
  const availD = inputs.lidOuterD - 2 * inset - 2 * cornerR;

  // Plate below the text surface: the full floor on a plain top, the shelled
  // remainder under a tray recess (`resolveLidPlateThickness` guarantees ≥ LID_TRAY_FLOOR).
  const topZ = tray ? -inputs.tray.depthMm : 0;
  const hostThickness = tray ? inputs.topThickness - inputs.tray.depthMm : inputs.topThickness;

  let depth = text.depth;
  if (text.mode === 'engrave') {
    depth = Math.min(depth, hostThickness - LID_TEXT_ENGRAVE_FLOOR);
    if (depth < MIN_ENGRAVE_DEPTH) return body;
  }

  const result = buildTextSolid(scope, {
    text: text.value,
    fontFamily: text.font,
    mode: text.mode,
    availW,
    availD,
    // Perimeter frame (lid gotcha 7): the text centers on the physical top
    // face, which shifts with asymmetric overhang — unlike grid-anchored
    // features (stack grid, magnet holes) that stay pinned to the origin.
    centerX: inputs.outerOffsetX,
    centerY: inputs.outerOffsetY,
    topZ,
    depth,
    hostThickness,
    margin: text.margin,
    minFontSize: text.minFontSize,
    maxFontSize: text.maxFontSize,
    ...(text.fontSizeOverride !== undefined ? { fontSizeOverride: text.fontSizeOverride } : {}),
  });
  if (!result) return body;

  // Tag before the boolean so glyph faces surface as TEXT in the mesh face
  // groups. The lid renders and exports as a single color zone today
  // (LidMesh / uniformColorConfig), so this is provenance only — it lets a
  // per-face lid color path light up later without regenerating meshes.
  if (originToTag) {
    collectOrigins(result.solid, FeatureTag.TEXT, originToTag);
  }

  scope.register(body);
  return result.op === 'fuse'
    ? unwrap(fuse(body as ValidSolid, result.solid as ValidSolid))
    : unwrap(cut(body as ValidSolid, result.solid as ValidSolid));
}
