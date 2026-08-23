/**
 * Workshop assembly generator: evaluates the part tree with the SAME
 * placement math the proxy scene uses (`@/shared/types/assemblyPlacement`),
 * builds one OCCT solid per part template (cached), fuses everything with
 * the floor plate and base socket, then subtracts the cutters. A flat
 * (non-pipeline) generator following `knifeRestBuilder`.
 *
 * Coordinate system (before the final Z-shift): socket occupies
 * Z ∈ [-SOCKET_HEIGHT, 0]; the floor plate rises from 0; parts seat on the
 * floor's top face. The assembly is shifted +SOCKET_HEIGHT so Z=0 is the
 * printable bottom. XY is centered on the origin, so the store frame's
 * bottom-left-origin coordinates are shifted by half the footprint.
 */
import {
  box,
  clone,
  cone,
  cut,
  cutAll,
  cylinder,
  draw,
  drawCircle,
  drawRoundedRectangle,
  exportSTEP,
  fuseAll,
  getKernelCapabilities,
  mesh,
  meshEdges,
  mirror,
  rotate,
  translate,
  unwrap,
  withScope,
} from 'brepjs';
import type { Drawing, Shape3D, ValidSolid } from 'brepjs';
import type {
  AssemblyPartNode,
  AssemblyStructure,
  CutterParams,
  CutterProfile,
} from '@/shared/types/assembly';
import type { ItemEnvelope } from '@/shared/types/item';
import { assemblyDescriptor } from '@/shared/items/assembly/descriptor';
import { resolvePlacedParts, type PlacedPart } from '@/shared/types/assemblyPlacement';
import {
  clampPolygonSides,
  regularPolygonPoints,
  slotCornerRadius,
} from '@/shared/utils/cutoutPolygon';
import { dropCoincidentPoints } from '@/shared/utils/polyline';
import { EDGE_ANGULAR_TOLERANCE_RAD } from '@/shared/constants/tessellation';
import type { ExportFormat, MeshData } from '../../bridge/types';
import { SOCKET_HEIGHT, toIndexedMeshData, checkCancelled } from './generatorTypes';
import type { ProgressFn } from './generatorTypes';
import { CLEARANCE, COPLANAR_OVERLAP } from './generatorConstants';
import { buildBaseSocket, DEFAULT_SOCKET_CELL_PLAN } from './socketBuilder';
import { creaseEdges } from './utils';
import { computeTessellationTolerances, EXPORT_ANGULAR_TOLERANCE_RAD } from './utils/tolerances';
import { unwrapExportBlob } from './utils/exportUnwrap';
import { exportSolidToStl } from './utils/stlMeshFallback';
import { flattenPathToPolyline, pathWire, polylineSelfIntersects } from './cutoutBuilder';
import { offsetClosedPolygon } from './polygonOffset';
import { buildCacheKey, quantize } from './cacheKeyUtils';
import { getFeatureCache, setFeatureCache } from './shapeCache';
import { sketch } from './meshUtils';

const DEG = Math.PI / 180;

/** Cutters overshoot their seat so the cut opens the top face cleanly. */
const CUTTER_TOP_OVERSHOOT = 1;

/** Default outer corner radius of the floor plate when the base sets none. */
const DEFAULT_FLOOR_CORNER_RADIUS = 4;

function stableKeyValue(value: unknown): unknown {
  if (typeof value === 'number') return quantize(value);
  if (Array.isArray(value)) return value.map(stableKeyValue);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .map((k) => [k, stableKeyValue((value as Record<string, unknown>)[k])]);
  }
  return value;
}

function partCacheKey(node: AssemblyPartNode, forExport: boolean): string {
  return buildCacheKey(
    'assembly-part-v1',
    node.type,
    forExport,
    JSON.stringify(stableKeyValue(node.params))
  );
}

function centeredOnBounds(pts: readonly { x: number; y: number }[]): { x: number; y: number }[] {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return pts.map((p) => ({ x: p.x - cx, y: p.y - cy }));
}

/**
 * 2D drawing for a cutter profile, grown outward by `grow` mm. Matches the
 * proxy's centering rule: parametric shapes are origin-centered, path and
 * outline profiles are centered on their own bounding box. Null when the
 * profile is degenerate.
 */
export function cutterProfileDrawing(profile: CutterProfile, grow: number): Drawing | null {
  switch (profile.shape) {
    case 'circle': {
      const r = profile.diameter / 2 + grow;
      return r > 0.05 ? drawCircle(r) : null;
    }
    case 'rectangle': {
      const w = profile.width + 2 * grow;
      const d = profile.depth + 2 * grow;
      if (w <= 0.1 || d <= 0.1) return null;
      const r = Math.min(Math.max(profile.cornerRadius + grow, 0), Math.min(w, d) / 2 - 0.01);
      return drawRoundedRectangle(w, d, Math.max(r, 0));
    }
    case 'polygon': {
      const sides = clampPolygonSides(profile.sides);
      const dia = profile.diameter;
      if (dia <= 0.1) return null;
      const pts = regularPolygonPoints(sides, dia, dia);
      const grown = grow !== 0 ? offsetClosedPolygon(pts, grow) : pts;
      if (grown.length < 3) return null;
      return pathWire(grown);
    }
    case 'slot': {
      const length = profile.length + 2 * grow;
      const width = profile.width + 2 * grow;
      if (length <= 0.1 || width <= 0.1) return null;
      return drawRoundedRectangle(length, width, slotCornerRadius(length, width) - 0.01);
    }
    case 'path': {
      const polyline = dropCoincidentPoints(flattenPathToPolyline(profile.points));
      if (polyline.length < 3 || polylineSelfIntersects(polyline)) return null;
      const centered = centeredOnBounds(polyline);
      const grown = grow !== 0 ? offsetClosedPolygon(centered, grow) : centered;
      if (grown.length < 3) return null;
      return pathWire(grown);
    }
    case 'outline': {
      const polyline = dropCoincidentPoints(profile.points.map((p) => ({ x: p.x, y: p.y })));
      if (polyline.length < 3 || polylineSelfIntersects(polyline)) return null;
      const centered = centeredOnBounds(polyline);
      const grown = grow !== 0 ? offsetClosedPolygon(centered, grow) : centered;
      if (grown.length < 3) return null;
      return pathWire(grown);
    }
  }
}

/**
 * A cutter tool solid in the seat frame: occupies z ∈ [-depth, +overshoot]
 * with an optional 45°-ish entry chamfer collar lofted at the seat.
 */
function buildCutterSolid(params: CutterParams): Shape3D | null {
  const drawing = cutterProfileDrawing(params.profile, params.clearance);
  if (!drawing) return null;
  const body = sketch(drawing, 'XY', -params.depth).extrude(params.depth + CUTTER_TOP_OVERSHOOT);
  if (params.chamfer <= 0) return body;
  const inner = cutterProfileDrawing(params.profile, params.clearance);
  const outer = cutterProfileDrawing(params.profile, params.clearance + params.chamfer);
  if (!inner || !outer) return body;
  try {
    const collar = sketch(inner, 'XY', -params.chamfer).loftWith(
      [sketch(outer, 'XY', CUTTER_TOP_OVERSHOOT)],
      { ruled: true }
    );
    const fused = fuseAll([body, collar] as ValidSolid[], { optimisation: 'commonFace' });
    const result = unwrap(fused);
    if (result !== body) body.delete();
    if (result !== collar) collar.delete();
    return result;
  } catch {
    return body;
  }
}

/**
 * One part template in its seat frame: anchored on its footprint center,
 * additive solids rising from z = -COPLANAR_OVERLAP (sunk into whatever they
 * seat on so the fuse never meets a coplanar face), cutters sinking below 0.
 */
function buildPartTemplate(node: AssemblyPartNode): Shape3D | null {
  const sink = COPLANAR_OVERLAP;
  switch (node.type) {
    case 'post': {
      const { diameter, height, taperDeg } = node.params;
      const rBottom = diameter / 2;
      const rTop = Math.max(0.5, rBottom - height * Math.tan(taperDeg * DEG));
      const total = height + sink;
      if (taperDeg > 0) {
        return cone(rBottom, rTop, total, { at: [0, 0, -sink] });
      }
      return cylinder(rBottom, total, { at: [0, 0, -sink] });
    }
    case 'fin': {
      const { length, thickness, height, leanDeg } = node.params;
      const dy = Math.tan(leanDeg * DEG) * height;
      const pen = draw([-thickness / 2, -sink])
        .lineTo([thickness / 2, -sink])
        .lineTo([thickness / 2 + dy, height])
        .lineTo([-thickness / 2 + dy, height])
        .close();
      return sketch(pen, 'YZ', -length / 2).extrude(length);
    }
    case 'block': {
      const { width, depth, height, wedgeAngleDeg } = node.params;
      if (wedgeAngleDeg <= 0) {
        const total = height + sink;
        return box(width, depth, total, { at: [0, 0, total / 2 - sink] });
      }
      const lowEdge = Math.max(0.5, height - depth * Math.tan(wedgeAngleDeg * DEG));
      const pen = draw([-depth / 2, -sink])
        .lineTo([depth / 2, -sink])
        .lineTo([depth / 2, lowEdge])
        .lineTo([-depth / 2, height])
        .close();
      return sketch(pen, 'YZ', -width / 2).extrude(width);
    }
    case 'tube': {
      const { boreDiameter, wall, height, tiltDeg } = node.params;
      const outer = cylinder(boreDiameter / 2 + wall, height + sink, { at: [0, 0, -sink] });
      const bore = cylinder(boreDiameter / 2, height + 2 * sink + 2, {
        at: [0, 0, -sink - 1],
      });
      const hollow = unwrap(cut(outer, bore, { optimisation: 'commonFace' }));
      if (hollow !== outer) outer.delete();
      bore.delete();
      if (tiltDeg <= 0) return hollow;
      const tilted = rotate(hollow, tiltDeg, { at: [0, 0, 0], axis: [1, 0, 0] });
      hollow.delete();
      return tilted;
    }
    case 'cradle': {
      const { length, width, height, grooveStyle, grooveWidth, grooveDepth } = node.params;
      const gw = Math.min(grooveWidth, width - 1);
      const gd = Math.min(grooveDepth, height - 0.5);
      if (grooveStyle === 'vee') {
        const pen = draw([-width / 2, -sink])
          .lineTo([width / 2, -sink])
          .lineTo([width / 2, height])
          .lineTo([gw / 2, height])
          .lineTo([0, height - gd])
          .lineTo([-gw / 2, height])
          .lineTo([-width / 2, height])
          .close();
        return sketch(pen, 'YZ', -length / 2).extrude(length);
      }
      const total = height + sink;
      const body = box(length, width, total, { at: [0, 0, total / 2 - sink] });
      const r = gw / 2;
      const groove = cylinder(r, length + 20, {
        at: [-(length + 20) / 2, 0, height - gd + r],
        axis: [1, 0, 0],
      });
      const carved = unwrap(cut(body, groove, { optimisation: 'commonFace' }));
      if (carved !== body) body.delete();
      groove.delete();
      return carved;
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
      const solid = sketch(drawing, 'YZ', -width / 2).extrude(width);
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
      const fused = unwrap(fuseAll(parts as ValidSolid[], { optimisation: 'commonFace' }));
      for (const part of parts) {
        if (part !== fused) part.delete();
      }
      return fused;
    }
    case 'cutter':
      return buildCutterSolid(node.params);
  }
}

function positionedPartSolid(
  placed: PlacedPart,
  halfW: number,
  halfD: number,
  floorThickness: number,
  forExport: boolean,
  mirrorAxis: 'x' | 'y'
): Shape3D | null {
  const key = partCacheKey(placed.node, forExport);
  let template = getFeatureCache('assembly-part', key);
  if (!template) {
    const built = buildPartTemplate(placed.node);
    if (!built) return null;
    setFeatureCache('assembly-part', key, built);
    template = getFeatureCache('assembly-part', key);
    if (!template) template = built;
  }
  if (placed.mirrored) {
    const reflected = mirror(template, {
      normal: mirrorAxis === 'x' ? [1, 0, 0] : [0, 1, 0],
      at: [0, 0, 0],
    });
    template.delete();
    template = reflected;
  }
  const rotated =
    placed.rotZDeg !== 0 ? rotate(template, placed.rotZDeg, { axis: [0, 0, 1] }) : template;
  if (rotated !== template) template.delete();
  const positioned = translate(rotated, [
    placed.x - halfW,
    placed.y - halfD,
    floorThickness + placed.z,
  ]);
  rotated.delete();
  return positioned;
}

export function buildAssemblySolid(
  structure: AssemblyStructure,
  envelope: ItemEnvelope,
  forExport: boolean,
  signal?: AbortSignal,
  onStage?: (stage: 'features' | 'merge', progress: number) => void
): Shape3D {
  const unitMm = envelope.gridUnitMm;
  const totalW = envelope.width * unitMm - CLEARANCE;
  const totalD = envelope.depth * unitMm - CLEARANCE;
  const floorThickness = structure.base.floorThickness;
  const cornerRadius = Math.min(
    Math.max(structure.base.cornerRadius ?? DEFAULT_FLOOR_CORNER_RADIUS, 0.1),
    Math.min(totalW, totalD) / 2 - 0.1
  );

  return withScope((scope) => {
    const floor = sketch(
      drawRoundedRectangle(totalW, totalD, cornerRadius),
      'XY',
      -COPLANAR_OVERLAP
    ).extrude(floorThickness + COPLANAR_OVERLAP);

    const placements = resolvePlacedParts(structure, {
      w: envelope.width * unitMm,
      d: envelope.depth * unitMm,
    });
    const additive: Shape3D[] = [floor];
    const cutters: Shape3D[] = [];
    for (const placed of placements) {
      checkCancelled(signal);
      const solid = positionedPartSolid(
        placed,
        (envelope.width * unitMm) / 2,
        (envelope.depth * unitMm) / 2,
        floorThickness,
        forExport,
        structure.mirrorAxis
      );
      if (!solid) continue;
      if (placed.node.type === 'cutter') cutters.push(scope.register(solid));
      else additive.push(scope.register(solid));
    }
    scope.register(floor);
    onStage?.('features', 0.5);

    const superstructure = unwrap(
      fuseAll(additive as ValidSolid[], { optimisation: 'commonFace' })
    );
    if (!additive.includes(superstructure)) scope.register(superstructure);

    checkCancelled(signal);
    const socket = buildBaseSocket(
      envelope.width,
      envelope.depth,
      envelope.attachment.magnetHoles,
      envelope.attachment.screwHoles,
      envelope.attachment.magnetDiameter / 2,
      envelope.attachment.magnetDepth,
      envelope.attachment.screwDiameter / 2,
      forExport,
      DEFAULT_SOCKET_CELL_PLAN,
      unitMm
    );
    const socketClone = scope.register(unwrap(clone(socket)));
    const fused = unwrap(
      fuseAll([superstructure, socketClone] as ValidSolid[], { optimisation: 'commonFace' })
    );
    if (fused !== superstructure && fused !== socketClone) scope.register(fused);
    onStage?.('merge', 0.7);

    checkCancelled(signal);
    let solid: Shape3D = fused;
    if (cutters.length > 0) {
      const carved = unwrap(cutAll(fused, cutters as ValidSolid[], { optimisation: 'commonFace' }));
      if (carved !== fused) scope.register(carved);
      solid = carved;
    }

    return translate(solid, [0, 0, SOCKET_HEIGHT]);
  });
}

export function generateAssembly(
  structure: AssemblyStructure,
  envelope: ItemEnvelope,
  onProgress: ProgressFn,
  forExport: boolean,
  signal?: AbortSignal
): MeshData {
  onProgress('base', 0);
  checkCancelled(signal);
  const solid = buildAssemblySolid(structure, envelope, forExport, signal, (stage, progress) =>
    onProgress(stage, progress)
  );
  try {
    checkCancelled(signal);
    onProgress('merge', 0.85);
    const maxDimension = Math.max(envelope.width, envelope.depth) * envelope.gridUnitMm;
    const { tolerance, angularToleranceRad } = computeTessellationTolerances(
      forExport,
      false,
      maxDimension
    );
    const meshResult = mesh(solid, { tolerance, angularTolerance: angularToleranceRad });
    const edgeVertices =
      getKernelCapabilities().tessellationModel === 'build-time'
        ? creaseEdges(meshResult)
        : new Float32Array(
            meshEdges(solid, { tolerance, angularTolerance: EDGE_ANGULAR_TOLERANCE_RAD }).lines
          );
    onProgress('merge', 1);
    return toIndexedMeshData(meshResult, edgeVertices);
  } finally {
    solid.delete();
  }
}

export interface AssemblyExportResult {
  readonly data: ArrayBuffer;
  readonly fileName: string;
}

export async function exportAssembly(
  structure: AssemblyStructure,
  envelope: ItemEnvelope,
  format: ExportFormat,
  tolerance = 0.01,
  angularTolerance = EXPORT_ANGULAR_TOLERANCE_RAD
): Promise<AssemblyExportResult> {
  const solid = buildAssemblySolid(structure, envelope, true);
  const name = assemblyDescriptor.exportFileName(envelope, structure);
  try {
    if (format === 'step') {
      const blob = unwrapExportBlob(exportSTEP(solid), 'STEP');
      return { data: await blob.arrayBuffer(), fileName: `${name}.step` };
    }
    const data = await exportSolidToStl(solid, name, tolerance, angularTolerance);
    return { data, fileName: `${name}.stl` };
  } finally {
    solid.delete();
  }
}
