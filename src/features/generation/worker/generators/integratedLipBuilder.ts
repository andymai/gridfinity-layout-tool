/**
 * Draft-only body + stacking lip as a SINGLE fuse-free solid (issue #2074).
 *
 * The exact (occt) path builds a separate lip solid and `fuse`s it onto the
 * body; occt's General Fuse dissolves the coincident outer-wall faces cleanly.
 * Mesh kernels (the Manifold draft preview) do NOT dissolve exactly-coincident
 * faces, so the fused draft z-fights along the ~2.7mm-tall wall↔lip overlap at
 * the rounded corners. This builds the same geometry WITHOUT a fuse, so there
 * is no coincident face to fight.
 *
 * @module
 */

import { drawRoundedRectangle, unwrap, cut, withScope } from 'brepjs';
import type { Shape3D, Sketch, DisposalScope, Drawing } from 'brepjs';
import {
  SIZE,
  CLEARANCE,
  BOX_CORNER_RADIUS,
  LIP_SMALL_TAPER,
  LIP_VERTICAL_PART,
  LIP_BIG_TAPER,
  LIP_HEIGHT,
  LIP_TAPER_WIDTH,
  LIP_OVERLAP,
  sketch,
} from './generatorTypes';
import { isPartialMask, type CellMask } from '@/shared/utils/cellMask';
import { hasOverhang, overhangExpansion, type ResolvedOverhang } from './overhang';
import { buildMaskDrawing, buildMaskDrawingInset } from './maskPolygon';
import { resolvePitch, type GridUnitInput } from './gridPitch';

function translateDrawing(d: Drawing, offX: number, offY: number): Drawing {
  return offX !== 0 || offY !== 0 ? d.translate(offX, offY) : d;
}

/**
 * Build the body + stacking lip as a single solid for mesh (build-time) draft
 * kernels: one outer prism spanning floor→lip peak, with the bin cavity and the
 * lip's inner taper removed as ONE boolean CUT. A cut leaves no coincident
 * exterior faces, so the wall↔lip overlap an exact-kernel fuse would z-fight on
 * simply does not exist.
 *
 * The single inner cut tool is a ruled loft of the lip's inner profile
 * (mirroring `buildTopShapeLoft`) extended down to the cavity floor. Below the
 * wall top the lip insets are clamped to `>= wallThickness` so the cut never
 * eats into the wall (where the fused body wall would otherwise win); above the
 * wall top the raw profile tapers to the knife edge.
 *
 * Draft-path only — the exported geometry stays on the fused occt path, so this
 * cannot reintroduce the flush wall↔lip seam (#1314). The caller restricts it
 * to the common case (non-solid, rectangular or solid-polygon footprint, no
 * O-holes, no baked compartments) and falls back to the fuse otherwise.
 */
export function buildBinBoxWithLip(
  gridW: number,
  gridD: number,
  wallHeight: number,
  wallThickness: number,
  gridUnitMm: GridUnitInput = SIZE,
  cellMask?: CellMask,
  overhang?: ResolvedOverhang
): Shape3D {
  const polygon = isPartialMask(cellMask);
  const ov = polygon ? undefined : overhang;
  const exp = ov && hasOverhang(ov) ? overhangExpansion(ov) : null;
  const { x: unitX, y: unitY } = resolvePitch(gridUnitMm);

  const outerW = gridW * unitX - CLEARANCE + (exp?.addW ?? 0);
  const outerD = gridD * unitY - CLEARANCE + (exp?.addD ?? 0);
  const offX = exp?.offsetX ?? 0;
  const offY = exp?.offsetY ?? 0;
  const wt = wallThickness;

  // Lip inner-profile insets (mirror buildTopShapeLoft's INNER_* values).
  const LIP_EXTENSION = 1.2; // overhang depth = angled-support inset at its base
  const INNER_ANGLE = LIP_EXTENSION;
  const INNER_BASE = LIP_TAPER_WIDTH; // 2.6
  const INNER_MID = LIP_BIG_TAPER; // 1.9

  // Lip profile breakpoints in GLOBAL Z. The lip base sits LIP_OVERLAP below the
  // wall top; the angled support runs LIP_TAPER_WIDTH below that, alongside the
  // upper wall (this is the coincident region the fuse z-fights on).
  const lipBaseZ = wallHeight - LIP_OVERLAP;
  const zAngleBottom = lipBaseZ - LIP_TAPER_WIDTH;
  const zExt = lipBaseZ - LIP_EXTENSION;
  const zTaper1 = lipBaseZ + LIP_SMALL_TAPER;
  const zVert = lipBaseZ + LIP_SMALL_TAPER + LIP_VERTICAL_PART;
  const zPeak = lipBaseZ + LIP_HEIGHT;

  // Below the wall top the body wall is the visible interior, so the lip cut
  // must not reach past it — clamp the inset to at least the wall thickness.
  // Above the wall top there is no wall, so the raw profile (down to 0 at the
  // peak) is used to keep the knife edge.
  const clampedInset = (z: number, inset: number): number =>
    z <= wallHeight + 1e-6 ? Math.max(wt, inset) : inset;

  // A rounded-rectangle radius that exceeds half of either side makes many
  // geometry kernels reject the sketch or emit unstable geometry. Non-square
  // pitches can shrink outerW/outerD below 2·BOX_CORNER_RADIUS, so cap the
  // radius to half the smaller side (matching `pocketCornerRadius`) before it
  // reaches `drawRoundedRectangle`. The half-side cap is authoritative: for a
  // degenerate (near-zero) side there is no valid positive radius, so the result
  // collapses toward 0 (square corners) rather than a 0.1 floor that would
  // exceed the side. Non-degenerate dims are unchanged (the 0.1 floor still
  // applies, so a full 42mm bin keeps BOX_CORNER_RADIUS).
  const cappedRadius = (w: number, d: number, desired: number): number => {
    const maxRadius = Math.max(Math.min(w, d) / 2 - 0.1, 0);
    return Math.min(Math.max(desired, Math.min(0.1, maxRadius)), maxRadius);
  };

  const insetDrawing = (inset: number): Drawing => {
    if (polygon) {
      return inset === 0
        ? buildMaskDrawing(cellMask, gridUnitMm)
        : buildMaskDrawingInset(cellMask, gridUnitMm, inset);
    }
    const w = outerW - 2 * inset;
    const d = outerD - 2 * inset;
    const r = cappedRadius(w, d, BOX_CORNER_RADIUS - inset);
    return translateDrawing(drawRoundedRectangle(w, d, r), offX, offY);
  };

  const sectionAt = (z: number, inset: number): Sketch =>
    insetDrawing(inset).sketchOnPlane('XY', z) as Sketch;

  const makeOuterFootprint = (): Drawing =>
    polygon
      ? buildMaskDrawing(cellMask, gridUnitMm)
      : translateDrawing(
          drawRoundedRectangle(outerW, outerD, cappedRadius(outerW, outerD, BOX_CORNER_RADIUS)),
          offX,
          offY
        );

  // The lip taper overshoots the peak so the cut tool exits cleanly THROUGH the
  // prism top instead of capping flush with it (a flush cap would itself leave a
  // coincident horizontal face). The residual top rim is sub-printable-layer thin.
  const OVERSHOOT = 0.1;
  // Distinct-Z gap between the vertical-wall top and the overhang foot so the
  // corner is sharp without two sections sharing a Z (which degenerates the loft).
  const FOOT = 0.05;

  return withScope((scope: DisposalScope) => {
    // Single outer prism: footprint extruded from the floor up to the lip peak.
    // The body wall and lip outer share this one face — no coincidence to fight.
    // Registered so the scope disposes it; `cut` does not consume its inputs.
    const outer = scope.register(sketch(makeOuterFootprint()).extrude(zPeak));

    // ONE inner cut tool: the straight bin cavity flowing into the lip's inner
    // taper, as a single ruled loft. A single tool means there is no
    // second-tool junction plane to leave a coincident face.
    const innerSections: Sketch[] = [
      sectionAt(wallThickness, wt),
      sectionAt(zAngleBottom, wt),
      sectionAt(zAngleBottom + FOOT, clampedInset(zAngleBottom + FOOT, INNER_ANGLE)),
      sectionAt(zExt, clampedInset(zExt, INNER_BASE)),
      sectionAt(lipBaseZ, clampedInset(lipBaseZ, INNER_BASE)),
      sectionAt(zTaper1, clampedInset(zTaper1, INNER_MID)),
      sectionAt(zVert, clampedInset(zVert, INNER_MID)),
      sectionAt(zPeak + OVERSHOOT, 0),
    ];
    const [innerFirst, ...innerRest] = innerSections;
    const innerCut = scope.register(innerFirst.loftWith(innerRest, { ruled: true }));
    return unwrap(cut(outer, innerCut));
  });
}
