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
   * Anything anchored to the rim reads this instead.
   */
  readonly wallTopZ: number;
  /**
   * World Z of the stacking lip's top face — the plane a lid's `anchorZ` maps
   * to when it is seated. Equals {@link wallTopZ} on a bin with no lip.
   */
  readonly lipTopZ: number;
  readonly isFlat: boolean;
  /**
   * Underside is lid mating geometry rather than a Gridfinity socket.
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
   * per-axis lattice have been reconciled with the cell mask.
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
   * True when {@link lightweight} shells the base from UNDERNEATH: the feet
   * become rings opening downward and the bin's own floor caps them, so the
   * interior stays flat. Never true for a spacer, whose floor is gone by
   * definition.
   *
   * This is the only flag that picks the open direction. Anything asking
   * "has the interior floor been opened?" wants {@link liteFloorOpen}.
   */
  readonly undersideRelief: boolean;
  /**
   * The feet print as separate parts, so the body is flat-bottomed with blind
   * pin holes in the underside of its floor. Distinct from {@link socketless}:
   * attachment hardware is NOT suppressed here, it moves into the feet.
   */
  readonly detachableFeet: boolean;
  /**
   * Interior floor thickness, in mm. Equals {@link BinParams.wallThickness}
   * except under {@link detachableFeet}. Read this wherever the FLOOR is meant;
   * `wallThickness` still answers everything about the walls.
   */
  readonly floorThickness: number;
  /**
   * True when there is no solid interior floor left — the question every
   * feature that stands ON the floor is actually asking, and the reason it is
   * separate from {@link lightweight}.
   *
   * They come apart three ways: the underside relief shells the base and keeps
   * the floor; a solid bin's body has no distinct floor to open in the first
   * place (its cups already open downward); and a spacer opens the floor
   * whether or not the user asked for lite. A scoop ramp, a drainage hole and a
   * click rail's lip pocket all care about this one, not about whether the base
   * happens to be shelled.
   */
  readonly liteFloorOpen: boolean;
  /**
   * Depth of the floor channel under each removable divider, 0 when the bin is
   * not slotted, the groove is off, or there is no closed floor to cut it into.
   * The wall slots start this far below the floor top so the divider's head
   * seats at groove depth with the throat closing over it at the surface.
   */
  readonly dividerGrooveDepth: number;
  /**
   * True for a spacer/riser: a floorless frame that lifts a bin so
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
  /**
   * The shell leaves the lip solid OUT, while every other dimension still
   * describes a bin that has one.
   *
   * Set only by `splitSolidIntoPieces`, which builds the lip separately and
   * fuses it per piece to dodge an OCCT crash at the lip-wall junction. It used
   * to say so by clearing `base.stackingLip`, which also told every feature
   * builder the bin was lipless: the interior ceiling rose by `LIP_SMALL_TAPER`,
   * a scoop lost the inward offset that keeps its exit flush with the lip's
   * inner face, and a cutout's shoulder round-over seated on the wall top. Each
   * one made a split piece a different shape from the same region of the
   * unsplit bin.
   *
   * `shellKey` carries it, because the shell is the one thing it changes.
   * Never true without {@link hasLip}: a bin with no lip has no lip solid to
   * omit, and `deriveDimensions` normalizes the caller's request against it so
   * one shape can never get two shell-cache keys.
   */
  readonly omitLipSolid: boolean;
  /**
   * Whether the stacking lip gets its angled 45° support — the wedge that blends
   * the lip's inward jut down into the wall it sits on.
   *
   * `buildTopShapeLoft` builds that support hanging `LIP_TAPER_WIDTH` BELOW the
   * lip's own base plane, and the lip fuses at `boxWallHeight - LIP_OVERLAP`, so
   * on a wall shorter than `LIP_TAPER_WIDTH + LIP_OVERLAP` the support reaches
   * past the wall bottom and lands inside the socket's upper taper, back-filling
   * it to full width. The foot then stops seating in a baseplate (CLAUDE.md
   * gotcha #10) — and the solid stays watertight and correctly sized, so no
   * bounding-box or manifold check sees it.
   *
   * Derived once here because three consumers have to agree: the fuse path passes
   * it to `buildTopShape`, the base-only path reads it instead of hardcoding
   * `false`, and the draft's integrated builder must stand down when it is false
   * (it mirrors the support and has no way to omit it).
   */
  readonly lipHasSupport: boolean;
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
   * Cut targets that must ALSO be applied to {@link deferredSolid}.
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
