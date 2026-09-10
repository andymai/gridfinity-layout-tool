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
  cut,
  cutAll,
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
import type { DisposalScope, Edge, Shape3D, ValidSolid } from 'brepjs';
import type { AssemblyPartNode, AssemblyStructure } from '@/shared/types/assembly';
import type { ItemEnvelope } from '@/shared/types/item';
import { assemblyDescriptor } from '@/shared/items/assembly/descriptor';
import { resolvePlacedParts, type PlacedPart } from '@/shared/types/assemblyPlacement';
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
import { applyFilletWithFallback } from './cutoutBuilder';
import { buildCacheKey, quantize } from './cacheKeyUtils';
import { getFeatureCache, setFeatureCache } from './shapeCache';
import { sketch } from './meshUtils';
import { DEG, edgesNearPlane, buildPartTemplate } from './assemblyPartTemplate';
export { cutterProfileDrawing } from './assemblyPartTemplate';
import { applyPartLabel } from './assemblyPartLabel';

/** Default outer corner radius of the floor plate when the base sets none. */
const DEFAULT_FLOOR_CORNER_RADIUS = 4;

const JUNCTION_FILLET_MM = 1.5;

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

function partCacheKey(node: AssemblyPartNode): string {
  // No forExport in the key: templates are pure BREP solids with no
  // tessellation-quality input, so preview and export share one entry.
  return buildCacheKey('assembly-part-v2', node.type, JSON.stringify(stableKeyValue(node.params)));
}

function positionedPartSolid(
  placed: PlacedPart,
  halfW: number,
  halfD: number,
  floorThickness: number,
  mirrorAxis: 'x' | 'y',
  scope?: DisposalScope
): Shape3D | null {
  const key = partCacheKey(placed.node);
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
  if (scope && placed.node.label) {
    template = applyPartLabel(scope, template, placed.node);
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

  const wedge = structure.base.wedge;
  const wedgeAngle = wedge !== undefined && wedge.angleDeg > 0 ? wedge.angleDeg : 0;
  // In wedge mode the deck sits strictly inside the straight-walled plinth:
  // a rotated full-width plate's bottom edge would lie exactly in the
  // plinth's wall plane (a surface tangency OCCT tessellates with cracks),
  // and its leaning top edge would overhang the envelope. The inset covers
  // the worst-case lean, floorThickness * sin(angle).
  const deckInset = wedgeAngle > 0 ? floorThickness * Math.sin(wedgeAngle * DEG) + 0.6 : 0;
  const deckW = totalW - 2 * deckInset;
  const deckD = totalD - 2 * deckInset;
  const deckCorner = Math.min(cornerRadius, Math.min(deckW, deckD) / 2 - 0.1);

  return withScope((scope) => {
    let floor = sketch(
      drawRoundedRectangle(deckW, deckD, deckCorner),
      'XY',
      -COPLANAR_OVERLAP
    ).extrude(floorThickness + COPLANAR_OVERLAP);
    if (deckInset > 0) {
      // The top of the deck keeps the full footprint so a part seated
      // anywhere on it (including the rim strip the inset exposes) still
      // fuses into the deck instead of floating above the plinth. Only
      // points above the hinge plane, which all lean inward, are full
      // width, so the tangency and envelope arguments for the inset hold.
      const capT = Math.max(0.6, Math.min(1.2, floorThickness / 2));
      const cap = sketch(
        drawRoundedRectangle(totalW, totalD, cornerRadius),
        'XY',
        floorThickness - capT
      ).extrude(capT);
      const stepped = unwrap(fuseAll([floor, cap] as ValidSolid[])) as Shape3D;
      if (stepped !== floor) floor.delete();
      if (stepped !== cap) cap.delete();
      floor = stepped;
    }

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
        structure.mirrorAxis,
        scope
      );
      if (!solid) continue;
      if (placed.node.type === 'cutter') cutters.push(scope.register(solid));
      else additive.push(scope.register(solid));
    }
    scope.register(floor);
    onStage?.('features', 0.5);

    let superstructure = unwrap(
      fuseAll(additive as ValidSolid[], { optimisation: 'commonFace' })
    ) as Shape3D;
    if (!additive.includes(superstructure)) scope.register(superstructure);

    // Molded blend at every seat plane: the concave cove where a part meets
    // the floor (or a parent's top face) is the single strongest cue that the
    // assembly was designed as one object rather than boolean-unioned. The
    // same pass rounds the floor plate's own rim. Failures fall back through
    // smaller radii to the sharp union.
    const seatPlanes = new Set<number>([floorThickness]);
    for (const placed of placements) {
      if (placed.node.type !== 'cutter') seatPlanes.add(floorThickness + placed.z);
    }
    const junctionEdges: Edge[] = [];
    for (const plane of seatPlanes) {
      junctionEdges.push(...edgesNearPlane(superstructure, plane, 0.3));
    }
    if (junctionEdges.length > 0) {
      const blended = applyFilletWithFallback(
        superstructure,
        junctionEdges,
        Math.min(JUNCTION_FILLET_MM, floorThickness * 0.75)
      );
      if (blended !== superstructure) {
        superstructure = scope.register(blended);
      }
    }

    // Presentation wedge: rotate the finished superstructure about its low
    // bottom edge and fill beneath with a prism to the flat socket plane —
    // parts tilt with the surface, the socket never does. Cutters get the
    // same transform below so holes stay where they were placed.
    let wedgeTransform: {
      at: [number, number, number];
      axis: [number, number, number];
      angle: number;
    } | null = null;
    if (wedgeAngle > 0 && wedge !== undefined) {
      const halfW = totalW / 2;
      const halfD = totalD / 2;
      wedgeTransform =
        wedge.lowEdge === 'front'
          ? { at: [0, -halfD, 0], axis: [1, 0, 0], angle: wedgeAngle }
          : wedge.lowEdge === 'back'
            ? { at: [0, halfD, 0], axis: [1, 0, 0], angle: -wedgeAngle }
            : wedge.lowEdge === 'left'
              ? { at: [-halfW, 0, 0], axis: [0, 1, 0], angle: -wedgeAngle }
              : { at: [halfW, 0, 0], axis: [0, 1, 0], angle: wedgeAngle };
      const rotatedSuper = rotate(superstructure, wedgeTransform.angle, {
        at: wedgeTransform.at,
        axis: wedgeTransform.axis,
      });
      scope.register(rotatedSuper);
      const tan = Math.tan(wedgeAngle * DEG);
      const rise = (wedge.lowEdge === 'front' || wedge.lowEdge === 'back' ? totalD : totalW) * tan;
      // The plinth's low wall keeps a blunt face: a clip plane through the
      // slab's bottom edge leaves either a knife edge or a sub-tolerance wall
      // strip there, and both tessellate with cracks. Hinging the clip this
      // far up buries the deck's underside in the filler by the same amount,
      // so the cap keeps it under the deck's thickness.
      const lowFaceTop = Math.min(Math.max(3 * tan, 0.3), 0.6 * floorThickness);
      const slab = scope.register(
        sketch(drawRoundedRectangle(totalW, totalD, cornerRadius), 'XY', -COPLANAR_OVERLAP).extrude(
          rise + lowFaceTop + 2
        )
      );
      const clipSize = Math.max(totalW, totalD) * 3;
      // The box's bottom face must contain the pivot line: rotating about a
      // point above the face only shifts the cut plane by h*(1 - 1/cos), so
      // the plane would stay at the hinge and leave the sliver (and a
      // micron-scale deck gap the mesh weld tolerance hides).
      const clipBox = box(clipSize, clipSize, clipSize, {
        at: [0, 0, clipSize / 2 + lowFaceTop],
      });
      const clip = rotate(clipBox, wedgeTransform.angle, {
        at: [wedgeTransform.at[0], wedgeTransform.at[1], lowFaceTop],
        axis: wedgeTransform.axis,
      });
      clipBox.delete();
      const filler = unwrap(cut(slab, clip, { optimisation: 'commonFace' }));
      clip.delete();
      if (filler !== slab) scope.register(filler);
      const merged = unwrap(
        fuseAll([rotatedSuper, filler] as ValidSolid[], { optimisation: 'commonFace' })
      ) as Shape3D;
      if (merged !== rotatedSuper && merged !== filler) scope.register(merged);
      superstructure = merged;
    }

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
      const effectiveCutters =
        wedgeTransform === null
          ? cutters
          : cutters.map((cutter) =>
              scope.register(
                rotate(cutter, wedgeTransform.angle, {
                  at: wedgeTransform.at,
                  axis: wedgeTransform.axis,
                })
              )
            );
      const carved = unwrap(
        cutAll(fused, effectiveCutters as ValidSolid[], { optimisation: 'commonFace' })
      );
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
