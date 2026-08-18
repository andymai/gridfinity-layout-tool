/**
 * Mesh data shapes shared by the generators and the bridge — the bin body plus
 * its companion solids (lid, stack plate, connector key, swappable label plates).
 */

import type { CoarseLODData, FaceGroupData } from './responses';
/** Result of mesh generation (used by generators and bridge) */
export interface MeshData {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
  readonly triangleCount: number;
  readonly faceGroups?: readonly FaceGroupData[];
  /** Coarse LOD mesh for distance-based rendering (preview only, omitted for export) */
  readonly coarseLOD?: CoarseLODData;
  /** Optional click-lock lid mesh — separate solid that pairs with the bin. */
  readonly lidMesh?: LidMeshData;
  /** Optional separate stack-grid baseplate mesh — the glue-on companion slab,
   *  present only when the lid uses `separateStackPlate`. */
  readonly stackPlateMesh?: StackPlateMeshData;
  /** Optional sliding-tray mesh — the companion part that rides the bin's rail. */
  readonly slideTrayMesh?: SlideTrayMeshData;
  /**
   * Optional detachable feet, meshed where they sit UNDER the bin rather than
   * laid out for printing: the preview shows the assembly, because that is the
   * object being designed. The export path arranges the same solids on a plate.
   */
  readonly detachableFeetMesh?: MeshData;
  /**
   * Optional knife-block handle rest, meshed printable-side-down like the part
   * it exports as. Present only when the design's rest is a companion block;
   * an integrated rest is a shelf carved out of the bin itself.
   */
  readonly knifeRestMesh?: MeshData;
  /**
   * Optional seated snap-clip connector mesh — the exact relieved part the
   * baseplate ships, so the preview can render it instead of an approximation.
   * Present only for split snap-clip baseplates.
   */
  readonly connectorKeyMesh?: ConnectorKeyMeshData;
  /**
   * Optional swappable label plates with their seated poses, so the
   * preview shows the real engraved parts. Preview only — export packs its own
   * bed-sized sheet. Present only in socket mode with at least one plate.
   */
  readonly labelPlates?: LabelPlatesMeshData;
  /**
   * Captions the build dropped because they overflow their host even at
   * `minFontSize`. Reported rather than inferred: the drop leaves nothing in
   * the mesh, so the tab or plate simply prints blank and the UI would
   * otherwise have no way to say so. Omitted when nothing overflowed.
   *
   * Mutable element type for the same reason as `LabelPlatesMeshData.plates` —
   * the designer store's Immer drafts reject readonly arrays.
   */
  readonly labelTextOverflow?: LabelTextOverflow[];
  /** Set when the design's finest stem is below the printable floor. */
  readonly typeStemWarning?: TypeStemWarning;
}

/**
 * One caption that will not render.
 *
 * `index` is a compartment id by default, a row index under `label.span`, and
 * the synthetic compartment 0 when the socket plan degraded to a single
 * bin-spanning tab. `scope` says which, so the UI can name the right thing.
 */
/**
 * A design whose finest glyph stem is below what an FDM nozzle resolves, with
 * the measurement that says so. Reported alongside the mesh because nothing in
 * the geometry records it: the solid is watertight and correctly shaped, it
 * simply will not print as letters.
 */
export interface TypeStemWarning {
  /** Narrowest measured stem across every caption the design renders, in mm. */
  readonly minStemMm: number;
  /** The rendered size that produced it, so the panel can say how far to go. */
  readonly fontSizeMm: number;
  /** The threshold it fell under, so the panel never restates the constant. */
  readonly minPrintableStemMm: number;
}

export interface LabelTextOverflow {
  readonly scope: 'compartment' | 'row' | 'bin';
  readonly index: number;
}

/** One swappable label plate, meshed in plate-local coords. */
export interface LabelPlateMeshData {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly triangleCount: number;
  /**
   * Seated pose in bin-interior coordinates: plate centre in X/Y, BOTTOM face
   * in Z. The mesh itself is centred on the origin bottom-on-Z=0, so the
   * preview applies this to draw it clicked in, and its own layout to draw the
   * same mesh again in the reference row.
   */
  readonly seatX: number;
  readonly seatY: number;
  readonly seatZ: number;
  /**
   * Direction the plate withdraws from its socket (±Y), or 0 when it leaves
   * along Z instead. A wall-hung shelf's plate slides out over the
   * compartment; a board socket has no wall beside it, so its plate lifts
   * straight out of the pocket.
   */
  readonly slideY: 1 | -1 | 0;
  /** Set when the plate withdraws upward instead of sideways. */
  readonly slideZ?: 1;
  /** Yaw applied to the seated draw (deg). Present on 90° board sockets. */
  readonly yawDeg?: number;
  /** Footprint width (mm), so the preview can lay the reference row out. */
  readonly widthMm: number;
}

/** A bin's label plates plus however many exceeded the preview ceiling. */
export interface LabelPlatesMeshData {
  /**
   * Mutable element type (not `readonly LabelPlateMeshData[]`) because this
   * lands in the designer store, whose Immer drafts reject readonly arrays —
   * same reason `compartments.cells` is `number[]`.
   */
  readonly plates: LabelPlateMeshData[];
  /**
   * Planned plates absent from `plates` — past `MAX_PREVIEW_LABEL_PLATES`, or
   * skipped because they failed to build. 0 when the preview is complete.
   */
  readonly omittedCount: number;
}

/**
 * Mesh data for the seated snap-clip connector (single accent-colored solid,
 * no edge lines or face groups). Built in the worker so the preview matches the
 * exported, socket-relieved part exactly.
 */
export interface ConnectorKeyMeshData {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly triangleCount: number;
}

/** Mesh data for the click-lock lid (companion piece, separate solid). */
export interface LidMeshData {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
  readonly triangleCount: number;
  /** Per-face provenance for rail vs body rendering. */
  readonly faceGroups?: readonly FaceGroupData[];
}

/**
 * Mesh data for the sliding tray. A single uniform part with no face groups,
 * built floor-down at the origin; the preview places it on its rail.
 */
export interface SlideTrayMeshData {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
  readonly triangleCount: number;
  /** Z the tray's underside rests at, in the bin's own (box) frame. */
  readonly restZ: number;
}

/**
 * Mesh data for the separate stack-grid baseplate (glue-on companion slab).
 * A single lid-colored zone — no face groups. Carries edge lines so the pocket
 * ring reads crisply in the preview.
 */
export interface StackPlateMeshData {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
  readonly triangleCount: number;
}
