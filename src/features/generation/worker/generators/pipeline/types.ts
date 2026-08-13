/**
 * Pipeline types for composable bin generation.
 *
 * The pipeline threads an immutable PipelineContext through a sequence of
 * PipelineStage functions. Each stage reads from the context, performs work,
 * and returns a new context with updated fields.
 *
 * originToTag is intentionally mutable — stages write face provenance data
 * to it by reference, and it flows through unchanged.
 */

import type { Shape3D } from 'brepjs';
import type { SocketCellPlan } from '../socketBuilder';
import type { BinParams } from '@/shared/types/bin';
import type { MeshData } from '../../../bridge/types';
import type { ProgressFn } from '../meshUtils';
import type { PerfCollector } from './perfCollector';
import type { ResolvedOverhang } from '../overhang';

/** Pre-computed dimensions derived from BinParams. Avoids re-deriving in each stage. */
export interface BinDimensions {
  readonly outerW: number;
  readonly outerD: number;
  readonly innerW: number;
  readonly innerD: number;
  /**
   * Resolved grid cell pitch in mm per axis. `gridUnitMmX` scales width/columns,
   * `gridUnitMmY` scales depth/rows. Equal for a standard square grid; they
   * differ only for a non-square (anisotropic) bin. Builders that iterate grid
   * cells (sockets, feet, magnet holes) read these so feet/positions stretch
   * with the pitch while round features stay isotropic.
   */
  readonly gridUnitMmX: number;
  readonly gridUnitMmY: number;
  readonly wallHeight: number;
  readonly totalHeight: number;
  /**
   * Extra exterior wall height (mm) added ABOVE {@link wallHeight} — the
   * "collar" from {@link BinParams.extraWallHeightMm}, clamped to >= 0. The
   * outer box extrusion and stacking lip rise by this amount (`wallHeight +
   * collarHeight`), while `wallHeight`/`interiorHeight` stay nominal so every
   * interior feature (cutouts, dividers, scoops, label tabs) keeps its original
   * plane. `0` when the bin has no collar. See `shellStage`.
   */
  readonly collarHeight: number;
  /**
   * World Z of the body's top face, where the stacking lip fuses on.
   *
   * `totalHeight` is NOT this number, and neither is `baseOffsetZ +
   * totalHeight`: `totalHeight` is `height * heightUnitMm`, which already spans
   * the socket, excludes the collar, and does not track `wallHeight` across
   * base styles. Adding `baseOffsetZ` to it double-counts a Gridfinity socket
   * (5mm) while still missing the collar, and is right only for a tray bottom
   * — whose skirt is the one underside `wallHeight` does not already subtract.
   * Anything anchored to the rim reads this instead (#3431).
   */
  readonly wallTopZ: number;
  /**
   * World Z of the stacking lip's top face — the plane a lid's `anchorZ` maps
   * to when it is seated. Equals {@link wallTopZ} on a bin with no lip.
   */
  readonly lipTopZ: number;
  readonly isFlat: boolean;
  /**
   * Underside is lid mating geometry rather than a Gridfinity socket (#3036).
   * Socket-dependent derivations treat it like `isFlat`; the difference is the
   * skirt `trayBottomStage` fuses below the body.
   */
  readonly isTrayBottom: boolean;
  /** No Gridfinity socket under the body: a flat base or a tray bottom. */
  readonly socketless: boolean;
  /**
   * How far the body is lifted so Z=0 stays the absolute bottom — the depth of
   * whatever sits under it. `SOCKET_HEIGHT` for a Gridfinity base, the skirt
   * depth for a tray bottom, 0 for a flat one. Everything that needs the body's
   * true Z (floor patterns, mesh imprint, the translate stage) reads this
   * rather than re-deriving it, so a third kind of underside cannot desync them.
   */
  readonly baseOffsetZ: number;
  readonly halfSockets: boolean;
  /**
   * The foot layout the base builds, after the user's half-socket toggle and
   * per-axis lattice have been reconciled with the cell mask (#3467).
   */
  readonly socketCellPlan: SocketCellPlan;
  /**
   * True when the base is shelled to a uniform `wallThickness` (Gridfinity
   * Lite): the cavity floor follows the socket taper and the grid shape is
   * exposed on the interior. Forced false for flat bins (no socket to shell).
   * Magnet/screw pads are retained as solid islands when `withMagnet`/
   * `withScrew` are set. See `lightweightBaseBuilder`.
   *
   * Implied by {@link isSpacer}: a floorless riser's shelled feet ARE its
   * structure, so it always takes this build path.
   */
  readonly lightweight: boolean;
  /**
   * True for a spacer/riser (#2869): a floorless frame that lifts a bin so
   * mismatched bin heights line up. Feet and stacking lip are untouched — only
   * the floor is gone — so every height and stacking rule a normal bin follows
   * carries over unchanged. The feet become foot-shaped tubes (`'through'` in
   * `lightweightBaseBuilder`) tied together by the inter-cell webbing.
   * Forced false for flat bins (nothing to shell through).
   */
  readonly isSpacer: boolean;
  /**
   * True for a base-only bin: the complement of {@link isSpacer}. The feet and
   * the floor stay, {@link wallHeight} is pinned to 0, and the stacking lip
   * fuses onto the floor slab, giving a plate that still stacks.
   *
   * {@link totalHeight} is NOT its height — it stays `height *
   * heightUnitMm` (7mm), because `params.height` is inert data pinned to 1 to
   * satisfy the range validators. The body top is
   * `baseOffsetZ + wallHeight + tileFloorHeight`.
   * Forced false for socketless bins (no feet to stand on).
   */
  readonly isTile: boolean;
  /**
   * Thickness of the slab that IS a base-only bin's body, in mm; `0` for every
   * other base. It has no box, so nothing else would bridge the gap between
   * its feet: `buildBaseSocket` sizes each foot `CLEARANCE` narrower than its
   * cell and rounds its corners, so the feet meet nowhere — the tops are
   * separate islands with a slot along every internal grid line. This is the
   * same slab `shell()` leaves under an ordinary bin's cavity, which is why it
   * takes {@link BinParams.wallThickness}.
   */
  readonly tileFloorHeight: number;
  readonly solid: boolean;
  readonly isSlotted: boolean;
  readonly hasLip: boolean;
  readonly interiorHeight: number;
  readonly maxDimension: number;
  readonly shellKey: string;
  readonly withMagnet: boolean;
  readonly withScrew: boolean;
  /**
   * True when the shell is built with compartment cavities subtracted
   * directly (per-compartment cavity cut). In that path the divider
   * walls are residue from the cut, not separately-fused solids, so
   * `compartmentWallsFeature` is skipped to avoid double-walling.
   * See `compartmentBuilder.buildCompartmentCavityDrawings` and
   * `boxBuilder.buildBinBox` for the cut path.
   */
  readonly compartmentsBakedIntoShell: boolean;
  /**
   * Resolved per-side outward body expansion (mm), clamped to >= 0. All-zero
   * when the bin has no overhang. The box body + stacking lip + floor grow by
   * these amounts; the base sockets stay at the nominal footprint.
   */
  readonly overhang: ResolvedOverhang;
  /**
   * X shift of the inner cavity centre relative to the bin origin, in mm.
   * Equal to `(overhang.right - overhang.left) / 2`. Zero for symmetric or
   * absent overhang. All interior feature builders translate their geometry
   * by `(innerOffsetX, innerOffsetY)` so features stay centred in the cavity.
   */
  readonly innerOffsetX: number;
  /** Y shift of the inner cavity centre — `(overhang.back - overhang.front) / 2`. */
  readonly innerOffsetY: number;
}

/** Immutable context threaded through pipeline stages. */
export interface PipelineContext {
  readonly params: BinParams;
  readonly dimensions: BinDimensions;
  readonly forExport: boolean;
  readonly signal?: AbortSignal;
  readonly onProgress?: ProgressFn;
  /** Current bin solid — updated by each stage */
  readonly solid: Shape3D | null;
  /**
   * Deferred additive solid (the base socket) kept OUT of `solid` on the
   * preview path so features cut only the body and the expensive socket↔body
   * fuse is skipped. Tessellated alongside `solid` and merged into one mesh
   * (the socket is never cut by features and only meets the body at a hidden
   * internal interface, so the rendered result is identical to the fused
   * shell). Null on the export path, where the socket is fused into `solid`
   * for a watertight model.
   */
  readonly deferredSolid: Shape3D | null;
  /**
   * Geometry-identity key for {@link deferredSolid}, used by the tessellate
   * stage to cache the socket's mesh across edits that don't change the base.
   * Always present: `null` when there is no deferred solid yet or it isn't a
   * cacheable standard socket (e.g. the lightweight-base path), which forces a
   * fresh tessellation.
   */
  readonly deferredSolidKey: string | null;
  /** Face provenance tracking — intentionally mutable (passed by reference) */
  readonly originToTag: Map<number, number>;
  /** Additive feature shapes to fuse into the bin */
  readonly fuseTargets: readonly Shape3D[];
  /** Subtractive feature shapes to cut from the bin */
  readonly cutTargets: readonly Shape3D[];
  /** Pattern cut targets — applied in a separate boolean pass after cutTargets */
  readonly patternCutTargets: readonly Shape3D[];
  /**
   * Cut targets that must ALSO be applied to {@link deferredSolid} (#2816).
   *
   * Every other feature cuts the body only, which is safe because the socket
   * meets it at a hidden interface. The floor pattern is the exception: its
   * holes have to leave the bin, so the same tools carve the base socket too.
   * Applying them to both keeps the preview (which meshes the two separately)
   * and the export (which fuses them) showing the same model. The shapes here
   * are the SAME references that appear in {@link patternCutTargets} — the
   * boolean stage owns them and disposes them once.
   */
  readonly deferredCutTargets: readonly Shape3D[];
  /**
   * Composite geometry-identity key for the feature targets this run, set by
   * the features stage. Combined with `dimensions.shellKey` + `forExport` it
   * keys the post-boolean body cache, so a metadata-only edit (no geometry
   * change) skips the boolean stage. `null` disables that resume cache for
   * paths whose targets aren't fully captured by feature builder keys (solid
   * mode, wall patterns) — correctness over coverage.
   */
  readonly featuresKey: string | null;
  /** Final mesh output (set by tessellate stage) */
  readonly mesh: MeshData | null;
  /** Coarse LOD mesh for distance-based rendering (preview only) */
  readonly coarseMesh: MeshData | null;
  /**
   * Optional perf collector. Pipeline runner records per-stage timings
   * into it; wall-pattern builder records per-wall substep timings.
   * Tests and benchmarks omit it (zero overhead).
   */
  readonly perfCollector?: PerfCollector;
}

/** A single composable pipeline stage. */
export interface PipelineStage {
  readonly name: string;
  readonly progressValue: number;
  shouldRun(ctx: PipelineContext): boolean;
  execute(ctx: PipelineContext): PipelineContext;
}
