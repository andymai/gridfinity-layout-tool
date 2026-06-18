/**
 * Slanted tool rack generation.
 *
 * A floor plate on a Gridfinity socket base with a row of angled fins; tools
 * (pliers, tweezers, cutters) rest leaning back in the gaps between fins. A flat
 * (non-pipeline) generator mirroring `baseplateGenerator`.
 *
 * Coordinate system (before the final Z-shift):
 * - Socket occupies Z ∈ [-SOCKET_HEIGHT, 0] (Z=0 = baseplate mating face).
 * - Floor plate Z ∈ [0, floorThickness]; fins rise from the floor top.
 * Fins lean toward +Y as they rise. The whole assembly is shifted +SOCKET_HEIGHT
 * at the end so Z=0 becomes the printable bottom (matching the baseplate).
 */
import {
  drawRoundedRectangle,
  draw,
  box,
  unwrap,
  clone,
  translate,
  fuseAll,
  intersect,
  withScope,
  mesh,
  meshEdges,
  getKernelCapabilities,
  exportSTEP,
} from 'brepjs';
import type { Shape3D, ValidSolid, DisposalScope } from 'brepjs';
import type { ItemEnvelope, ToolRackStructure } from '@/shared/types/item';
import type { MeshData, ExportFormat } from '../../bridge/types';
import { SOCKET_HEIGHT, toIndexedMeshData, checkCancelled } from './generatorTypes';
import type { ProgressFn } from './generatorTypes';
import { COPLANAR_OVERLAP } from './generatorConstants';
import { buildBaseSocket } from './socketBuilder';
import { sketch } from './meshUtils';
import { creaseEdges } from './utils';
import { keepOuterShell } from './utils/outerShell';
import { buildBaseplateSTL } from './baseplateSTL';

interface ResolvedFins {
  readonly count: number;
  readonly pitch: number;
}

/** Resolve fin count + spacing from explicit count or pitch across the width. */
function resolveFins(structure: ToolRackStructure, usableW: number): ResolvedFins {
  if (usableW <= 0) {
    throw new Error('Invalid tool rack: footprint too small for fins');
  }
  const pitch = structure.slotPitch ?? 16;
  const count = Math.max(2, structure.finCount ?? Math.round(usableW / pitch) + 1);
  return { count, pitch: count > 1 ? usableW / (count - 1) : 0 };
}

/**
 * One fin centered at X=0, spanning Y across the footprint, leaning +Y as it
 * rises. Built as a parallelogram in the YZ plane extruded along X, then clipped
 * to the footprint depth so the leaned-back top doesn't overshoot the plate.
 */
function buildLeaningFin(
  scope: DisposalScope,
  finThickness: number,
  finHeight: number,
  depthMm: number,
  angleDeg: number,
  z0: number
): Shape3D {
  const dy = Math.tan((angleDeg * Math.PI) / 180) * finHeight;
  const zBottom = z0 - COPLANAR_OVERLAP;
  const zTop = z0 + finHeight;
  // 2D coords on 'YZ' map to (Y, Z). A transposed mapping is caught by the
  // scenario bbox assert (leaning fins must extend further in +Y).
  const pen = draw([-depthMm / 2, zBottom])
    .lineTo([depthMm / 2, zBottom])
    .lineTo([depthMm / 2 + dy, zTop])
    .lineTo([-depthMm / 2 + dy, zTop])
    .close();
  const prism = scope.register(sketch(pen, 'YZ', -finThickness / 2).extrude(finThickness));
  const clipH = finHeight + z0 + 1;
  const clip = scope.register(box(finThickness + 2, depthMm, clipH, { at: [0, 0, clipH / 2] }));
  try {
    return scope.register(unwrap(intersect(prism as ValidSolid, clip)));
  } catch {
    return prism;
  }
}

/** Build the full tool rack solid (floor + fins + back rail + socket base). */
export function buildToolRackSolid(
  structure: ToolRackStructure,
  envelope: ItemEnvelope,
  forExport: boolean
): Shape3D {
  const totalW = envelope.width * envelope.gridUnitMm;
  const totalD = envelope.depth * envelope.gridUnitMm;
  const z0 = structure.floorThickness;
  const usableW = totalW - 2 * structure.slotInsetMm;
  const { count, pitch } = resolveFins(structure, usableW);

  return withScope((scope) => {
    // (a) Floor plate, Z ∈ [0, floorThickness].
    const radius = Math.min(structure.cornerRadius ?? 4, Math.min(totalW, totalD) / 2 - 0.1);
    const floor = scope.register(
      drawRoundedRectangle(totalW, totalD, Math.max(radius, 0.1)).sketchOnPlane('XY', 0).extrude(z0)
    );

    // (b) Fins: build one, clone+translate across X.
    const baseFin = buildLeaningFin(
      scope,
      structure.finThickness,
      structure.finHeight,
      totalD,
      structure.finAngleDeg,
      z0
    );
    const parts: Shape3D[] = [floor];
    for (let i = 0; i < count; i++) {
      const x = -totalW / 2 + structure.slotInsetMm + i * pitch;
      parts.push(translate(scope.register(unwrap(clone(baseFin))), [x, 0, 0]));
    }

    // (c) Optional back rail along +Y, fins fuse into it.
    if (structure.backRail.enabled) {
      const r = structure.backRail;
      parts.push(
        scope.register(
          box(totalW, r.thickness, r.height, {
            at: [0, totalD / 2 - r.thickness / 2, z0 - COPLANAR_OVERLAP + r.height / 2],
          })
        )
      );
    }

    // (d) Fuse superstructure onto the floor.
    const superstructure = scope.register(
      unwrap(fuseAll(parts as ValidSolid[], { optimisation: 'commonFace' }))
    );

    // (e) Socket base (cache-owned survivor — clone before fusing, never delete).
    const socket = buildBaseSocket(
      envelope.width,
      envelope.depth,
      envelope.attachment.magnetHoles,
      envelope.attachment.screwHoles,
      envelope.attachment.magnetDiameter / 2,
      envelope.attachment.magnetDepth,
      envelope.attachment.screwDiameter / 2,
      forExport,
      false,
      envelope.gridUnitMm
    );
    const socketClone = scope.register(unwrap(clone(socket)));
    const fused = scope.register(
      unwrap(fuseAll([superstructure, socketClone] as ValidSolid[], { optimisation: 'commonFace' }))
    );

    // (f) Shift so Z=0 is the printable bottom.
    return translate(fused, [0, 0, SOCKET_HEIGHT]);
  });
}

/** Preview/export mesh for a slanted tool rack. */
export function generateToolRack(
  structure: ToolRackStructure,
  envelope: ItemEnvelope,
  onProgress: ProgressFn,
  forExport: boolean,
  signal?: AbortSignal
): MeshData {
  onProgress('base', 0);
  checkCancelled(signal);

  const rack = buildToolRackSolid(structure, envelope, forExport);
  onProgress('base', 0.9);
  checkCancelled(signal);

  const maxDimension = Math.max(envelope.width, envelope.depth) * envelope.gridUnitMm;
  const tolerance = forExport ? 0.01 : Math.min(0.4, Math.max(0.15, maxDimension / 600));
  const angularTolerance = forExport ? 5 : 12;

  try {
    const meshResult = mesh(rack, { tolerance, angularTolerance });
    const edgeVerts: ArrayLike<number> =
      getKernelCapabilities().tessellationModel === 'build-time'
        ? creaseEdges(meshResult)
        : meshEdges(rack, { tolerance, angularTolerance: angularTolerance * 0.5 }).lines;
    onProgress('base', 1);
    return toIndexedMeshData(meshResult, edgeVerts);
  } finally {
    rack.delete();
  }
}

/** Standalone STL/STEP export for a slanted tool rack. */
export async function exportToolRack(
  structure: ToolRackStructure,
  envelope: ItemEnvelope,
  format: ExportFormat,
  tolerance = 0.02,
  angularTolerance = 6
): Promise<{ data: ArrayBuffer; fileName: string }> {
  const built = buildToolRackSolid(structure, envelope, false);
  const rack = keepOuterShell(built);
  if (rack !== built) built.delete();
  const name = `tool_rack_${envelope.width}x${envelope.depth}`;
  try {
    if (format === 'step') {
      const blob = unwrap(exportSTEP(rack));
      const data = await blob.arrayBuffer();
      return { data, fileName: `${name}.step` };
    }
    const meshResult = mesh(rack, { tolerance, angularTolerance });
    const data = buildBaseplateSTL(meshResult, name);
    return { data, fileName: `${name}.stl` };
  } finally {
    rack.delete();
  }
}
