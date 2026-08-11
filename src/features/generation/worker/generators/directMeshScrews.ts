/**
 * Mount-down screw hole emitter for the direct baseplate mesh (#3425).
 *
 * The BREP cutter in `baseplateScrews` and this emitter describe the same hole
 * from opposite ends: that build puts the plate's top face at Z=0 and grows
 * downward, while this mesh puts the slab bottom at Z=0 and grows up. Both read
 * `screwCutDepths`, which measures every feature DOWN FROM THE TOP FACE, and
 * each converts once, here in {@link addScrewHoleAt} and nowhere else.
 *
 * Pattern (per hole), mirroring `directMeshMagnets`:
 *   - Cancel disc CANCEL_EPSILON below the entry plane facing -Z, punching the
 *     surface the screw enters (top face for a margin site, pocket floor for a
 *     floor site) without z-fighting it.
 *   - Head recess band: a truncated cone (countersink) or a plain cylinder plus
 *     a shoulder annulus (counterbore).
 *   - Shaft band down to the underside, since a screw that stops inside the
 *     plate fastens nothing.
 *   - Cancel disc CANCEL_EPSILON above the slab bottom facing +Z, so the hole
 *     opens on the bottom face that the solid/lattice bottom covers.
 */

import type { ScrewHoleParams } from '@/core/types/baseplate';
import type { ScrewSite } from '@/shared/generation/screwHolePlan';
import { resolveScrewHeadDiameter, screwCutDepths } from '@/shared/generation/screwHolePlan';
import { SOCKET_HEIGHT } from './generatorTypes';
import type { MeshBuilder } from './directMeshBuilder';
import { CANCEL_EPSILON, CIRCLE_SEGMENTS } from './directMeshBuilder';
import { circlePoints } from './directMeshShapes';

type UnitCircle = ReadonlyArray<readonly [number, number]>;

/** Below this a band or shoulder is degenerate and would emit zero-area quads. */
const MIN_FEATURE_MM = 1e-6;

/** Horizontal disc, wound so its face points along `facing`. */
function addDisc(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  z: number,
  radius: number,
  facing: 1 | -1,
  unit: UnitCircle
): void {
  const center = mb.pushVertex(cx, cy, z, 0, 0, facing);
  const rim = new Array<number>(unit.length);
  for (let i = 0; i < unit.length; i++) {
    rim[i] = mb.pushVertex(cx + unit[i][0] * radius, cy + unit[i][1] * radius, z, 0, 0, facing);
  }
  for (let i = 0; i < rim.length; i++) {
    const j = (i + 1) % rim.length;
    if (facing > 0) mb.pushTriangle(center, rim[i], rim[j]);
    else mb.pushTriangle(center, rim[j], rim[i]);
  }
}

/** Inward-facing wall band between two coaxial rings. */
function addBand(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  rTop: number,
  zTop: number,
  rBot: number,
  zBot: number,
  unit: UnitCircle
): void {
  const top = new Array<number>(unit.length);
  const bot = new Array<number>(unit.length);
  for (let i = 0; i < unit.length; i++) {
    const [ux, uy] = unit[i];
    top[i] = mb.pushVertex(cx + ux * rTop, cy + uy * rTop, zTop, 0, 0, 0);
    bot[i] = mb.pushVertex(cx + ux * rBot, cy + uy * rBot, zBot, 0, 0, 0);
  }
  for (let i = 0; i < unit.length; i++) {
    const j = (i + 1) % unit.length;
    mb.pushQuad(top[j], top[i], bot[i], bot[j]);
  }
}

/** Flat ring facing +Z: the shoulder a counterbore's head seats on. */
function addAnnulus(
  mb: MeshBuilder,
  cx: number,
  cy: number,
  z: number,
  rOuter: number,
  rInner: number,
  unit: UnitCircle
): void {
  const outer = new Array<number>(unit.length);
  const inner = new Array<number>(unit.length);
  for (let i = 0; i < unit.length; i++) {
    const [ux, uy] = unit[i];
    outer[i] = mb.pushVertex(cx + ux * rOuter, cy + uy * rOuter, z, 0, 0, 1);
    inner[i] = mb.pushVertex(cx + ux * rInner, cy + uy * rInner, z, 0, 0, 1);
  }
  for (let i = 0; i < unit.length; i++) {
    const j = (i + 1) % unit.length;
    mb.pushQuad(outer[i], outer[j], inner[j], inner[i]);
  }
}

/**
 * Emit a single mount-down screw hole at absolute (sx, sy).
 *
 * `totalHeightMm` is the plate's printed height, so the entry plane lands on the
 * top face for a margin site and on the pocket floor for a floor site.
 */
export function addScrewHoleAt(
  mb: MeshBuilder,
  sx: number,
  sy: number,
  site: ScrewSite,
  params: ScrewHoleParams,
  totalHeightMm: number
): void {
  const { entryBelowTop, recessDepth, throughDepth } = screwCutDepths(
    params,
    site,
    SOCKET_HEIGHT,
    totalHeightMm
  );
  if (throughDepth <= 0) return;

  const zEntry = totalHeightMm - entryBelowTop;
  const zBottom = zEntry - throughDepth;

  const shaftRadius = params.diameter / 2;
  const headRadius = resolveScrewHeadDiameter(params.headStyle, params.headDiameter) / 2;
  // The plate provisions the pad, so the recess normally fits with retaining
  // material to spare. The clamp matters only for a plate handed none: the BREP
  // cut just removes nothing below the underside there, and the draft must not
  // hang a cone under the plate instead.
  const recess = Math.max(0, Math.min(recessDepth, throughDepth));
  const zRecess = zEntry - recess;
  const recessRatio = recessDepth > 0 ? recess / recessDepth : 1;
  const recessBottomRadius =
    params.headStyle === 'counterbore'
      ? headRadius
      : headRadius + (shaftRadius - headRadius) * recessRatio;
  const entryRadius = recess > 0 ? headRadius : shaftRadius;
  const hasShaft = zRecess - zBottom > MIN_FEATURE_MM;
  const exitRadius = hasShaft ? shaftRadius : recessBottomRadius;

  const unit = circlePoints(1, CIRCLE_SEGMENTS);

  addDisc(mb, sx, sy, zEntry - CANCEL_EPSILON, entryRadius, -1, unit);

  if (recess > 0) {
    addBand(mb, sx, sy, entryRadius, zEntry, recessBottomRadius, zRecess, unit);
    if (hasShaft && recessBottomRadius - shaftRadius > MIN_FEATURE_MM) {
      addAnnulus(mb, sx, sy, zRecess, recessBottomRadius, shaftRadius, unit);
    }
  }

  if (hasShaft) {
    addBand(mb, sx, sy, shaftRadius, zRecess, shaftRadius, zBottom, unit);
  }

  addDisc(mb, sx, sy, zBottom + CANCEL_EPSILON, exitRadius, 1, unit);
}
