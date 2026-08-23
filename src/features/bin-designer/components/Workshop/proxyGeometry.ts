/**
 * Client-side proxy geometry for Workshop parts — instant Three.js
 * approximations of what the worker will eventually fuse exactly. Proxies
 * deliberately omit fillets, chamfer detail, and boolean results (a cutter
 * renders as a translucent ghost, not a hole).
 *
 * Frames: Z-up millimetres. Every builder returns geometry whose origin is
 * the part's footprint-center anchor with its seat at z = 0.
 */
import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Matrix4, Path, Shape } from 'three';
import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { AssemblyPartNode, CutterProfile } from '@/shared/types/assembly';
export { partFootprint, partSeatHeight } from '@/shared/types/assemblyPlacement';

const DEG = Math.PI / 180;

/** Rotate a shape-plane (profile-in-YZ, extruded-along-X) solid into world axes. */
const YZ_PROFILE_TO_WORLD = new Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1);

function roundedRectShape(w: number, d: number, radius: number): Shape {
  const r = Math.min(radius, w / 2 - 1e-3, d / 2 - 1e-3);
  const shape = new Shape();
  shape.moveTo(-w / 2 + r, -d / 2);
  shape.lineTo(w / 2 - r, -d / 2);
  shape.absarc(w / 2 - r, -d / 2 + r, r, -Math.PI / 2, 0, false);
  shape.lineTo(w / 2, d / 2 - r);
  shape.absarc(w / 2 - r, d / 2 - r, r, 0, Math.PI / 2, false);
  shape.lineTo(-w / 2 + r, d / 2);
  shape.absarc(-w / 2 + r, d / 2 - r, r, Math.PI / 2, Math.PI, false);
  shape.lineTo(-w / 2, -d / 2 + r);
  shape.absarc(-w / 2 + r, -d / 2 + r, r, Math.PI, Math.PI * 1.5, false);
  shape.closePath();
  return shape;
}

function extrudeYZProfile(shape: Shape, alongX: number): BufferGeometry {
  const geometry = new ExtrudeGeometry(shape, { depth: alongX, bevelEnabled: false });
  geometry.applyMatrix4(YZ_PROFILE_TO_WORLD);
  geometry.translate(-alongX / 2, 0, 0);
  return geometry;
}

function buildPost(p: { diameter: number; height: number; taperDeg: number }): BufferGeometry {
  const rBottom = p.diameter / 2;
  const rTop = Math.max(0.5, rBottom - p.height * Math.tan(p.taperDeg * DEG));
  const geometry = new CylinderGeometry(rTop, rBottom, p.height, 32);
  geometry.rotateX(Math.PI / 2);
  geometry.translate(0, 0, p.height / 2);
  return geometry;
}

function buildFin(p: {
  length: number;
  thickness: number;
  height: number;
  leanDeg: number;
  leanAxis?: 'thickness' | 'length';
}): BufferGeometry {
  // Straight fins are capsules, matching the worker; leaning fins stay
  // prisms there (sheared arcs invert in OCCT), so the proxy matches.
  const endRadius = Math.min(p.thickness * 0.45, (p.thickness - 1.2) / 2);
  const geometry =
    p.leanDeg <= 0 && endRadius >= 0.3
      ? new ExtrudeGeometry(roundedRectShape(p.length, p.thickness, endRadius), {
          depth: p.height,
          bevelEnabled: false,
          curveSegments: 12,
        })
      : (() => {
          const boxGeometry = new BoxGeometry(p.length, p.thickness, p.height);
          boxGeometry.translate(0, 0, p.height / 2);
          return boxGeometry;
        })();
  if (p.leanDeg > 0) {
    const tan = Math.tan(p.leanDeg * DEG);
    // makeShear slots: zy shears y by z (tip over the long edge); zx shears
    // x by z (run the lean along the plate's length).
    const shear =
      p.leanAxis === 'length'
        ? new Matrix4().makeShear(0, 0, 0, 0, tan, 0)
        : new Matrix4().makeShear(0, 0, 0, 0, 0, tan);
    geometry.applyMatrix4(shear);
  }
  return geometry;
}

function buildBlock(p: {
  width: number;
  depth: number;
  height: number;
  wedgeAngleDeg: number;
}): BufferGeometry {
  if (p.wedgeAngleDeg <= 0) {
    // Rounded vertical corners, matching the worker's corner fillets.
    return new ExtrudeGeometry(
      roundedRectShape(p.width, p.depth, Math.min(2.5, p.width / 5, p.depth / 5)),
      { depth: p.height, bevelEnabled: false, curveSegments: 8 }
    );
  }
  const lowEdge = Math.max(0.5, p.height - p.depth * Math.tan(p.wedgeAngleDeg * DEG));
  const shape = new Shape();
  shape.moveTo(-p.depth / 2, 0);
  shape.lineTo(p.depth / 2, 0);
  shape.lineTo(p.depth / 2, lowEdge);
  shape.lineTo(-p.depth / 2, p.height);
  shape.closePath();
  return extrudeYZProfile(shape, p.width);
}

function buildTube(p: {
  boreDiameter: number;
  wall: number;
  height: number;
  tiltDeg: number;
}): BufferGeometry {
  const outer = p.boreDiameter / 2 + p.wall;
  const shape = new Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new Path();
  hole.absarc(0, 0, p.boreDiameter / 2, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new ExtrudeGeometry(shape, {
    depth: p.height,
    bevelEnabled: false,
    curveSegments: 24,
  });
  if (p.tiltDeg > 0) geometry.rotateX(p.tiltDeg * DEG);
  return geometry;
}

function buildCradle(p: {
  length: number;
  width: number;
  height: number;
  grooveStyle: 'round' | 'vee';
  grooveWidth: number;
  grooveDepth: number;
}): BufferGeometry {
  const gw = Math.min(p.grooveWidth, p.width - 1);
  const gd = Math.min(p.grooveDepth, p.height - 0.5);
  const shape = new Shape();
  shape.moveTo(-p.width / 2, 0);
  shape.lineTo(p.width / 2, 0);
  shape.lineTo(p.width / 2, p.height);
  shape.lineTo(gw / 2, p.height);
  if (p.grooveStyle === 'vee') {
    shape.lineTo(0, p.height - gd);
    shape.lineTo(-gw / 2, p.height);
  } else {
    // Circular-segment approximation: a semicircle of radius gw/2 at the rim.
    shape.absarc(0, p.height, gw / 2, 0, Math.PI, true);
  }
  shape.lineTo(-p.width / 2, p.height);
  shape.closePath();
  return extrudeYZProfile(shape, p.length);
}

function buildHook(p: {
  stemHeight: number;
  reach: number;
  lipHeight: number;
  thickness: number;
  width: number;
}): BufferGeometry {
  const t = Math.min(p.thickness, p.reach / 2);
  const s = p.stemHeight;
  const r = p.reach;
  const lip = p.lipHeight;
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.lineTo(t, 0);
  shape.lineTo(t, s - t);
  if (lip > 0.1) {
    shape.lineTo(r, s - t);
    shape.lineTo(r, s - t + lip);
    shape.lineTo(r - t, s - t + lip);
    shape.lineTo(r - t, s);
  } else {
    shape.lineTo(r, s - t);
    shape.lineTo(r, s);
  }
  shape.lineTo(0, s);
  shape.closePath();
  const geometry = extrudeYZProfile(shape, p.width);
  geometry.translate(0, -r / 2, 0);
  return geometry;
}

function buildArch(p: {
  span: number;
  height: number;
  style: 'rod' | 'bridge';
  rodDiameter: number;
  bridgeWidth: number;
  uprightThickness: number;
  depth: number;
}): BufferGeometry {
  const parts: BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const upright = new BoxGeometry(p.uprightThickness, p.depth, p.height);
    upright.translate(side * (p.span / 2 + p.uprightThickness / 2), 0, p.height / 2);
    parts.push(upright);
  }
  const crossLength = p.span + 2 * p.uprightThickness;
  if (p.style === 'rod') {
    const rod = new CylinderGeometry(p.rodDiameter / 2, p.rodDiameter / 2, crossLength, 24);
    rod.rotateZ(Math.PI / 2);
    rod.translate(0, 0, p.height - p.rodDiameter / 2);
    parts.push(rod);
  } else {
    const thickness = Math.min(p.bridgeWidth, p.height / 2);
    const bridge = new BoxGeometry(crossLength, p.depth, thickness);
    bridge.translate(0, 0, p.height - thickness / 2);
    parts.push(bridge);
  }
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  return merged;
}

export function cutterProfileShape(profile: CutterProfile): Shape {
  const shape = new Shape();
  switch (profile.shape) {
    case 'circle':
      shape.absarc(0, 0, profile.diameter / 2, 0, Math.PI * 2, false);
      return shape;
    case 'polygon': {
      const r = profile.diameter / 2;
      for (let i = 0; i < profile.sides; i += 1) {
        const angle = (i / profile.sides) * Math.PI * 2 - Math.PI / 2;
        const x = r * Math.cos(angle);
        const y = r * Math.sin(angle);
        if (i === 0) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();
      return shape;
    }
    case 'rectangle': {
      const { width: w, depth: d } = profile;
      const r = Math.min(profile.cornerRadius, w / 2, d / 2);
      if (r <= 0) {
        shape.moveTo(-w / 2, -d / 2);
        shape.lineTo(w / 2, -d / 2);
        shape.lineTo(w / 2, d / 2);
        shape.lineTo(-w / 2, d / 2);
        shape.closePath();
        return shape;
      }
      shape.moveTo(-w / 2 + r, -d / 2);
      shape.lineTo(w / 2 - r, -d / 2);
      shape.absarc(w / 2 - r, -d / 2 + r, r, -Math.PI / 2, 0, false);
      shape.lineTo(w / 2, d / 2 - r);
      shape.absarc(w / 2 - r, d / 2 - r, r, 0, Math.PI / 2, false);
      shape.lineTo(-w / 2 + r, d / 2);
      shape.absarc(-w / 2 + r, d / 2 - r, r, Math.PI / 2, Math.PI, false);
      shape.lineTo(-w / 2, -d / 2 + r);
      shape.absarc(-w / 2 + r, -d / 2 + r, r, Math.PI, Math.PI * 1.5, false);
      shape.closePath();
      return shape;
    }
    case 'slot': {
      const r = profile.width / 2;
      const half = Math.max(0, profile.length / 2 - r);
      shape.moveTo(-half, -r);
      shape.lineTo(half, -r);
      shape.absarc(half, 0, r, -Math.PI / 2, Math.PI / 2, false);
      shape.lineTo(-half, r);
      shape.absarc(-half, 0, r, Math.PI / 2, Math.PI * 1.5, false);
      shape.closePath();
      return shape;
    }
    case 'path': {
      const pts = profile.points;
      const cx = (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2;
      const cy = (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2;
      if (pts.length === 0) return shape;
      const first = pts[0];
      shape.moveTo(first.x - cx, first.y - cy);
      for (let i = 1; i <= pts.length; i += 1) {
        const prev = pts[i - 1];
        const point = pts[i % pts.length];
        const out = prev.handleOut;
        const into = point.handleIn;
        if (out || into) {
          shape.bezierCurveTo(
            prev.x - cx + (out?.dx ?? 0),
            prev.y - cy + (out?.dy ?? 0),
            point.x - cx + (into?.dx ?? 0),
            point.y - cy + (into?.dy ?? 0),
            point.x - cx,
            point.y - cy
          );
        } else {
          shape.lineTo(point.x - cx, point.y - cy);
        }
      }
      return shape;
    }
    case 'outline': {
      const pts = profile.points;
      const cx = (Math.min(...pts.map((p) => p.x)) + Math.max(...pts.map((p) => p.x))) / 2;
      const cy = (Math.min(...pts.map((p) => p.y)) + Math.max(...pts.map((p) => p.y))) / 2;
      if (pts.length === 0) return shape;
      const first = pts[0];
      shape.moveTo(first.x - cx, first.y - cy);
      for (const point of pts.slice(1)) shape.lineTo(point.x - cx, point.y - cy);
      shape.closePath();
      return shape;
    }
  }
}

function buildCutter(p: { profile: CutterProfile; depth: number }): BufferGeometry {
  const geometry = new ExtrudeGeometry(cutterProfileShape(p.profile), {
    depth: p.depth,
    bevelEnabled: false,
    curveSegments: 24,
  });
  geometry.translate(0, 0, -p.depth);
  return geometry;
}

export function buildPartGeometry(node: AssemblyPartNode): BufferGeometry {
  switch (node.type) {
    case 'post':
      return buildPost(node.params);
    case 'fin':
      return buildFin(node.params);
    case 'block':
      return buildBlock(node.params);
    case 'tube':
      return buildTube(node.params);
    case 'cradle':
      return buildCradle(node.params);
    case 'hook':
      return buildHook(node.params);
    case 'arch':
      return buildArch(node.params);
    case 'cutter':
      return buildCutter(node.params);
  }
}
