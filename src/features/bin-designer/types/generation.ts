import type {
  FaceGroupData,
  CoarseLODData,
  PerfSnapshot,
  StackPlateMeshData,
  SlideTrayMeshData,
  LabelPlatesMeshData,
  LabelTextOverflow,
  TypeStemWarning,
} from '@/shared/types/generation';
import type { BinParams } from './binParams';
import type { ItemEnvelope, ItemKind, ItemStructure } from '@/shared/types/item';

/**
 * Lid mesh data as stored in the designer store. Mirrors the shared
 * `LidMeshData` shape but with a mutable `faceGroups` array so the
 * Immer-backed store can ingest it. The bridge converts the worker's
 * readonly payload into this shape via spread in `useGeneration`.
 */
export interface LidMeshDataState {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
  readonly triangleCount: number;
  readonly faceGroups?: FaceGroupData[];
}

/** Current status of the generation engine */
export type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error';

/**
 * WASM/Worker initialization status.
 *
 * 'unsupported' is terminal in a way 'error' is not: the browser cannot compile
 * the kernel at all, so neither a retry nor a reload changes the outcome.
 */
export type WasmStatus = 'unloaded' | 'loading' | 'ready' | 'error' | 'unsupported';

/** Result of mesh generation */
export interface GenerationResult {
  readonly vertices: Float32Array | null;
  readonly normals: Float32Array | null;
  readonly indices: Uint32Array | null;
  readonly edgeVertices: Float32Array | null;
  readonly error: string | null;
  readonly timingMs: number;
  /** Optional per-face feature groups for provenance-based coloring. */
  readonly faceGroups?: FaceGroupData[];
  /** Coarse LOD mesh for distance-based rendering (preview only) */
  readonly coarseLOD?: CoarseLODData;
  /** Optional companion lid mesh, present only when the bin has a lid enabled. */
  readonly lidMesh?: LidMeshDataState;
  /** Optional separate stack-grid baseplate mesh (glue-on companion), present
   *  only when the lid uses `separateStackPlate`. No face groups, so the shared
   *  readonly shape is ingested directly. */
  readonly stackPlateMesh?: StackPlateMeshData;
  /**
   * Optional detachable feet, assembled under the bin. No face groups: the feet
   * are one part in one colour, so the shared readonly shape is ingested as is.
   */
  readonly detachableFeetMesh?: StackPlateMeshData;
  /**
   * Optional knife-block handle rest, present only when the design's rest is a
   * companion block. One part in one colour, so no face groups.
   */
  readonly knifeRestMesh?: StackPlateMeshData;
  /** Optional sliding-tray mesh — the companion part that rides the bin's rail. */
  readonly slideTrayMesh?: SlideTrayMeshData;
  /** Swappable label plates with their seated poses (socket mode, preview only). */
  readonly labelPlates?: LabelPlatesMeshData;
  /** Captions the build dropped because they overflow their host. Reported by
   *  the worker because the drop leaves no trace in the mesh to observe. */
  readonly labelTextOverflow?: LabelTextOverflow[];
  readonly typeStemWarning?: TypeStemWarning;
}

/** Generation state tracked in the store */
export interface GenerationState {
  readonly status: GenerationStatus;
  readonly mesh: GenerationResult | null;
  /**
   * True when `mesh` is a fast draft from the Manifold preview kernel and the
   * exact occt-wasm geometry is still computing. Drives the "sharpening…" hint.
   * Always false once the exact result lands (or when preview is off).
   */
  readonly isDraft: boolean;
  readonly progress: number;
  /** Increments on changes needing regeneration; cache hits leave epoch unchanged */
  readonly epoch: number;
  /**
   * Rolling buffer of recent generation timing snapshots (most recent
   * last, capped at PERF_HISTORY_LIMIT). Powers the dev PerfOverlay.
   */
  readonly perfHistory: readonly PerfSnapshot[];
}

/** Cap for `generation.perfHistory`. Tiny payloads; safe to keep many. */
export const PERF_HISTORY_LIMIT = 50;

/** Cached mesh data for undo/redo history entries */
export interface CachedMesh {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly edgeVertices: Float32Array;
  readonly triangleCount: number;
  readonly byteSize: number;
}

/** History entry pairing params with optional cached mesh */
export interface HistoryEntry {
  readonly params: BinParams;
  readonly mesh: CachedMesh | null;
  /**
   * Non-bin snapshot. History is cleared on every kind switch, so all
   * entries in one stack share the design's kind; entries captured while
   * designing a bin omit these.
   */
  readonly itemKind?: ItemKind;
  readonly structure?: ItemStructure | null;
  readonly envelope?: ItemEnvelope | null;
}

// Designer UI State Types

/** Mesh data for a single split bin piece, used for Three.js rendering */
export interface SplitPieceMeshEntry {
  readonly label: string;
  readonly col: number;
  readonly row: number;
  readonly widthUnits: number;
  readonly depthUnits: number;
  /** X offset in grid units from bin origin (left edge) */
  readonly offsetX: number;
  /** Y offset in grid units from bin origin (bottom edge) */
  readonly offsetY: number;
  readonly mesh: {
    readonly vertices: Float32Array | null;
    readonly normals: Float32Array | null;
    readonly indices: Uint32Array | null;
    readonly edgeVertices: Float32Array | null;
  };
}
