/**
 * Cutout/handle/ramp clipping passes for wall hex patterns.
 *
 * `applyWallPatternClips` takes ownership of the base hex compound and
 * applies cutout, handle, and ramp-zone clipping. All clip solids for a
 * wall are pre-fused into a single tool so the kernel only sees ONE
 * `cut(base, allClips)` per wall instead of up to three sequential cuts.
 * That collapses both the boolean count and the intermediate-shape
 * allocations that the chained-cut path used to leak.
 *
 * Each clip box is at least as deep as the hex prism extrusion so it
 * fully envelops hex prisms at junction/cutout boundaries (#1354).
 */

import { drawRectangle, unwrap, cut, translate, rotate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { WallPatternDescriptor } from './wallPatterns';
import { sketch } from './meshUtils';
import { isAbortError } from './utils/abort';
import { CUTOUT_BORDER_WIDTH } from './wallPatterns';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import { buildSingleCutout } from './featureBuilder';
import { fuseAllOrNull } from './utils/shapeOps';
import type { CutoutClipParams, HandleClipParams, RampZoneClipParams } from './wallPatternTypes';

/**
 * Build the cutout clip solid for a wall.
 *
 * Returns null when the cutout config is absent or below the geometric
 * floor that the original chained path was already silently skipping
 * (cut dims < 0.1 mm). Caller owns the returned shape.
 */
function buildCutoutClipSolid(wall: WallPatternDescriptor, clip: CutoutClipParams): Shape3D | null {
  if (clip.cutWidth < 0.1 || clip.userCutHeight < 0.1) return null;

  const rotateZ = wall.side === 'left' || wall.side === 'right' ? 90 : 0;
  const centerOffset = computeCutoutCenter(
    clip.wallSpan,
    clip.cutWidth,
    clip.wallThickness,
    clip.cutoutCfg.alignment,
    clip.cutoutCfg.offset
  );

  return buildSingleCutout(
    clip.wallShape,
    clip.expandedWidth,
    clip.expandedHeight,
    clip.clipOvershoot,
    clip.clipExtrudeDepth,
    clip.wallHeight,
    {
      x: rotateZ === 0 ? wall.translateX + centerOffset : wall.translateX,
      y: rotateZ !== 0 ? wall.translateY + centerOffset : wall.translateY,
      rotateZ,
    }
  );
}

/**
 * Build one positioned box per handle segment.
 *
 * Each transform allocates a new WASM handle while the previous becomes
 * garbage; intermediates are disposed so only the final box per segment
 * survives in the returned array. Caller owns the array entries.
 *
 * If a transform throws mid-loop, every box built so far is disposed
 * before re-throwing — otherwise the caller's outer catch never sees
 * the partial array (since `.push(...fn())` only spreads on success)
 * and the WASM handles leak.
 */
function buildHandleClipBoxes(handleClip: HandleClipParams): Shape3D[] {
  const border = CUTOUT_BORDER_WIDTH;
  const hw = handleClip.handleWall;
  const out: Shape3D[] = [];
  try {
    for (const seg of handleClip.segments) {
      const boxW = seg.width + 2 * border;
      const boxH = handleClip.effectiveHeight + 2 * border;
      const profile = drawRectangle(boxW, boxH);
      const extruded = sketch(profile, 'XZ').extrude(handleClip.clipExtrudeDepth);
      const centered = translate(extruded, [
        seg.offset,
        handleClip.clipExtrudeDepth / 2,
        handleClip.centerZ,
      ]);
      extruded.delete();
      let hbox = centered;
      if (hw.rotateZ !== 0) {
        const rotated = rotate(hbox, hw.rotateZ, { axis: [0, 0, 1] });
        hbox.delete();
        hbox = rotated;
      }
      const positioned = translate(hbox, [hw.x, hw.y, 0]);
      hbox.delete();
      out.push(positioned);
    }
  } catch (err) {
    for (const s of out) disposeQuiet(s);
    throw err;
  }
  return out;
}

/**
 * Build one positioned box per ramp zone.
 *
 * `offsetAlongWall` is a GLOBAL coordinate (posAlongPerp from
 * dividerBlendBuilder), so it must be added AFTER rotation along
 * whichever global axis the wall runs. Applying the rotation to a
 * pre-offset box negates the offset on back/right walls (rotation
 * around Z negates the axial component), so a divider at global X=+a
 * would clip at X=-a on the back wall and leave the junction
 * unclipped. Build at origin, rotate, then translate to the wall
 * midpoint plus the axial offset.
 */
function buildRampClipBoxes(wall: WallPatternDescriptor, rampClip: RampZoneClipParams): Shape3D[] {
  const { border, clipExtrudeDepth: rampExtrudeDepth, wallHeight, zones } = rampClip;
  const out: Shape3D[] = [];
  try {
    for (const zone of zones) {
      const rboxW = zone.width + 2 * border;
      const rboxH = zone.height + 2 * border;
      const profile = drawRectangle(rboxW, rboxH);
      const extruded = sketch(profile, 'XZ').extrude(rampExtrudeDepth);
      const centerZ = wallHeight - zone.height / 2;
      const centered = translate(extruded, [0, rampExtrudeDepth / 2, centerZ]);
      extruded.delete();
      let rbox = centered;
      if (wall.zRotation !== undefined) {
        const rotated = rotate(rbox, wall.zRotation, { axis: [0, 0, 1] });
        rbox.delete();
        rbox = rotated;
      }
      const rotZ = wall.zRotation ?? 0;
      const offsetX = rotZ === 90 || rotZ === -90 ? 0 : zone.offsetAlongWall;
      const offsetY = rotZ === 90 || rotZ === -90 ? zone.offsetAlongWall : 0;
      const positioned = translate(rbox, [wall.translateX + offsetX, wall.translateY + offsetY, 0]);
      rbox.delete();
      out.push(positioned);
    }
  } catch (err) {
    // See buildHandleClipBoxes for the rationale — caller can't drain a
    // partial array returned by a throw, so we dispose here.
    for (const s of out) disposeQuiet(s);
    throw err;
  }
  return out;
}

/** Best-effort dispose; swallow double-free / corrupt-handle errors. */
function disposeQuiet(s: Shape3D): void {
  try {
    s.delete();
  } catch {
    /* already cleaned */
  }
}

/**
 * Apply optional cutout/handle/ramp clipping to an owned base hex compound.
 *
 * Takes ownership of `base`. All clip solids (cutout, handle segments,
 * ramp zones) are pre-fused into a single tool and applied with one
 * `cut()` call instead of up to three sequential cuts on the compound.
 *
 * Trade-off vs the prior chained-cut version: a degenerate clip box
 * fails ALL clips for the wall rather than only the failing one. The
 * pre-existing per-pass `catch` already silently dropped failing clips,
 * so the reliability delta is "one bad clip drops all" instead of
 * "one bad clip drops one"; given how rare degenerate clip boxes are
 * in practice, the boolean savings dominate.
 */
export function applyWallPatternClips(
  base: Shape3D,
  wall: WallPatternDescriptor,
  clip: CutoutClipParams | null,
  handleClip: HandleClipParams | null,
  rampClip: RampZoneClipParams | null
): Shape3D | null {
  const tools: Shape3D[] = [];

  try {
    if (clip) {
      const cutoutSolid = buildCutoutClipSolid(wall, clip);
      if (cutoutSolid) tools.push(cutoutSolid);
    }
    if (handleClip && handleClip.segments.length > 0) {
      tools.push(...buildHandleClipBoxes(handleClip));
    }
    if (rampClip && rampClip.zones.length > 0) {
      tools.push(...buildRampClipBoxes(wall, rampClip));
    }
  } catch (err: unknown) {
    for (const t of tools) disposeQuiet(t);
    if (isAbortError(err)) {
      base.delete();
      throw err;
    }
    // Tool construction failure: skip clipping; return base unchanged.
    return base;
  }

  if (tools.length === 0) return base;

  // fuseAllOrNull returns tools[0] directly when length === 1, so
  // ownership stays consistent — we always dispose the returned `fused`
  // handle (which is tools[0] in the singleton case). When length > 1,
  // it produces a fresh fused shape; the originals are then disposed.
  // Wrap to catch the rare degenerate-input throw from unwrap(fuseAll(...));
  // on non-abort we silently drop clipping (matches the prior per-pass
  // catch semantics) instead of poisoning the whole generation.
  let fused: Shape3D | null;
  try {
    fused = fuseAllOrNull(tools);
  } catch (err: unknown) {
    for (const t of tools) disposeQuiet(t);
    if (isAbortError(err)) {
      base.delete();
      throw err;
    }
    return base;
  }
  if (!fused) {
    for (const t of tools) disposeQuiet(t);
    return base;
  }
  if (tools.length > 1) {
    for (const t of tools) disposeQuiet(t);
  }

  let result = base;
  try {
    const clipped = unwrap(cut(result, fused));
    result.delete();
    result = clipped;
  } catch (err: unknown) {
    if (isAbortError(err)) {
      result.delete();
      disposeQuiet(fused);
      throw err;
    }
    // Non-abort failure: result still points at base; let it through unchanged.
  } finally {
    disposeQuiet(fused);
  }

  return result;
}
