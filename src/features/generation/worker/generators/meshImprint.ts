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

import type { CrossSection, Manifold, ManifoldToplevel, Vec2, Vec3 } from 'manifold-3d';
import type { BinParams, Cutout } from '@/shared/types/bin';
import type { MeshAsset } from '@/shared/generation/meshAsset';
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

/** FeatureTag.UNKNOWN — faces with no recorded provenance. */
const TAG_UNKNOWN = 255;
/** Facets on the cone each opening edge is swept with for the entry chamfer;
 *  the bevel's convex corners round with this many segments per turn. */
const CHAMFER_CONE_SEGMENTS = 16;
/** The opening is read this far under the surface, so a tool face lying in
 *  the surface plane cannot make the section ambiguous. */
const OPENING_PROBE_MM = 0.01;
/** The opening is simplified to this tolerance before the sweep (one hull per
 *  edge), doubling until the edge budget is met: a scanned rim carries
 *  thousands of edges that print identically. */
const OPENING_SIMPLIFY_MM = 0.05;
const MAX_CHAMFER_EDGES = 600;
/** Clearance grows the tool along these 26 unit directions (cube faces, edges
 *  and corners). The union of the translated copies approximates the Minkowski
 *  sum with a ball at a fraction of its cost: exact along the axes, within
 *  cos 20° between them. */
const DILATION_DIRECTIONS: readonly Vec3[] = [-1, 0, 1].flatMap((x) =>
  [-1, 0, 1].flatMap((y) =>
    [-1, 0, 1]
      .filter((z) => x !== 0 || y !== 0 || z !== 0)
      .map((z): Vec3 => {
        const len = Math.hypot(x, y, z);
        return [x / len, y / len, z / len];
      })
  )
);
/** The copies come from a decimated tool (never coarser than a quarter of the
 *  clearance) unioned with the exact one, so a fine mesh pays for one copy. */
const DILATION_SIMPLIFY_MM = 0.05;
/** Dilated tools kept per prepared asset, keyed by clearance. */
const MAX_DILATIONS_PER_TOOL = 4;
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
  /** Clearance-grown copies of `manifold`, keyed by quantized clearance. */
  readonly dilations: Map<string, Manifold>;
}

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
    'innerW' | 'innerD' | 'wallHeight' | 'innerOffsetX' | 'innerOffsetY' | 'baseOffsetZ'
  >
): ImprintFrame {
  return {
    originX: -dims.innerW / 2 + dims.innerOffsetX,
    originY: -dims.innerD / 2 + dims.innerOffsetY,
    solidTopZ: dims.baseOffsetZ + dims.wallHeight - params.cutoutConfig.topOffset,
  };
}

/** Conservative world-space footprint of one placed instance (any rotation). */
function instanceBounds(cutout: Cutout, frame: ImprintFrame): Bounds2D {
  const cx = frame.originX + cutout.x + cutout.width / 2;
  const cy = frame.originY + cutout.y + cutout.depth / 2;
  const halfDiag =
    Math.hypot(cutout.width, cutout.depth) / 2 +
    (cutout.clearance ?? 0) +
    (cutout.chamferWidth ?? 0) +
    5;
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
 * The tool grown by `clearance` on every side but its floor: the union of the
 * tool with 26 translated copies (a discrete ball), trimmed at z=0 so the
 * pocket floor stays where the cut depth put it and the tool still rests on
 * it. A silhouette skirt only ever reached vertical walls; a curved or sloped
 * flank got no slack and a detached slit around the outline instead. Cached
 * per prepared asset: the union costs ~0.4s for a 1.5k-triangle tool and every
 * instance of the cutout shares it.
 */
function dilatedTool(
  module: ManifoldToplevel,
  prepared: PreparedTool,
  tool: Manifold,
  clearance: number
): Manifold {
  const key = clearance.toFixed(3);
  const cached = prepared.dilations.get(key);
  if (cached) return cached;

  const coarse = tool.simplify(Math.min(DILATION_SIMPLIFY_MM, clearance / 4));
  const copies = DILATION_DIRECTIONS.map(([x, y, z]) =>
    coarse.translate([x * clearance, y * clearance, z * clearance])
  );
  const grown = module.Manifold.union([tool, ...copies]);
  const trimmed = grown.trimByPlane([0, 0, 1], 0);
  grown.delete();
  for (const copy of copies) copy.delete();
  coarse.delete();

  if (prepared.dilations.size >= MAX_DILATIONS_PER_TOOL) {
    const oldest = prepared.dilations.keys().next().value;
    if (oldest !== undefined) {
      prepared.dilations.get(oldest)?.delete();
      prepared.dilations.delete(oldest);
    }
  }
  prepared.dilations.set(key, trimmed);
  return trimmed;
}

/**
 * A 45° bevel from `opening` (the pocket section at z=0) out to its offset by
 * `bevel` at z=bevel, plus the overshoot above it: the interior extruded, each
 * opening edge swept with a cone (the hull of the edge and the cone's rim at
 * both ends, which is the edge's Minkowski sum with the cone), and the rim
 * prism on top. Concave corners come out sharp, where neighbouring sweeps
 * overlap. Returned detached from its inputs; the caller owns it.
 */
function buildChamferSweep(
  module: ManifoldToplevel,
  opening: CrossSection,
  bevel: number
): Manifold {
  const cone: Vec2[] = [];
  for (let k = 0; k < CHAMFER_CONE_SEGMENTS; k++) {
    const angle = (2 * Math.PI * k) / CHAMFER_CONE_SEGMENTS;
    cone.push([bevel * Math.cos(angle), bevel * Math.sin(angle)]);
  }
  const pieces: Manifold[] = [module.Manifold.extrude(opening, bevel + TOP_OVERSHOOT_MM)];
  for (const ring of opening.toPolygons()) {
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[(i + 1) % ring.length];
      const points: Vec3[] = [
        [ax, ay, 0],
        [bx, by, 0],
      ];
      for (const [dx, dy] of cone) {
        points.push([ax + dx, ay + dy, bevel], [bx + dx, by + dy, bevel]);
      }
      pieces.push(module.Manifold.hull(points));
    }
  }
  const rim = opening.offset(bevel, 'Round');
  const rimPrism = module.Manifold.extrude(rim, TOP_OVERSHOOT_MM);
  pieces.push(rimPrism.translate([0, 0, bevel]));
  rimPrism.delete();
  rim.delete();
  const sweep = module.Manifold.union(pieces);
  const detached = sweep.translate([0, 0, 0]);
  sweep.delete();
  for (const piece of pieces) piece.delete();
  return detached;
}

const edgeCount = (section: CrossSection): number =>
  section.toPolygons().reduce((count, ring) => count + ring.length, 0);

/**
 * Build the full subtract tool for one placed cutout instance in world space:
 * the tool (grown by the clearance) with the silhouette filled flat above its
 * lowest top-shoulder, and the entry chamfer swept around the opening the
 * pocket actually has at the surface. Falls back to a flat outline-prism
 * pocket when the asset's manifold failed to build.
 *
 * Filling above the shoulder keeps the underside/lower relief the user can
 * actually nest onto while flattening only the trapped upper recesses — cheap
 * (one union, like a plain prism) and free of the floating islands a raw
 * contour subtract would leave. To imprint a distinctive face, orient it down.
 */
function buildInstanceTool(
  module: ManifoldToplevel,
  prepared: PreparedTool | undefined,
  asset: MeshAsset,
  cutout: Cutout,
  frame: ImprintFrame
): Manifold | null {
  const clearance = Math.max(0, cutout.clearance ?? 0);
  const cutDepth = Math.min(Math.max(0, cutout.cutDepth), frame.solidTopZ);
  if (cutDepth <= 0) return null;
  const chamfer = Math.min(Math.max(0, cutout.chamferWidth ?? 0), cutDepth);

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
  const section = (s: CrossSection): CrossSection => {
    crossSections.push(s);
    return s;
  };

  try {
    const placeLocal = (local: Manifold): Manifold => {
      // Asset-local frame: footprint spans [0..sizeX]×[0..sizeY], z=0 at the
      // pocket bottom. Rotate about the footprint center, then move to the
      // instance's world position. `Cutout.rotation` is clockwise-positive and
      // Manifold's Z rotation is CCW, so the tool takes the negated angle —
      // the same convention as the BREP tools' `rotate(shape, -rotation)` and
      // `MeshFootprintMesh`'s `-rotation` render.
      const centered = track(local.translate([-cx, -cy, 0]));
      const rotated = track(centered.rotate([0, 0, -cutout.rotation]));
      return track(rotated.translate([worldX, worldY, zBottom]));
    };

    const silhouette = section(new module.CrossSection(outlinesToPolygons(asset), 'Positive'));
    const opening = clearance > 0 ? section(silhouette.offset(clearance, 'Round')) : silhouette;

    const tool = prepared?.manifold ?? null;
    let pocket: Manifold;
    if (tool && prepared) {
      const grownTool = clearance > 0 ? dilatedTool(module, prepared, tool, clearance) : tool;
      // Growing lifts the shoulders by the clearance too. Fill the silhouette
      // from just below the lowest top-shoulder up past the opening: recesses
      // above it become flat opening (no roofs, no stranded bosses) while the
      // relief below survives. The cap reaches the surface even when the
      // pocket is deeper than the tool is tall, so a buried tool never roofs.
      const sizeZ = asset.sizeMm.z + clearance;
      const fillFrom = Math.max(
        0,
        Math.min(prepared.topShoulder + clearance - SHOULDER_MARGIN_MM, sizeZ)
      );
      const capTop = Math.max(sizeZ, cutDepth) + TOP_OVERSHOOT_MM;
      const cap = track(module.Manifold.extrude(opening, capTop - fillFrom));
      const filled = track(cap.translate([0, 0, fillFrom]));
      pocket = track(module.Manifold.union([grownTool, filled]));
    } else {
      // Fallback: the asset's manifold failed to build — flat outline-prism
      // pocket (no relief available to preserve).
      pocket = track(module.Manifold.extrude(opening, cutDepth + TOP_OVERSHOOT_MM));
    }
    const parts: Manifold[] = [placeLocal(pocket)];

    if (chamfer > 0) {
      // The bevel follows the opening the pocket really has at the surface. A
      // tool cut shallower than its widest section opens narrower than its
      // silhouette, and rings of the silhouette floated in solid there.
      const rim = section(pocket.slice(cutDepth - OPENING_PROBE_MM));
      let epsilon = OPENING_SIMPLIFY_MM;
      let simplified = section(rim.simplify(epsilon));
      while (edgeCount(simplified) > MAX_CHAMFER_EDGES && epsilon < 1) {
        epsilon *= 2;
        simplified = section(rim.simplify(epsilon));
      }
      if (edgeCount(simplified) > 0) {
        const sweep = track(buildChamferSweep(module, simplified, chamfer));
        parts.push(placeLocal(track(sweep.translate([0, 0, cutDepth - chamfer]))));
      }
    }

    const union = parts.length === 1 ? parts[0] : track(module.Manifold.union(parts));
    // Detach the result from scratch disposal.
    return union.translate([0, 0, 0]);
  } finally {
    for (const cs of crossSections) cs.delete();
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
