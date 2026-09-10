/** One assembly part's solid in its own frame: the profile cutter, eased top edges and corner fillets. */
import {
  applyMatrix,
  box,
  chamfer,
  cone,
  cut,
  cutAll,
  cylinder,
  draw,
  drawRoundedRectangle,
  edgeFinder,
  fuseAll,
  getBounds,
  intersect,
  isOk,
  rotate,
  translate,
  unwrap,
} from 'brepjs';
import type { Edge, Shape3D, ValidSolid } from 'brepjs';
import type { AssemblyPartNode } from '@/shared/types/assembly';
import { COPLANAR_OVERLAP } from './generatorConstants';
import { applyFilletWithFallback } from './cutoutBuilder';
import { sketch } from './meshUtils';
import { buildCutterSolid } from './assemblyPartCutter';
export { cutterProfileDrawing } from './assemblyPartCutter';

export const DEG = Math.PI / 180;

/**
 * The edge language that makes an assembly read as a designed product rather
 * than fused primitives: one small roundover on every top rim, rounded
 * vertical corners on prisms, and a molded cove where each part meets the
 * surface it seats on. Magnitudes stay small so no footprint or functional
 * face moves; every application degrades to the sharp shape on kernel failure.
 */
const TOP_EASE_MM = 1;

const CORNER_FILLET_MM = 2.5;

/** Edges lying IN the plane at `z` (planar rims, junction seams) — never a
 *  vertical edge that merely crosses it, the classic sliver source. */
export function edgesNearPlane(shape: Shape3D, z: number, tolerance = 0.4): Edge[] {
  return edgeFinder()
    .when((e) => {
      const bounds = getBounds(e);
      return Math.abs(bounds.zMax - z) <= tolerance && Math.abs(bounds.zMin - z) <= tolerance;
    })
    .findAll(shape);
}

/**
 * The long top edges of a run — crown lines whose fillet is a plain cylinder.
 * The short end edges are excluded: on leaned prisms their corner patches
 * tessellate degenerate (the scoop-cusp class).
 */
function longTopEdges(shape: Shape3D, zTop: number, runLength: number): Edge[] {
  return edgeFinder()
    .when((e) => {
      const bounds = getBounds(e);
      return (
        bounds.zMax >= zTop - 0.4 &&
        bounds.zMin >= zTop - 0.4 &&
        Math.abs(bounds.xMax - bounds.xMin) > runLength * 0.9
      );
    })
    .findAll(shape);
}

/** Vertical edges (zero XY extent) — the corner lines of a prism. */
function verticalEdges(shape: Shape3D): Edge[] {
  return edgeFinder()
    .when((e) => {
      const bounds = getBounds(e);
      return (
        bounds.zMax - bounds.zMin > 0.5 &&
        Math.abs(bounds.xMax - bounds.xMin) < 1e-3 &&
        Math.abs(bounds.yMax - bounds.yMin) < 1e-3
      );
    })
    .findAll(shape);
}

/** Chamfer that keeps the original on kernel failure (same contract as the fillet fallback). */
function chamferedOrOriginal(shape: Shape3D, edges: readonly Edge[], distance: number): Shape3D {
  if (edges.length === 0 || distance <= 0.05) return shape;
  try {
    const result = chamfer(shape as ValidSolid, edges as Edge[], distance);
    if (isOk(result)) {
      const next = unwrap(result);
      if (next !== shape) shape.delete();
      return next;
    }
  } catch {
    // Sharp edge beats no part.
  }
  return shape;
}

/** Fillet with fallback; deletes the input when a new shape came back. */
function easedOrOriginal(shape: Shape3D, edges: readonly Edge[], radius: number): Shape3D {
  if (edges.length === 0 || radius <= 0.05) return shape;
  const result = applyFilletWithFallback(shape, edges, radius);
  if (result !== shape) shape.delete();
  return result;
}

/**
 * One part template in its seat frame: anchored on its footprint center,
 * additive solids rising from z = -COPLANAR_OVERLAP (sunk into whatever they
 * seat on so the fuse never meets a coplanar face), cutters sinking below 0.
 */
export function buildPartTemplate(node: AssemblyPartNode): Shape3D | null {
  const sink = COPLANAR_OVERLAP;
  switch (node.type) {
    case 'post': {
      const { diameter, height, taperDeg, tipChamfer } = node.params;
      const rBottom = diameter / 2;
      const rTop = Math.max(0.5, rBottom - height * Math.tan(taperDeg * DEG));
      const total = height + sink;
      const body =
        taperDeg > 0
          ? cone(rBottom, rTop, total, { at: [0, 0, -sink] })
          : cylinder(rBottom, total, { at: [0, 0, -sink] });
      const tip = Math.min(tipChamfer, rTop - 0.3, height / 4);
      return chamferedOrOriginal(body, edgesNearPlane(body, height), tip);
    }
    case 'fin': {
      const { length, thickness, height, leanDeg, leanAxis } = node.params;
      const crown = Math.min(thickness / 3, TOP_EASE_MM);
      const tan = leanDeg > 0 ? Math.tan(leanDeg * DEG) : 0;
      if (tan <= 0) {
        // Near-capsule footprint: rounded ends read as a designed blade, and
        // the rounding stays inscribed so the nominal footprint never grows.
        // 0.45× thickness keeps a real straight segment on each side — a true
        // tangent capsule leaves micro-edges OCCT can reject.
        // No crown ease here: filleting the capsule's top loop slivers where
        // the straight runs meet the end arcs tangentially (the scoop-cusp
        // class); the rounded footprint carries the look on its own. The
        // radius leaves a >=1.2mm straight segment on the short ends — the
        // near-tangent leftover is itself a degenerate-facet source.
        const endRadius = Math.min(thickness * 0.45, (thickness - 1.2) / 2);
        if (endRadius < 0.3) {
          const total = height + sink;
          return box(length, thickness, total, { at: [0, 0, total / 2 - sink] });
        }
        return sketch(drawRoundedRectangle(length, thickness, endRadius), 'XY', -sink).extrude(
          height + sink
        );
      }
      // Leaning fins keep planar constructions: OCCT's sheared-box faces only
      // come out clean when a boolean rebuilds them (the length-axis clip does
      // that; the thickness-axis draws its quad directly), and the capsule's
      // arc faces can invert under the non-uniform transform outright. The
      // rounding budget goes to the crown alone.
      const total = height + sink;
      if (leanAxis === 'length') {
        const boxPlate = box(length, thickness, total, { at: [0, 0, total / 2 - sink] });
        const linear = [1, 0, tan, 0, 1, 0, 0, 0, 1] as [
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
          number,
        ];
        const sheared = unwrap(
          applyMatrix(boxPlate, { linear, translation: [0, 0, 0] })
        ) as Shape3D;
        if (sheared !== boxPlate) boxPlate.delete();
        // Clip back to the nominal run — the rack generator's leaning fins
        // were clipped the same way so the lean never overshoots.
        const clip = box(length, thickness + 2, total * 2 + 2, {
          at: [0, 0, total / 2 - sink],
        });
        const clipped = unwrap(intersect(sheared, clip, { optimisation: 'commonFace' }));
        if (clipped !== sheared) sheared.delete();
        clip.delete();
        return easedOrOriginal(clipped, longTopEdges(clipped, height, length), crown);
      }
      const lean = tan * height;
      const pen = draw([-thickness / 2, -sink])
        .lineTo([thickness / 2, -sink])
        .lineTo([thickness / 2 + lean, height])
        .lineTo([-thickness / 2 + lean, height])
        .close();
      const quad = sketch(pen, 'YZ', -length / 2).extrude(length);
      return easedOrOriginal(quad, longTopEdges(quad, height, length), crown);
    }
    case 'block': {
      const { width, depth, height, wedgeAngleDeg } = node.params;
      const tiltDeg = node.params.tiltDeg ?? 0;
      // A tilted prism must stay buried: extend the base down by the lift the
      // rotation would give the raised edge, then rotate about the part's X.
      const drop = tiltDeg > 0 ? Math.tan(tiltDeg * DEG) * (depth / 2) + 0.5 : 0;
      const corner = Math.min(CORNER_FILLET_MM, width / 5, depth / 5);
      let body: Shape3D;
      if (wedgeAngleDeg <= 0) {
        const total = height + sink + drop;
        body = box(width, depth, total, { at: [0, 0, total / 2 - sink - drop] });
        body = easedOrOriginal(body, verticalEdges(body), corner);
        body = easedOrOriginal(
          body,
          edgesNearPlane(body, height),
          Math.min(TOP_EASE_MM, height / 5)
        );
      } else {
        const lowEdge = Math.max(0.5, height - depth * Math.tan(wedgeAngleDeg * DEG));
        const pen = draw([-depth / 2, -sink - drop])
          .lineTo([depth / 2, -sink - drop])
          .lineTo([depth / 2, lowEdge])
          .lineTo([-depth / 2, height])
          .close();
        const wedge = sketch(pen, 'YZ', -width / 2).extrude(width);
        // The sloped face stays crisp (it is the functional ramp); only the
        // vertical corner lines soften.
        body = easedOrOriginal(wedge, verticalEdges(wedge), corner);
      }
      if (tiltDeg <= 0) return body;
      const tilted = rotate(body, tiltDeg, { at: [0, 0, 0], axis: [1, 0, 0] });
      body.delete();
      return tilted;
    }
    case 'tube': {
      const { boreDiameter, wall, height, tiltDeg } = node.params;
      const boreTaperDeg = node.params.boreTaperDeg ?? 0;
      const outerR = boreDiameter / 2 + wall;
      const rTop = boreDiameter / 2;
      const outer = cylinder(outerR, height + sink, { at: [0, 0, -sink] });
      const boreH = height + 2 * sink + 2;
      // The cone is anchored so its radius AT THE MOUTH (z = height) is exactly
      // boreDiameter/2 — the overshoot above the rim widens, never narrows.
      const taperTan = Math.tan(boreTaperDeg * DEG);
      const bore =
        boreTaperDeg > 0
          ? cone(
              Math.max(0.5, rTop - (height + sink + 1) * taperTan),
              rTop + (sink + 1) * taperTan,
              boreH,
              { at: [0, 0, -sink - 1] }
            )
          : cylinder(rTop, boreH, { at: [0, 0, -sink - 1] });
      let hollow = unwrap(cut(outer, bore, { optimisation: 'commonFace' })) as Shape3D;
      if (hollow !== outer) outer.delete();
      bore.delete();
      // Collar recess: a wider, shallow bore at the mouth so a tool's
      // shoulder sits flat — the parameterized screwdriver-holder idiom.
      const cbR = Math.min((node.params.counterboreDiameter ?? 0) / 2, outerR - 0.4);
      const cbDepth = Math.min(node.params.counterboreDepth ?? 0, height - 1);
      if (cbR > rTop && cbDepth > 0.2) {
        const collar = cylinder(cbR, cbDepth + 1, { at: [0, 0, height - cbDepth] });
        const recessed = unwrap(cut(hollow, collar, { optimisation: 'commonFace' }));
        if (recessed !== hollow) hollow.delete();
        collar.delete();
        hollow = recessed;
      }
      // Lead-in chamfer on both rims: the tool finds the bore, and the mouth
      // reads finished instead of saw-cut. Sized to the rim's true wall,
      // which the counterbore may have thinned.
      const rimWall = cbR > rTop && cbDepth > 0.2 ? outerR - cbR : wall;
      hollow = chamferedOrOriginal(
        hollow,
        edgesNearPlane(hollow, height),
        Math.min(rimWall / 3, 0.8)
      );
      if (tiltDeg <= 0) return hollow;
      const tilted = rotate(hollow, tiltDeg, { at: [0, 0, 0], axis: [1, 0, 0] });
      hollow.delete();
      return tilted;
    }
    case 'cradle': {
      const { length, width, height, grooveStyle, grooveWidth, grooveDepth } = node.params;
      const cradleTilt = node.params.tiltDeg ?? 0;
      const cradleDrop = cradleTilt > 0 ? Math.tan(cradleTilt * DEG) * (width / 2) + 0.5 : 0;
      const tiltCradle = (shape: Shape3D): Shape3D => {
        if (cradleTilt <= 0) return shape;
        const tilted = rotate(shape, cradleTilt, { at: [0, 0, 0], axis: [1, 0, 0] });
        shape.delete();
        return tilted;
      };
      const gw = Math.min(grooveWidth, width - 1);
      const gd = Math.min(grooveDepth, height - 0.5);
      if (grooveStyle === 'vee') {
        const pen = draw([-width / 2, -sink - cradleDrop])
          .lineTo([width / 2, -sink - cradleDrop])
          .lineTo([width / 2, height])
          .lineTo([gw / 2, height])
          .lineTo([0, height - gd])
          .lineTo([-gw / 2, height])
          .lineTo([-width / 2, height])
          .close();
        const vee = sketch(pen, 'YZ', -length / 2).extrude(length);
        // Top edges — outer rim AND groove mouth — get the same ease: the
        // mouth rounding doubles as the tool's lead-in.
        return tiltCradle(easedOrOriginal(vee, edgesNearPlane(vee, height), Math.min(0.6, gd / 5)));
      }
      const total = height + sink + cradleDrop;
      const body = box(length, width, total, { at: [0, 0, total / 2 - sink - cradleDrop] });
      const r = gw / 2;
      const groove = cylinder(r, length + 20, {
        at: [-(length + 20) / 2, 0, height - gd + r],
        axis: [1, 0, 0],
      });
      const carved = unwrap(cut(body, groove, { optimisation: 'commonFace' }));
      if (carved !== body) body.delete();
      groove.delete();
      // Only the outer rim: the groove's near-tangent seam edges sliver under
      // fillet, and the round groove is its own lead-in anyway.
      const rimEdges = edgeFinder()
        .when((e) => {
          const bounds = getBounds(e);
          const atTop = bounds.zMax >= height - 0.3 && bounds.zMin >= height - 0.3;
          const onBoundary =
            Math.abs(Math.abs(bounds.yMin) - width / 2) < 0.2 ||
            Math.abs(Math.abs(bounds.yMax) - width / 2) < 0.2 ||
            Math.abs(Math.abs(bounds.xMin) - length / 2) < 0.2 ||
            Math.abs(Math.abs(bounds.xMax) - length / 2) < 0.2;
          return atTop && onBoundary;
        })
        .findAll(carved);
      return tiltCradle(easedOrOriginal(carved, rimEdges, Math.min(0.8, gd / 4)));
    }
    case 'hook': {
      const { stemHeight, reach, lipHeight, thickness, width } = node.params;
      const t = Math.min(thickness, reach / 2);
      const s = stemHeight;
      const r = reach;
      let pen = draw([0, -sink])
        .lineTo([t, -sink])
        .lineTo([t, s - t]);
      if (lipHeight > 0.1) {
        pen = pen
          .lineTo([r, s - t])
          .lineTo([r, s - t + lipHeight])
          .lineTo([r - t, s - t + lipHeight])
          .lineTo([r - t, s]);
      } else {
        pen = pen.lineTo([r, s - t]).lineTo([r, s]);
      }
      const drawing = pen.lineTo([0, s]).close();
      let solid: Shape3D = sketch(drawing, 'YZ', -width / 2).extrude(width);
      // A hook is all silhouette: rounding the length-running profile corners
      // is what separates a molded J from an extruded L-bracket. Only those
      // edges — the sunk base edges and short profile segments produce
      // degenerate slivers under fillet.
      const silhouetteEdges = edgeFinder()
        .when((e) => {
          const bounds = getBounds(e);
          return Math.abs(bounds.xMax - bounds.xMin) > width * 0.9 && bounds.zMin > 0.2;
        })
        .findAll(solid);
      solid = easedOrOriginal(solid, silhouetteEdges, Math.min(0.8, t / 2.5));
      const anchored = translate(solid, [0, -r / 2, 0]);
      solid.delete();
      return anchored;
    }
    case 'arch': {
      const { span, height, style, rodDiameter, bridgeWidth, uprightThickness, depth } =
        node.params;
      const parts: Shape3D[] = [];
      const uprightTotal = height + sink;
      for (const side of [-1, 1]) {
        parts.push(
          box(uprightThickness, depth, uprightTotal, {
            at: [side * (span / 2 + uprightThickness / 2), 0, uprightTotal / 2 - sink],
          })
        );
      }
      const crossLength = span + 2 * uprightThickness;
      if (style === 'rod') {
        parts.push(
          cylinder(rodDiameter / 2, crossLength, {
            at: [-crossLength / 2, 0, height - rodDiameter / 2],
            axis: [1, 0, 0],
          })
        );
      } else {
        const thickness = Math.min(bridgeWidth, height / 2);
        parts.push(box(crossLength, depth, thickness, { at: [0, 0, height - thickness / 2] }));
      }
      let fused = unwrap(fuseAll(parts as ValidSolid[], { optimisation: 'commonFace' })) as Shape3D;
      for (const part of parts) {
        if (part !== fused) part.delete();
      }
      fused = easedOrOriginal(
        fused,
        verticalEdges(fused),
        Math.min(CORNER_FILLET_MM, uprightThickness / 4, depth / 4)
      );
      if (style !== 'rod') {
        fused = easedOrOriginal(fused, edgesNearPlane(fused, height), TOP_EASE_MM);
      }
      return fused;
    }
    case 'comb': {
      const { width, depth, height, slotCount } = node.params;
      // Slots center on an even pitch, so the edge tooth is half an interior
      // one: pitch - 2 keeps every tooth at least 1mm. The slot floor keeps 1.5mm.
      const slotWidth = Math.min(node.params.slotWidth, width / slotCount - 2);
      const slotDepth = Math.min(node.params.slotDepth, height - 1.5);
      const total = height + sink;
      let body: Shape3D = box(width, depth, total, { at: [0, 0, total / 2 - sink] });
      body = easedOrOriginal(
        body,
        verticalEdges(body),
        Math.min(CORNER_FILLET_MM, width / 8, depth / 4)
      );
      // Ease the rim before cutting so the slot walls stay crisp; a slot cut
      // through the roundover leaves clean edges, while filleting after
      // would sliver every tooth corner.
      body = easedOrOriginal(body, edgesNearPlane(body, height), Math.min(TOP_EASE_MM, depth / 5));
      if (slotWidth <= 0.5 || slotDepth <= 0.5) return body;
      const pitch = width / slotCount;
      const cutters: Shape3D[] = [];
      for (let i = 0; i < slotCount; i += 1) {
        const cx = -width / 2 + pitch * (i + 0.5);
        cutters.push(
          box(slotWidth, depth + 2, slotDepth + 1, {
            at: [cx, 0, height - (slotDepth + 1) / 2 + 1],
          })
        );
      }
      const carved = unwrap(cutAll(body, cutters as ValidSolid[], { optimisation: 'commonFace' }));
      for (const cutter of cutters) cutter.delete();
      if (carved !== body) body.delete();
      return carved;
    }
    case 'riser': {
      const { width, stepCount, stepDepth, stepHeight } = node.params;
      const totalD = stepCount * stepDepth;
      let pen = draw([-totalD / 2, -sink])
        .lineTo([totalD / 2, -sink])
        .lineTo([totalD / 2, stepCount * stepHeight]);
      for (let i = stepCount; i >= 1; i -= 1) {
        const yFront = totalD / 2 - (stepCount - i + 1) * stepDepth;
        pen = pen.lineTo([yFront, i * stepHeight]);
        if (i > 1) pen = pen.lineTo([yFront, (i - 1) * stepHeight]);
      }
      const stairs = sketch(pen.close(), 'YZ', -width / 2).extrude(width);
      let body = easedOrOriginal(
        stairs,
        verticalEdges(stairs),
        Math.min(CORNER_FILLET_MM, stepDepth / 4, stepHeight / 3)
      );
      // Every tread plane in one pass: convex noses round over, the concave
      // tread-to-riser corner coves — the stair reads molded, not stacked.
      const treadEdges: Edge[] = [];
      for (let i = 1; i <= stepCount; i += 1) {
        treadEdges.push(...edgesNearPlane(body, i * stepHeight));
      }
      body = easedOrOriginal(body, treadEdges, Math.min(TOP_EASE_MM, stepHeight / 4));
      return body;
    }
    case 'boreBank': {
      const { width, depth, height, columns, rows, angleDeg } = node.params;
      const rad = angleDeg * DEG;
      const pitchX = width / columns;
      // Centered on an even pitch: edge webs keep 1mm, interior webs 2mm;
      // the deepest point keeps a 2mm floor.
      const bore = Math.min(node.params.boreDiameter, pitchX - 2, depth - 3);
      // Rows pack toward the back face so each leaning bore sweeps forward
      // beneath the mouths in front of it; every row's depth then clamps
      // against its own distance to the front wall.
      const backCy = depth / 2 - 1.5 - bore / 2;
      const frontLimit = -depth / 2 + 1.5 + bore / 2;
      const rowPitch = rows > 1 ? Math.min(bore + 2, (backCy - frontLimit) / (rows - 1)) : 0;
      const maxByFloor = (height - 2) / Math.cos(rad);
      const total = height + sink;
      let body: Shape3D = box(width, depth, total, { at: [0, 0, total / 2 - sink] });
      body = easedOrOriginal(
        body,
        verticalEdges(body),
        Math.min(CORNER_FILLET_MM, width / 8, depth / 8)
      );
      body = easedOrOriginal(body, edgesNearPlane(body, height), Math.min(TOP_EASE_MM, depth / 6));
      if (bore <= 1) return body;
      const axis: [number, number, number] = [0, -Math.sin(rad), -Math.cos(rad)];
      const cutters: Shape3D[] = [];
      for (let c = 0; c < columns; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const cx = -width / 2 + pitchX * (c + 0.5);
          const cy = backCy - rowPitch * r;
          let boreDepth = Math.min(node.params.boreDepth, maxByFloor);
          if (rad > 0) {
            boreDepth = Math.min(boreDepth, (cy - frontLimit) / Math.sin(rad));
          }
          if (boreDepth <= 1) continue;
          cutters.push(
            cylinder(bore / 2, boreDepth + 1, {
              at: [cx, cy + Math.sin(rad), height + Math.cos(rad)],
              axis,
            })
          );
        }
      }
      if (cutters.length === 0) return body;
      const drilled = unwrap(cutAll(body, cutters as ValidSolid[], { optimisation: 'commonFace' }));
      for (const cutter of cutters) cutter.delete();
      if (drilled !== body) body.delete();
      return drilled;
    }
    case 'cutter':
      return buildCutterSolid(node.params);
  }
}
