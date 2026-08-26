/**
 * Lid-top text.
 *
 * Engraves, embosses, or through-cuts the design's surface text into the lid's
 * top face — or the tray floor when a tray recess is active (the recess owns
 * the visible surface then), or the recessed floor inside the lip on a lip-only
 * stack top. Skipped entirely for FULL stack grids (no flat face left)
 * and polygon (cellMask) lids — both are gated upstream in `resolveLidInputs`,
 * so `inputs.text` is non-null only when text applies.
 *
 * Note that on a lip-only top an EMBOSS raises glyphs off the same floor a
 * stacked bin's feet land on, so the bin no longer seats flat. The panel warns;
 * the geometry is left to the user, matching how through-cut is handled.
 *
 * Print orientation: `exportLid` flips non-tray lids 180° so the top face
 * prints against the bed — engraved text becomes crisp first-layer recesses
 * and embossed glyphs print bed-first under the plate. Tray lids follow the
 * existing tray orientation rules (`keepsNaturalOrientation`).
 */

import { unwrap, fuse, cut } from 'brepjs';
import type { Shape3D, DisposalScope, ValidSolid } from 'brepjs';
import { buildTextSolid } from './textBuilder';
import { pocketCornerRadius } from './generatorConstants';
import { LID_MIN_CORNER_RADIUS } from './lidConstants';
import { STACK_INSET_BOT } from './lidStackGrid';
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
export const MIN_ENGRAVE_DEPTH = 0.05;

interface TextHostFace {
  readonly availW: number;
  readonly availD: number;
  readonly centerX: number;
  readonly centerY: number;
  readonly topZ: number;
  readonly hostThickness: number;
}

function resolveTextHostFace(inputs: LidInputs): TextHostFace {
  // Lip-only stack top: the text sits on the recessed floor inside the
  // lip. That floor is GRID-anchored — the pocket is cut from the nominal
  // socket grid, not the overhang-shifted perimeter — so its fit box and centre
  // come from the grid frame. Deriving them from `lidOuterW`/`outerOffset`
  // would drift the text off-centre by the overhang and let it run under the
  // lip on the grown side.
  if (inputs.stackLipOnly) {
    const totalW = inputs.cellsX * inputs.gridUnitMm;
    const totalD = inputs.cellsY * inputs.gridUnitMmY;
    // Same LID_MIN_CORNER_RADIUS floor `buildStackLipCutter` applies, so the
    // fit box can never assume squarer corners than the floor actually has.
    const cornerR = Math.max(
      pocketCornerRadius(totalW, totalD) - STACK_INSET_BOT,
      LID_MIN_CORNER_RADIUS
    );
    return {
      availW: totalW - 2 * STACK_INSET_BOT - 2 * cornerR,
      availD: totalD - 2 * STACK_INSET_BOT - 2 * cornerR,
      centerX: 0,
      centerY: 0,
      topZ: 0,
      hostThickness: inputs.topThickness,
    };
  }

  const tray = inputs.tray.enabled;
  const inset = tray ? inputs.tray.wallMm : 0;
  // The host face is a rounded rectangle; keeping the fit box clear of the
  // corner radius guarantees the text bbox never overhangs the rounded
  // outline (style margin applies additionally inside buildTextSolid).
  const cornerR = Math.max(inputs.lidCornerR - inset, 0);
  return {
    availW: inputs.lidOuterW - 2 * inset - 2 * cornerR,
    availD: inputs.lidOuterD - 2 * inset - 2 * cornerR,
    // Perimeter frame (lid gotcha 7): the text centers on the physical top
    // face, which shifts with asymmetric overhang.
    centerX: inputs.outerOffsetX,
    centerY: inputs.outerOffsetY,
    // Plate below the text surface: the full floor on a plain top, the shelled
    // remainder under a tray recess (`resolveLidPlateThickness` guarantees
    // ≥ LID_TRAY_FLOOR).
    topZ: tray ? -inputs.tray.depthMm : 0,
    hostThickness: tray ? inputs.topThickness - inputs.tray.depthMm : inputs.topThickness,
  };
}

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

  const { availW, availD, centerX, centerY, topZ, hostThickness } = resolveTextHostFace(inputs);

  let depth = text.style.depth;
  if (text.style.mode === 'engrave') {
    depth = Math.min(depth, hostThickness - LID_TEXT_ENGRAVE_FLOOR);
    if (depth < MIN_ENGRAVE_DEPTH) return body;
  }

  const result = buildTextSolid(scope, {
    text: text.value,
    style: text.style,
    availW,
    availD,
    centerX,
    centerY,
    topZ,
    depth,
    hostThickness,
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
