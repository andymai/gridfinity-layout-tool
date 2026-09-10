/**
 * Mesh imprint subtraction — carves imported STL tools into the tessellated
 * bin as contoured pockets (true shadow-board imprints).
 *
 * Runs AFTER tessellation in the mesh domain via raw manifold-3d, because an
 * arbitrary triangle mesh can't enter the BREP boolean path. One code path
 * covers draft preview, exact preview, single-piece export, and split pieces
 * — they all end as indexed mesh arrays.
 *
 * The generation pipeline is synchronous, but module load + asset decode are
 * async, so callers await {@link prepareMeshImprints} in the (async) worker
 * handlers first; the pipeline stage then runs on the prepared cache.
 *
 * Face provenance: the bin's `faceGroups` tag ranges are encoded as Manifold
 * mesh runs (`reserveIDs`/`runOriginalID`), which survive the boolean, so
 * feature-color tags carry through and tool-carved faces are identifiable.
 */

import type { Manifold, ManifoldToplevel } from 'manifold-3d';
import type { BinParams } from '@/shared/types/bin';
import {
  decodeMeshData,
  hasMeshImprints,
  visibleMeshImprintCutouts as visibleMeshCutouts,
} from '@/shared/generation/meshAsset';
import { isOk } from '@/core/result';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import {
  cutoutColorTag,
  cutoutUnitKey,
  enumerateCutoutColorUnits,
} from '@/shared/generation/cutoutColorUnits';
import type { FaceGroupData, MeshData } from '../../bridge/types';
import type { BinDimensions } from './pipeline/types';
import { creaseEdges } from './utils/creaseEdges';
import { computeCreaseNormals } from './meshImprintNormals';
import type { NormalizedMesh } from './meshImprintNormals';
import { getLoadedManifoldModule, getManifoldModule } from '../manifoldRuntime';
import {
  frameFromDimensions,
  instanceBounds,
  boundsOverlap,
  minTopShoulder,
  buildInstanceTool,
} from './meshImprintTools';
import type { PreparedTool, ImprintFrame, Bounds2D } from './meshImprintTools';

/** FeatureTag.UNKNOWN — faces with no recorded provenance. */
const TAG_UNKNOWN = 255;
/** Prepared tool manifolds kept per worker (content-keyed). */
const MAX_PREPARED_TOOLS = 16;

const preparedTools = new Map<string, PreparedTool>();
let activeModule: ManifoldToplevel | null = null;

/**
 * Re-exported rather than defined here: the export UI has to disable STEP on
 * exactly the condition `binExporter` throws on, and it cannot import this
 * module (manifold-3d, WASM). See `meshAsset.visibleMeshImprintCutouts`.
 */
export { hasMeshImprints };

function disposeTool(tool: PreparedTool | undefined): void {
  if (!tool) return;
  tool.manifold?.delete();
  for (const dilated of tool.dilations.values()) dilated.delete();
  tool.dilations.clear();
}

/** Drop all prepared tool manifolds (worker CLEANUP path). */
export function clearMeshImprintCache(): void {
  for (const tool of preparedTools.values()) disposeTool(tool);
  preparedTools.clear();
}

/**
 * Async pre-pass: ensure the manifold module is loaded and every referenced
 * mesh asset is decoded into a cached `Manifold`. Must run before the
 * synchronous pipeline stage; a design without mesh imprints returns
 * immediately.
 */
export async function prepareMeshImprints(
  params: BinParams,
  moduleOverride?: ManifoldToplevel
): Promise<void> {
  const cutouts = visibleMeshCutouts(params);
  if (cutouts.length === 0) return;
  const module = moduleOverride ?? (await getManifoldModule());
  activeModule = module;

  for (const cutout of cutouts) {
    const asset = params.meshAssets?.[cutout.meshId ?? ''];
    if (!asset || preparedTools.has(asset.data)) continue;

    let manifold: Manifold | null = null;
    let topShoulder = 0;
    const decoded = await decodeMeshData(asset.data);
    if (isOk(decoded)) {
      // Compute the shoulder first (pure JS): a throw here then can't strand an
      // already-allocated WASM manifold.
      topShoulder = minTopShoulder(decoded.value.positions, decoded.value.indices);
      try {
        const mesh = new module.Mesh({
          numProp: 3,
          vertProperties: decoded.value.positions,
          triVerts: decoded.value.indices,
        });
        mesh.merge();
        manifold = new module.Manifold(mesh);
      } catch {
        manifold = null;
      }
    }

    if (preparedTools.size >= MAX_PREPARED_TOOLS) {
      const oldest = preparedTools.keys().next().value;
      if (oldest !== undefined) {
        disposeTool(preparedTools.get(oldest));
        preparedTools.delete(oldest);
      }
    }
    preparedTools.set(asset.data, { manifold, topShoulder, dilations: new Map() });
  }
}

// ── Placement ────────────────────────────────────────────────────────────────

// ── Provenance runs ──────────────────────────────────────────────────────────

interface RunEncoding {
  readonly runIndex: Uint32Array;
  readonly runOriginalID: Uint32Array;
  readonly idToTag: ReadonlyMap<number, number>;
}

/**
 * Encode `faceGroups` (index-unit ranges) as Manifold mesh runs so tags
 * survive the boolean. Gaps and untagged spans become UNKNOWN runs.
 */
function encodeRuns(
  module: ManifoldToplevel,
  indexCount: number,
  faceGroups: readonly FaceGroupData[] | undefined
): RunEncoding | null {
  const spans: { start: number; count: number; tag: number }[] = [];
  const sorted = [...(faceGroups ?? [])].sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const group of sorted) {
    if (group.start > cursor)
      spans.push({ start: cursor, count: group.start - cursor, tag: TAG_UNKNOWN });
    if (group.start < cursor || group.count % 3 !== 0 || group.start % 3 !== 0) return null;
    spans.push({ start: group.start, count: group.count, tag: group.tag });
    cursor = group.start + group.count;
  }
  if (cursor > indexCount) return null;
  if (cursor < indexCount)
    spans.push({ start: cursor, count: indexCount - cursor, tag: TAG_UNKNOWN });

  const firstId = module.Manifold.reserveIDs(spans.length);
  const runIndex = new Uint32Array(spans.length + 1);
  const runOriginalID = new Uint32Array(spans.length);
  const idToTag = new Map<number, number>();
  spans.forEach((span, i) => {
    runIndex[i] = span.start;
    runOriginalID[i] = firstId + i;
    idToTag.set(firstId + i, span.tag);
  });
  runIndex[spans.length] = indexCount;
  return { runIndex, runOriginalID, idToTag };
}

// ── Core ─────────────────────────────────────────────────────────────────────

export interface ImprintedArrays {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly faceGroups: readonly FaceGroupData[] | undefined;
}

/**
 * Subtract every visible mesh imprint from an indexed mesh. Returns null when
 * nothing was subtracted (no applicable cutouts, module unavailable, or the
 * input mesh could not enter Manifold) — callers keep the original arrays.
 */
export function imprintArrays(
  positions: Float32Array,
  indices: Uint32Array,
  faceGroups: readonly FaceGroupData[] | undefined,
  params: BinParams,
  frame: ImprintFrame,
  clip?: Bounds2D
): ImprintedArrays | null {
  const cutouts = visibleMeshCutouts(params);
  if (cutouts.length === 0) return null;
  const module = activeModule ?? getLoadedManifoldModule();
  if (!module) return null;

  // Cavity color: the same tag contract as 2D cutouts. Ordinals come from the
  // FULL cutout list (matching the paint layer and cutoutBuilder).
  const colorOrdinal = new Map(enumerateCutoutColorUnits(params.cutouts).map((u, i) => [u.key, i]));

  const tools: Manifold[] = [];
  /** Provenance id → face tag for tool-carved cavity faces. */
  const toolIdToTag = new Map<number, number>();
  const disposals: Manifold[] = [];
  try {
    for (const cutout of cutouts) {
      const asset = params.meshAssets?.[cutout.meshId ?? ''];
      if (!asset) continue;
      const prepared = preparedTools.get(asset.data);
      const cutoutParts: Manifold[] = [];
      for (const instance of expandCutoutArray(cutout)) {
        if (clip && !boundsOverlap(instanceBounds(instance, frame), clip)) continue;
        const placed = buildInstanceTool(module, prepared, asset, instance, frame);
        if (placed) cutoutParts.push(placed);
      }
      if (cutoutParts.length === 0) continue;
      disposals.push(...cutoutParts);
      // One fresh provenance id per colorable unit: faces the boolean keeps
      // from this cutout's tools resolve to its cavity color tag.
      const unionAll =
        cutoutParts.length === 1 ? cutoutParts[0] : module.Manifold.union(cutoutParts);
      if (cutoutParts.length > 1) disposals.push(unionAll);
      const stamped = unionAll.asOriginal();
      disposals.push(stamped);
      toolIdToTag.set(
        stamped.originalID(),
        cutoutColorTag(colorOrdinal.get(cutoutUnitKey(cutout)) ?? 0)
      );
      tools.push(stamped);
    }
    if (tools.length === 0) return null;

    const runs = encodeRuns(module, indices.length, faceGroups);
    let binManifold: Manifold;
    try {
      const binMesh = new module.Mesh({
        numProp: 3,
        vertProperties: positions,
        triVerts: indices,
        ...(runs ? { runIndex: runs.runIndex, runOriginalID: runs.runOriginalID } : {}),
      });
      binMesh.merge();
      binManifold = new module.Manifold(binMesh);
    } catch {
      // The tessellated bin isn't watertight at Manifold's tolerance — skip
      // the imprint rather than produce a broken mesh or a blank preview.
      console.warn('meshImprint: bin mesh is not manifold, skipping imprint subtraction');
      return null;
    }
    disposals.push(binManifold);

    const toolUnion = tools.length === 1 ? tools[0] : module.Manifold.union(tools);
    if (tools.length > 1) disposals.push(toolUnion);
    const result = binManifold.subtract(toolUnion);
    disposals.push(result);

    // Never emit a floating island: if a pathological tool stranded a
    // disconnected piece the shoulder fill missed, keep only the largest
    // component. decompose carries provenance runs through, so tags survive.
    let solid = result;
    const components = result.decompose();
    if (components.length > 1) {
      components.forEach((c) => disposals.push(c));
      solid = components.reduce((largest, c) => (c.volume() > largest.volume() ? c : largest));
    } else {
      components.forEach((c) => c.delete());
    }

    const outMesh = solid.getMesh();
    const outPositions =
      outMesh.numProp === 3
        ? outMesh.vertProperties
        : stridePositions(outMesh.vertProperties, outMesh.numProp);
    const outIndices = outMesh.triVerts;

    let outFaceGroups: FaceGroupData[] | undefined;
    if (runs && outMesh.runIndex.length > 1) {
      outFaceGroups = [];
      for (let r = 0; r < outMesh.runOriginalID.length; r++) {
        const start = outMesh.runIndex[r];
        const count = outMesh.runIndex[r + 1] - start;
        if (count === 0) continue;
        const id = outMesh.runOriginalID[r];
        const tag = runs.idToTag.get(id) ?? toolIdToTag.get(id) ?? TAG_UNKNOWN;
        const previous = outFaceGroups.at(-1);
        if (previous && previous.tag === tag && previous.start + previous.count === start) {
          outFaceGroups[outFaceGroups.length - 1] = {
            ...previous,
            count: previous.count + count,
          };
        } else {
          outFaceGroups.push({ start, count, tag });
        }
      }
    }

    const shaded = computeCreaseNormals(outPositions, outIndices);
    return {
      positions: shaded.positions,
      normals: shaded.normals,
      indices: shaded.indices,
      faceGroups: outFaceGroups,
    };
  } finally {
    for (const m of disposals) m.delete();
  }
}

function stridePositions(vertProperties: Float32Array, numProp: number): Float32Array {
  const vertexCount = vertProperties.length / numProp;
  const positions = new Float32Array(vertexCount * 3);
  for (let v = 0; v < vertexCount; v++) {
    positions[v * 3] = vertProperties[v * numProp];
    positions[v * 3 + 1] = vertProperties[v * numProp + 1];
    positions[v * 3 + 2] = vertProperties[v * numProp + 2];
  }
  return positions;
}

/**
 * Apply mesh imprints to a whole-bin `MeshData` (pipeline stage entry).
 * Returns the input unchanged when there's nothing to do or the subtraction
 * had to be skipped.
 */
export function applyMeshImprints(
  mesh: MeshData,
  params: BinParams,
  dims: Pick<
    BinDimensions,
    'innerW' | 'innerD' | 'wallHeight' | 'innerOffsetX' | 'innerOffsetY' | 'baseOffsetZ' | 'solid'
  >
): MeshData {
  if (!dims.solid || !hasMeshImprints(params)) return mesh;
  const frame = frameFromDimensions(params, dims);
  const result = imprintArrays(mesh.vertices, mesh.indices, mesh.faceGroups, params, frame);
  if (!result) return mesh;

  const { coarseLOD: _coarseLOD, ...rest } = mesh;
  return {
    ...rest,
    vertices: result.positions,
    normals: result.normals,
    indices: result.indices,
    triangleCount: result.indices.length / 3,
    faceGroups: result.faceGroups,
    // Regenerate feature edges from the imprinted mesh — the pocket rim gets
    // outlines and edges of removed faces disappear. Coarse LOD is dropped
    // (it has no pocket and only exists for distant preview).
    edgeVertices: creaseEdges({ vertices: result.positions, triangles: result.indices }),
  };
}

/**
 * Apply mesh imprints to one split piece's arrays (bin frame, before any
 * per-piece recentering). `pieceBounds` prefilters tools to those touching
 * the piece; a pocket straddling a seam subtracts from both pieces.
 */
export function imprintPieceArrays(
  positions: Float32Array,
  indices: Uint32Array,
  params: BinParams,
  dims: Pick<
    BinDimensions,
    'innerW' | 'innerD' | 'wallHeight' | 'innerOffsetX' | 'innerOffsetY' | 'baseOffsetZ' | 'solid'
  >,
  pieceBounds: Bounds2D,
  frameShift?: { readonly x: number; readonly y: number }
): NormalizedMesh | null {
  if (!dims.solid || !hasMeshImprints(params)) return null;
  const base = frameFromDimensions(params, dims);
  // When the piece mesh was recentered (preview), tools move into the same
  // local frame: local = world − pieceCenter.
  const frame: ImprintFrame = frameShift
    ? { ...base, originX: base.originX - frameShift.x, originY: base.originY - frameShift.y }
    : base;
  const result = imprintArrays(positions, indices, undefined, params, frame, pieceBounds);
  if (!result) return null;
  return { positions: result.positions, normals: result.normals, indices: result.indices };
}
