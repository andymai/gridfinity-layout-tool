/**
 * Tessellate stage — converts BREP solid to triangle mesh.
 *
 * Dynamic quality selection via computeTessellationTolerances().
 *
 * LOD infrastructure (coarseMesh, CoarseLODData, BinMesh Detailed) is wired
 * through the pipeline but not yet activated here — meshMultiLOD doubles
 * tessellation cost. Enable by setting coarseMesh in the return value.
 */

import {
  compound,
  fuse,
  getBounds,
  getKernelCapabilities,
  getShells,
  getSolids,
  measureVolume,
  mesh,
  meshEdges,
  unwrap,
} from 'brepjs';
import type { Bounds3D, Shape3D } from 'brepjs';
import type { PipelineContext, PipelineStage } from '../types';
import type { MeshData } from '../../../../bridge/types';
import { toIndexedMeshData } from '../../utils/mesh';
import { creaseEdges } from '../../utils';
import { computeTessellationTolerances } from '../../utils/tolerances';
import { setLastExportShellCount, setLastSolid } from '../../shapeCache';
import { paramsFingerprint } from '@/shared/generation/paramsFingerprint';
import { getSocketMesh, setSocketMesh, socketMeshKey } from '../../socketMeshCache';
import { keepOuterShell } from '../../utils/outerShell';
import { copyFaceOrigins } from '../collectOrigins';
import { EDGE_ANGULAR_TOLERANCE_RAD } from '@/shared/constants/tessellation';

const BOUNDS_SLACK_MM = 0.01;
const VOLUME_SLACK = 1e-3;

function boundsOrNull(shape: Shape3D): Bounds3D | null {
  try {
    return getBounds(shape);
  } catch {
    return null;
  }
}

function volumeOrNaN(shape: Shape3D): number {
  try {
    return unwrap(measureVolume(shape));
  } catch {
    return Number.NaN;
  }
}

function covers(outer: Bounds3D, inner: Bounds3D): boolean {
  return (
    outer.xMin <= inner.xMin + BOUNDS_SLACK_MM &&
    outer.yMin <= inner.yMin + BOUNDS_SLACK_MM &&
    outer.zMin <= inner.zMin + BOUNDS_SLACK_MM &&
    outer.xMax >= inner.xMax - BOUNDS_SLACK_MM &&
    outer.yMax >= inner.yMax - BOUNDS_SLACK_MM &&
    outer.zMax >= inner.zMax - BOUNDS_SLACK_MM
  );
}

/**
 * Collapse an export body to its outer shell. Additive feature fuses can leave
 * interior void shells inside an otherwise valid solid, which STL tessellates
 * as doubled (non-manifold) faces.
 */
function collapseForExport(shape: Shape3D): Shape3D {
  setLastExportShellCount(getShells(shape).length);
  const outer = keepOuterShell(shape);
  if (outer !== shape) shape.delete();
  return outer;
}

/**
 * Whether `fused` still holds all of the body and the socket. The kernel's fuse
 * can report success without that: handed a body it cannot union, it returns
 * one of the body's solids with the socket gone, or nothing at all, which no
 * exporter can write. Body and socket only touch, so the union's volume is
 * their sum. Measuring volume is slow on a patterned body, so it runs only
 * where geometry can go missing without moving the bounds: a multi-solid body,
 * or a fuse that came back in several shells.
 */
function holdsBodyAndSocket(fused: Shape3D, body: Shape3D, socket: Shape3D): boolean {
  if (getSolids(fused).length === 0) return false;
  const fusedBounds = boundsOrNull(fused);
  const bodyBounds = boundsOrNull(body);
  const socketBounds = boundsOrNull(socket);
  if (!fusedBounds || !bodyBounds || !socketBounds) return false;
  if (!covers(fusedBounds, bodyBounds) || !covers(fusedBounds, socketBounds)) return false;
  if (getSolids(body).length <= 1 && getShells(fused).length <= 1) return true;
  const expected = volumeOrNaN(body) + volumeOrNaN(socket);
  const actual = volumeOrNaN(fused);
  return (
    Number.isFinite(expected) && Number.isFinite(actual) && actual >= expected * (1 - VOLUME_SLACK)
  );
}

/**
 * The fused, collapsed body, or null when any step fails or loses part of
 * either operand. A socket the fuse leaves unjoined is a shell of its own,
 * which the outer-shell collapse would throw away, so the collapsed result
 * has to still reach the socket too. Leaves both operands alive.
 */
function fuseWhole(body: Shape3D, socket: Shape3D): Shape3D | null {
  let result: Shape3D | null = null;
  try {
    result = unwrap(fuse(body, socket));
    if (!holdsBodyAndSocket(result, body, socket)) {
      result.delete();
      return null;
    }
    const socketBounds = getBounds(socket);
    result = collapseForExport(result);
    if (covers(getBounds(result), socketBounds)) return result;
    result.delete();
    return null;
  } catch {
    try {
      result?.delete();
    } catch {
      // Already unusable; the compound below does not depend on it.
    }
    return null;
  }
}

/**
 * Fuse the deferred socket into the body for export. When the kernel cannot,
 * export the two side by side in one compound: they meet only at the floor, so
 * the file carries the whole bin, seam and all, instead of a body without feet.
 */
function fuseSocketForExport(body: Shape3D, socket: Shape3D): Shape3D {
  const fused = fuseWhole(body, socket);
  if (fused) {
    body.delete();
    socket.delete();
    return fused;
  }
  const both = compound([body, socket]) as Shape3D;
  copyFaceOrigins(both, [body, socket]);
  body.delete();
  socket.delete();
  setLastExportShellCount(getShells(both).length);
  return both;
}

export const tessellateStage: PipelineStage = {
  name: 'merge',
  progressValue: 0.9,

  shouldRun(): boolean {
    return true;
  },

  execute(ctx: PipelineContext): PipelineContext {
    const rawSolid = ctx.solid;
    const { dimensions: dim, forExport } = ctx;
    if (!rawSolid) return ctx;

    // EXPORT: fuse the deferred base socket into the featured body for a single
    // watertight solid. The socket is deferred past the feature stage (see
    // shellStage) so feature fuses run on the socket-less body — fusing it
    // earlier made additive features like the label bracket non-manifold
    // (GH). PREVIEW keeps the socket deferred and meshes it separately, and
    // never feeds this solid to an exporter.
    let solid = rawSolid;
    if (forExport && ctx.deferredSolid) {
      solid = fuseSocketForExport(rawSolid, ctx.deferredSolid);
      ctx = { ...ctx, solid, deferredSolid: null };
    } else if (forExport) {
      solid = collapseForExport(rawSolid);
    }

    // Stamping the params lets `exportBin` tell this solid apart from one left
    // behind by a different design on the same worker (GH). Only meaningful
    // for export passes — a preview solid is regenerated regardless.
    setLastSolid(solid, forExport, forExport ? paramsFingerprint(ctx.params) : null);

    const { tolerance, angularToleranceRad } = computeTessellationTolerances(
      forExport,
      dim.hasLip,
      dim.maxDimension
    );

    const shapeMesh = mesh(solid, { tolerance, angularTolerance: angularToleranceRad });

    // Build-time kernels (manifold draft) have no B-rep topology, so their
    // meshEdges() returns the full triangle wireframe. Recover clean feature
    // edges from the mesh via dihedral crease detection. Extract-time kernels
    // (occt) keep their native analytic edge extractor.
    const buildTime = getKernelCapabilities().tessellationModel === 'build-time';
    const edgeLines: ArrayLike<number> = buildTime
      ? creaseEdges(shapeMesh)
      : meshEdges(solid, { tolerance, angularTolerance: EDGE_ANGULAR_TOLERANCE_RAD }).lines;

    // Socket still deferred — the preview path (which skips the expensive
    // socket↔body fuse) or an export whose fuse failed above. Tessellate it
    // separately; `mergeBaseStage` concatenates it after the mesh imprint. The
    // socket only meets the body at a hidden interface, so the merged mesh is
    // visually identical to the fused shell (though not watertight at the seam).
    let deferredMesh: MeshData | null = null;
    const { deferredSolid, deferredSolidKey } = ctx;
    if (deferredSolid) {
      try {
        // Reuse the socket's mesh across edits that don't change its geometry or
        // the tessellation tolerance — the dominant case during interactive
        // design, where the body's features change but the base does not. A null
        // key (lightweight base) always re-meshes.
        const cacheKey = deferredSolidKey
          ? socketMeshKey(deferredSolidKey, tolerance, angularToleranceRad, buildTime)
          : null;
        let cached = cacheKey ? getSocketMesh(cacheKey) : null;
        if (!cached) {
          const socketMesh = mesh(deferredSolid, {
            tolerance,
            angularTolerance: angularToleranceRad,
          });
          const socketEdges = buildTime
            ? creaseEdges(socketMesh)
            : meshEdges(deferredSolid, { tolerance, angularTolerance: EDGE_ANGULAR_TOLERANCE_RAD })
                .lines;
          cached = { mesh: socketMesh, edgeLines: socketEdges };
          if (cacheKey) setSocketMesh(cacheKey, cached);
        }
        deferredMesh = toIndexedMeshData(cached.mesh, cached.edgeLines, ctx.originToTag);
      } finally {
        // Dispose even if mesh/meshEdges throws, so the WASM handle never leaks.
        deferredSolid.delete();
      }
    }

    ctx.onProgress?.('merge', 1.0);
    const meshData = toIndexedMeshData(shapeMesh, edgeLines, ctx.originToTag);
    return {
      ...ctx,
      mesh: meshData,
      deferredMesh,
      coarseMesh: null,
      solid: null,
      deferredSolid: null,
    };
  },
};
