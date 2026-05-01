/**
 * Cutout/handle/ramp clipping passes for wall hex patterns.
 *
 * `applyWallPatternClips` takes ownership of the base hex compound and
 * applies — in order — cutout border clipping, handle border clipping,
 * and ramp-zone border clipping. Each pass returns a new shape and
 * disposes the previous handle.
 *
 * Each clip box is at least as deep as the hex prism extrusion so it
 * fully envelops hex prisms at junction/cutout boundaries (#1354).
 */

import { drawRectangle, unwrap, cut, fuse, translate, rotate } from 'brepjs';
import type { Shape3D } from 'brepjs';
import type { WallPatternDescriptor } from './wallPatterns';
import { sketch } from './meshUtils';
import { isAbortError } from './utils/abort';
import { CUTOUT_BORDER_WIDTH } from './wallPatterns';
import { computeCutoutCenter } from '@/shared/utils/wallCutoutPosition';
import { buildSingleCutout } from './featureBuilder';
import type { CutoutClipParams, HandleClipParams, RampZoneClipParams } from './wallPatternTypes';

/**
 * Apply optional cutout/handle/ramp clipping to an owned base hex compound.
 *
 * Takes ownership of `base` and returns either `base` itself (no clips) or a
 * new shape with `base` disposed. Callers must not reuse the original handle.
 */
export function applyWallPatternClips(
  base: Shape3D,
  wall: WallPatternDescriptor,
  clip: CutoutClipParams | null,
  handleClip: HandleClipParams | null,
  rampClip: RampZoneClipParams | null
): Shape3D | null {
  // --- Cutout border clipping ---
  let result = base;
  if (clip && clip.cutWidth >= 0.1 && clip.userCutHeight >= 0.1) {
    const rotateZ = wall.side === 'left' || wall.side === 'right' ? 90 : 0;
    const centerOffset = computeCutoutCenter(
      clip.wallSpan,
      clip.cutWidth,
      clip.wallThickness,
      clip.cutoutCfg.alignment,
      clip.cutoutCfg.offset
    );

    const clipSolid = buildSingleCutout(
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

    try {
      const clipped = unwrap(cut(result, clipSolid));
      result.delete();
      result = clipped;
    } catch (err: unknown) {
      if (isAbortError(err)) {
        result.delete();
        throw err;
      }
      // On non-abort failure, keep result as-is
    } finally {
      clipSolid.delete();
    }
  }

  // --- Handle border clipping ---
  if (handleClip && handleClip.segments.length > 0) {
    const border = CUTOUT_BORDER_WIDTH;
    const clipBoxes: Shape3D[] = [];
    // Tracks the in-flight fuse-merge result so the catch can dispose it
    // if an intermediate fuse() throws. Set to null once ownership is
    // handed off to handleClipSolid (or never created on the singleton path).
    let pendingMerge: Shape3D | null = null;

    const hw = handleClip.handleWall;
    try {
      for (const seg of handleClip.segments) {
        const boxW = seg.width + 2 * border;
        const boxH = handleClip.effectiveHeight + 2 * border;
        const profile = drawRectangle(boxW, boxH);
        // Each transform allocates a new WASM handle while the previous
        // becomes garbage. Dispose the intermediates explicitly so only
        // the final handle survives in clipBoxes.
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
        clipBoxes.push(positioned);
      }

      let handleClipSolid: Shape3D;
      if (clipBoxes.length === 1) {
        handleClipSolid = clipBoxes[0];
      } else {
        let current: Shape3D = unwrap(fuse(clipBoxes[0], clipBoxes[1]));
        pendingMerge = current;
        clipBoxes[0].delete();
        clipBoxes[1].delete();
        for (let i = 2; i < clipBoxes.length; i++) {
          const merged: Shape3D = unwrap(fuse(current, clipBoxes[i]));
          current.delete();
          clipBoxes[i].delete();
          current = merged;
          pendingMerge = current;
        }
        handleClipSolid = current;
        pendingMerge = null; // ownership transferred to handleClipSolid
      }

      try {
        const handleClipped = unwrap(cut(result, handleClipSolid));
        result.delete();
        result = handleClipped;
      } catch (err: unknown) {
        if (isAbortError(err)) {
          result.delete();
          throw err;
        }
        // On non-abort failure, keep result as-is
      } finally {
        handleClipSolid.delete();
      }
    } catch (err: unknown) {
      for (const b of clipBoxes) {
        try {
          b.delete();
        } catch {
          /* already cleaned */
        }
      }
      if (pendingMerge) {
        try {
          pendingMerge.delete();
        } catch {
          /* already cleaned */
        }
      }
      if (isAbortError(err)) {
        result.delete();
        throw err;
      }
    }
  }

  // --- Ramp zone border clipping ---
  if (rampClip && rampClip.zones.length > 0) {
    const { border, clipExtrudeDepth: rampExtrudeDepth, wallHeight, zones } = rampClip;
    const rampBoxes: Shape3D[] = [];
    // See handle-clip block for why pendingMerge is tracked separately
    // from rampBoxes — the in-flight fuse intermediate isn't in either pool.
    let pendingMerge: Shape3D | null = null;

    try {
      for (const zone of zones) {
        const rboxW = zone.width + 2 * border;
        const rboxH = zone.height + 2 * border;
        const profile = drawRectangle(rboxW, rboxH);
        // Dispose intermediates from each transform.
        const extruded = sketch(profile, 'XZ').extrude(rampExtrudeDepth);
        const centerZ = wallHeight - zone.height / 2;

        // Build the box at the ORIGIN (not at offsetAlongWall), rotate to
        // align with the wall, THEN translate to the wall midpoint plus the
        // axial offset. Applying the rotation to a pre-offset box negates
        // the offset for back (zRotation=180) and right (zRotation=-90)
        // walls because rotation around Z negates the axial component —
        // so a divider at global X=+a produced a clip box at X=-a on the
        // back wall, leaving the actual junction unclipped and producing
        // hex-prism bleed near divider-wall junctions on asymmetric bins.
        // `offsetAlongWall` is a GLOBAL coordinate (posAlongPerp from
        // dividerBlendBuilder), so it must be added AFTER rotation, along
        // whichever global axis the wall runs (X for front/back, Y for
        // left/right).
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
        const positioned = translate(rbox, [
          wall.translateX + offsetX,
          wall.translateY + offsetY,
          0,
        ]);
        rbox.delete();
        rampBoxes.push(positioned);
      }

      if (rampBoxes.length > 0) {
        let current: Shape3D = rampBoxes[0];
        pendingMerge = current;
        for (let i = 1; i < rampBoxes.length; i++) {
          const merged: Shape3D = unwrap(fuse(current, rampBoxes[i]));
          current.delete();
          rampBoxes[i].delete();
          current = merged;
          pendingMerge = current;
        }
        const rampClipSolid = current;
        pendingMerge = null; // ownership transferred to rampClipSolid

        try {
          const rampClipped = unwrap(cut(result, rampClipSolid));
          result.delete();
          result = rampClipped;
        } catch (err: unknown) {
          if (isAbortError(err)) {
            result.delete();
            throw err;
          }
        } finally {
          rampClipSolid.delete();
        }
      }
    } catch (err: unknown) {
      for (const b of rampBoxes) {
        try {
          b.delete();
        } catch {
          /* already cleaned */
        }
      }
      if (pendingMerge) {
        try {
          pendingMerge.delete();
        } catch {
          /* already cleaned */
        }
      }
      if (isAbortError(err)) {
        result.delete();
        throw err;
      }
    }
  }

  return result;
}
