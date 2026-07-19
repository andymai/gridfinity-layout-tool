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

import type { CrossSection, Manifold, ManifoldToplevel, Vec2 } from 'manifold-3d';
import type { BinParams, Cutout } from '@/shared/types/bin';
import type { MeshAsset } from '@/shared/generation/meshAsset';
import { decodeMeshData } from '@/shared/generation/meshAsset';
import { isOk } from '@/core/result';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import {
  cutoutColorTag,
  cutoutUnitKey,
  enumerateCutoutColorUnits,
} from '@/shared/generation/cutoutColorUnits';
import type { FaceGroupData, MeshData } from '../../bridge/types';
import type { BinDimensions } from './pipeline/types';
import { SOCKET_HEIGHT } from './generatorConstants';
import { creaseEdges } from './utils/creaseEdges';
import { computeCreaseNormals } from './meshImprintNormals';
import type { NormalizedMesh } from './meshImprintNormals';
import { getLoadedManifoldModule, getManifoldModule } from '../manifoldRuntime';

/** FeatureTag.UNKNOWN — faces with no recorded provenance. */
const TAG_UNKNOWN = 255;
/** Entry-chamfer bevel is approximated as a stack of offset rings this thick
 *  (≈ one print layer, so the printed result is identical to a true 45° cone). */
const CHAMFER_SLICE_MM = 0.2;
const MAX_CHAMFER_SLICES = 5;
/** Tools extend this far above the solid surface so the cut never leaves a
 *  coplanar skin film at the opening. */
const TOP_OVERSHOOT_MM = 0.5;
/** The contoured pocket preserves relief BELOW the tool's lowest top-shoulder
 *  and flattens the silhouette above it (a top-face recess can't survive in a
 *  straight-up-removable pocket without stranding a floating boss). The shoulder
 *  is sampled on a grid this many cells across each axis; the margin drops the
 *  fill line below it so sampling slop never raises it into a roof. */
const SHOULDER_GRID = 72;
const SHOULDER_MARGIN_MM = 1;
/** Prepared tool manifolds kept per worker (content-keyed). */
const MAX_PREPARED_TOOLS = 16;

interface PreparedTool {
  /** null = asset failed to decode/build — imprint falls back to a flat
   *  outline-prism pocket for that cutout. */
  readonly manifold: Manifold | null;
  /** Lowest top-shoulder (mm) of the decoded mesh; the silhouette is filled
   *  flat above it. 0 when unavailable (flattens the whole pocket). */
  readonly topShoulder: number;
}

const preparedTools = new Map<string, PreparedTool>();
let activeModule: ManifoldToplevel | null = null;

function visibleMeshCutouts(params: BinParams): Cutout[] {
  return params.cutouts.filter(
    (c) =>
      c.shape === 'mesh' &&
      c.hidden !== true &&
      c.meshId !== undefined &&
      params.meshAssets?.[c.meshId] !== undefined
  );
}

/** True when the design has at least one visible, resolvable mesh imprint. */
export function hasMeshImprints(params: BinParams): boolean {
  return visibleMeshCutouts(params).length > 0;
}

/** Drop all prepared tool manifolds (worker CLEANUP path). */
export function clearMeshImprintCache(): void {
  for (const tool of preparedTools.values()) tool.manifold?.delete();
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
        preparedTools.get(oldest)?.manifold?.delete();
        preparedTools.delete(oldest);
      }
    }
    preparedTools.set(asset.data, { manifold, topShoulder });
  }
}

// ── Placement ────────────────────────────────────────────────────────────────

interface ImprintFrame {
  /** World X/Y of the interior bottom-left corner (cutout coordinate origin). */
  readonly originX: number;
  readonly originY: number;
  /** World Z of the solid fill surface the pocket sinks from. */
  readonly solidTopZ: number;
}

interface Bounds2D {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

function frameFromDimensions(
  params: BinParams,
  dims: Pick<
    BinDimensions,
    'innerW' | 'innerD' | 'wallHeight' | 'innerOffsetX' | 'innerOffsetY' | 'isFlat'
  >
): ImprintFrame {
  return {
    originX: -dims.innerW / 2 + dims.innerOffsetX,
    originY: -dims.innerD / 2 + dims.innerOffsetY,
    solidTopZ: (dims.isFlat ? 0 : SOCKET_HEIGHT) + dims.wallHeight - params.cutoutConfig.topOffset,
  };
}

/** Conservative world-space footprint of one placed instance (any rotation). */
function instanceBounds(cutout: Cutout, frame: ImprintFrame): Bounds2D {
  const cx = frame.originX + cutout.x + cutout.width / 2;
  const cy = frame.originY + cutout.y + cutout.depth / 2;
  const halfDiag = Math.hypot(cutout.width, cutout.depth) / 2 + (cutout.clearance ?? 0) + 5;
  return { minX: cx - halfDiag, minY: cy - halfDiag, maxX: cx + halfDiag, maxY: cy + halfDiag };
}

function boundsOverlap(a: Bounds2D, b: Bounds2D): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function outlinesToPolygons(asset: MeshAsset): Vec2[][] {
  return asset.outlines.map((ring) => ring.map((p): Vec2 => [p.x, p.y]));
}

/**
 * The tool's lowest top-shoulder (mm): the minimum over the footprint of the
 * top-surface height, sampled on a {@link SHOULDER_GRID} raster. Filling the
 * silhouette from this height up removes every roof — nothing above a shoulder
 * can strand a floating boss — while the contoured relief BELOW it (the part a
 * straight-up lift actually clears) is preserved. Returns 0 when no cell is
 * sampled (degenerate mesh), which fills the whole pocket flat (safe).
 *
 * The mesh is origin-normalized by the importer, so z spans [0, sizeZ].
 */
function minTopShoulder(positions: Float32Array, indices: Uint32Array): number {
  const N = SHOULDER_GRID;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    minX = Math.min(minX, positions[i]);
    maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    maxY = Math.max(maxY, positions[i + 1]);
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const cellTop = new Float32Array(N * N).fill(-Infinity);
  // `| 0` truncates toward zero; (v - m) is always ≥ 0 here, so it equals floor.
  const cellIndex = (v: number, s: number, m: number): number =>
    Math.max(0, (((v - m) / s) * N) | 0);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t] * 3;
    const b = indices[t + 1] * 3;
    const c = indices[t + 2] * 3;
    // Sample every grid centre inside the triangle's XY bounds, keeping the
    // highest interpolated surface height per cell (the top there).
    const cx0 = cellIndex(Math.min(positions[a], positions[b], positions[c]), spanX, minX);
    const cx1 = Math.min(
      N - 1,
      cellIndex(Math.max(positions[a], positions[b], positions[c]), spanX, minX)
    );
    const cy0 = cellIndex(
      Math.min(positions[a + 1], positions[b + 1], positions[c + 1]),
      spanY,
      minY
    );
    const cy1 = Math.min(
      N - 1,
      cellIndex(Math.max(positions[a + 1], positions[b + 1], positions[c + 1]), spanY, minY)
    );
    for (let cy = cy0; cy <= cy1; cy++) {
      const py = minY + ((cy + 0.5) / N) * spanY;
      for (let cx = cx0; cx <= cx1; cx++) {
        const px = minX + ((cx + 0.5) / N) * spanX;
        const z = triangleTopZ(px, py, positions, a, b, c);
        if (!Number.isNaN(z)) {
          const idx = cy * N + cx;
          if (z > cellTop[idx]) cellTop[idx] = z;
        }
      }
    }
  }
  let shoulder = Infinity;
  for (let i = 0; i < cellTop.length; i++) {
    if (cellTop[i] > -Infinity && cellTop[i] < shoulder) shoulder = cellTop[i];
  }
  return Number.isFinite(shoulder) ? shoulder : 0;
}

/** Barycentric-interpolated surface z at (px,py) inside triangle (a,b,c), or
 *  NaN when the point falls outside it. */
function triangleTopZ(
  px: number,
  py: number,
  p: Float32Array,
  a: number,
  b: number,
  c: number
): number {
  const d = (p[b + 1] - p[c + 1]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 1] - p[c + 1]);
  if (d === 0) return NaN;
  const l1 = ((p[b + 1] - p[c + 1]) * (px - p[c]) + (p[c] - p[b]) * (py - p[c + 1])) / d;
  const l2 = ((p[c + 1] - p[a + 1]) * (px - p[c]) + (p[a] - p[c]) * (py - p[c + 1])) / d;
  const l3 = 1 - l1 - l2;
  if (l1 < -0.001 || l2 < -0.001 || l3 < -0.001) return NaN;
  return l1 * p[a + 2] + l2 * p[b + 2] + l3 * p[c + 2];
}

/**
 * Build the full subtract tool for one placed cutout instance in world space:
 * the contoured tool with the silhouette filled flat above its lowest
 * top-shoulder, a lateral-clearance skirt around the silhouette, and the
 * entry-chamfer ring stack. Falls back to a flat outline-prism pocket when the
 * asset's manifold failed to build.
 *
 * Filling above the shoulder keeps the underside/lower relief the user can
 * actually nest onto while flattening only the trapped upper recesses — cheap
 * (one union, like a plain prism) and free of the floating islands a raw
 * contour subtract would leave. To imprint a distinctive face, orient it down.
 */
function buildInstanceTool(
  module: ManifoldToplevel,
  tool: Manifold | null,
  topShoulder: number,
  asset: MeshAsset,
  cutout: Cutout,
  frame: ImprintFrame
): Manifold | null {
  const clearance = Math.max(0, cutout.clearance ?? 0);
  const chamfer = Math.max(0, cutout.chamferWidth ?? 0);
  const cutDepth = Math.min(Math.max(0, cutout.cutDepth), frame.solidTopZ);
  if (cutDepth <= 0) return null;

  const cx = asset.sizeMm.x / 2;
  const cy = asset.sizeMm.y / 2;
  const worldX = frame.originX + cutout.x + cutout.width / 2;
  const worldY = frame.originY + cutout.y + cutout.depth / 2;
  const zBottom = frame.solidTopZ - cutDepth;

  const scratch: Manifold[] = [];
  const crossSections: CrossSection[] = [];
  const track = (m: Manifold): Manifold => {
    scratch.push(m);
    return m;
  };

  try {
    const placeLocal = (local: Manifold): Manifold => {
      // Asset-local frame: footprint spans [0..sizeX]×[0..sizeY], z=0 at the
      // pocket bottom. Rotate about the footprint center (matching 2D cutout
      // rotation semantics), then move to the instance's world position.
      const centered = track(local.translate([-cx, -cy, 0]));
      const rotated = track(centered.rotate([0, 0, cutout.rotation]));
      return track(rotated.translate([worldX, worldY, zBottom]));
    };

    const parts: Manifold[] = [];

    const baseSection = new module.CrossSection(outlinesToPolygons(asset), 'Positive');
    crossSections.push(baseSection);

    if (tool) {
      const sizeZ = asset.sizeMm.z;
      // Fill the silhouette from just below the lowest top-shoulder up past the
      // opening: recesses above it become flat opening (no roofs, no stranded
      // bosses) while the relief below survives. Extrude starts at z=0, so lift
      // the cap to the fill line. The +overshoot pokes above the surface.
      const fillFrom = Math.max(0, Math.min(topShoulder - SHOULDER_MARGIN_MM, sizeZ));
      const cap = track(module.Manifold.extrude(baseSection, sizeZ + TOP_OVERSHOOT_MM - fillFrom));
      const filled = track(cap.translate([0, 0, fillFrom]));
      let grown = track(module.Manifold.union([tool, filled]));
      if (clearance > 0) {
        // Lateral fit slack: widen only the outer wall with a hollow silhouette
        // ring extruded full-depth (a 3D offset of the mesh is far costlier).
        const offsetSection = baseSection.offset(clearance, 'Round');
        crossSections.push(offsetSection);
        const ring = offsetSection.subtract(baseSection);
        crossSections.push(ring);
        const skirt = track(module.Manifold.extrude(ring, cutDepth + TOP_OVERSHOOT_MM));
        grown = track(module.Manifold.union([grown, skirt]));
      }
      parts.push(placeLocal(grown));
    } else {
      // Fallback: the asset's manifold failed to build — flat outline-prism
      // pocket (no relief available to preserve).
      let section = baseSection;
      if (clearance > 0) {
        section = baseSection.offset(clearance, 'Round');
        crossSections.push(section);
      }
      const prism = track(module.Manifold.extrude(section, cutDepth + TOP_OVERSHOOT_MM));
      parts.push(placeLocal(prism));
    }

    if (chamfer > 0) {
      // Stepped bevel: N thin rings widening toward the opening. At print
      // time a 45° bevel IS a layer staircase, so ~0.2mm steps reproduce the
      // printed part exactly.
      const sliceCount = Math.min(
        MAX_CHAMFER_SLICES,
        Math.max(1, Math.ceil(chamfer / CHAMFER_SLICE_MM))
      );
      const sliceT = chamfer / sliceCount;
      for (let j = 0; j < sliceCount; j++) {
        const offset = clearance + (chamfer * (sliceCount - j)) / sliceCount;
        const section = baseSection.offset(offset, 'Round');
        crossSections.push(section);
        const topExtra = j === 0 ? TOP_OVERSHOOT_MM : 0;
        const ring = track(module.Manifold.extrude(section, sliceT + topExtra));
        const localZ = cutDepth - (j + 1) * sliceT;
        parts.push(placeLocal(track(ring.translate([0, 0, localZ]))));
      }
    }

    if (parts.length === 0) return null;
    const union = parts.length === 1 ? parts[0] : track(module.Manifold.union(parts));
    // Detach the result from scratch disposal.
    const result = union.translate([0, 0, 0]);
    return result;
  } finally {
    for (const section of crossSections) section.delete();
    for (const m of scratch) m.delete();
  }
}

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
        const placed = buildInstanceTool(
          module,
          prepared?.manifold ?? null,
          prepared?.topShoulder ?? 0,
          asset,
          instance,
          frame
        );
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
    'innerW' | 'innerD' | 'wallHeight' | 'innerOffsetX' | 'innerOffsetY' | 'isFlat' | 'solid'
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
    'innerW' | 'innerD' | 'wallHeight' | 'innerOffsetX' | 'innerOffsetY' | 'isFlat' | 'solid'
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
