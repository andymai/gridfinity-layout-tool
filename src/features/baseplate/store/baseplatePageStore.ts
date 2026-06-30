/**
 * Ephemeral page state for the standalone baseplate page.
 *
 * Tracks WASM worker status, generation progress, the current mesh result,
 * and split tiling state for multi-piece baseplates.
 * This store is NOT persisted - it resets when the page unmounts.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { BaseplateTiling, DedupStats } from '../types/tiling';
import type { ExportFileNameConfig, MarginPiece } from '@/shared/types/bin';

type GenerationStatus = 'idle' | 'generating' | 'complete' | 'error';
type WasmStatus = 'unloaded' | 'loading' | 'ready' | 'error';

/** View mode for split baseplates: assembled (no gaps) or exploded (gaps between pieces). */
export type SplitViewMode = 'assembled' | 'exploded';

interface MeshResult {
  readonly vertices: Float32Array | null;
  readonly normals: Float32Array | null;
  readonly indices: Uint32Array | null;
  readonly edgeVertices: Float32Array | null;
  readonly error: string | null;
  readonly timingMs: number;
}

/**
 * Seated snap-clip connector mesh, generated once by the worker (the exact
 * socket-relieved part) and seated at every seam junction by the preview.
 */
export interface ConnectorKeyMesh {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly indices: Uint32Array;
  readonly triangleCount: number;
}

/** A generated mesh for a single piece in a split baseplate. */
export interface PieceMeshEntry {
  readonly label: string;
  readonly col: number;
  readonly row: number;
  readonly mesh: MeshResult;
  /** Grid offset in units from left edge */
  readonly offsetX: number;
  /** Grid offset in units from front edge */
  readonly offsetY: number;
  /** Piece width in grid units */
  readonly widthUnits: number;
  /** Piece depth in grid units */
  readonly depthUnits: number;
  /**
   * Rotation (0 or 180 degrees) applied around the piece center when placing
   * the mesh. Always 0 unless `preferIdenticalPieces` is on and this piece
   * shares its canonical mesh with another (180°-rotated) piece in the tiling.
   */
  readonly placementRotationDeg: 0 | 180;
}

/**
 * A generated detached margin rail (issue #2392). The mesh is centered at the
 * origin; the preview positions it by `worldOffsetMm` (mm, plate-centered frame)
 * — unlike `PieceMeshEntry`, which positions by grid-unit offsets.
 */
export interface MarginMeshEntry {
  readonly id: string;
  readonly side: MarginPiece['side'];
  readonly mesh: MeshResult;
  readonly worldOffsetMm: { readonly x: number; readonly y: number };
  readonly lengthMm: number;
  readonly bandThicknessMm: number;
  /** Adjacent body piece col/row — drives exploded-view offset (matches pieces). */
  readonly col: number;
  readonly row: number;
}

interface BaseplatePageState {
  generation: {
    status: GenerationStatus;
    mesh: MeshResult | null;
    epoch: number;
  };
  wasmStatus: WasmStatus;

  /** Split tiling plan (null if not yet computed) */
  tiling: BaseplateTiling | null;
  /** Generated meshes for each piece when split */
  pieceMeshes: readonly PieceMeshEntry[];
  /** Generated meshes for detached margin rails (empty unless detachMargins) */
  marginMeshes: readonly MarginMeshEntry[];
  connectorKeyMesh: ConnectorKeyMesh | null;
  /** View mode for split preview */
  splitViewMode: SplitViewMode;
  /** Progress for multi-piece generation: null when not splitting */
  splitProgress: { current: number; total: number } | null;
  /** Deduplication statistics for current split generation */
  dedupStats: DedupStats | null;

  /** Currently hovered piece label (e.g. "A1"), synced between panel and 3D */
  hoveredPieceLabel: string | null;
  /** Currently selected (sticky) piece label */
  selectedPieceLabel: string | null;

  /** Whether the export dialog is open */
  exportDialogOpen: boolean;
  /** Export filename configuration */
  exportFileNameConfig: ExportFileNameConfig;
  /** Progress for multi-piece export: null when not exporting */
  exportProgress: { current: number; total: number } | null;

  setGenerationStatus: (status: GenerationStatus) => void;
  setGenerationResult: (result: MeshResult) => void;
  setWasmStatus: (status: WasmStatus) => void;
  bumpEpoch: () => void;
  setTiling: (tiling: BaseplateTiling | null) => void;
  setPieceMeshes: (meshes: readonly PieceMeshEntry[]) => void;
  setMarginMeshes: (meshes: readonly MarginMeshEntry[]) => void;
  setConnectorKeyMesh: (mesh: ConnectorKeyMesh | null) => void;
  setSplitViewMode: (mode: SplitViewMode) => void;
  setSplitProgress: (progress: { current: number; total: number } | null) => void;
  setHoveredPieceLabel: (label: string | null) => void;
  setSelectedPieceLabel: (label: string | null) => void;
  setExportDialogOpen: (open: boolean) => void;
  setExportFileNameConfig: (config: ExportFileNameConfig) => void;
  setExportProgress: (progress: { current: number; total: number } | null) => void;
  setDedupStats: (stats: DedupStats | null) => void;
}

export const useBaseplatePageStore = create<BaseplatePageState>()(
  immer((set) => ({
    generation: {
      status: 'idle',
      mesh: null,
      epoch: 0,
    },
    wasmStatus: 'unloaded',
    tiling: null,
    pieceMeshes: [],
    marginMeshes: [],
    connectorKeyMesh: null,
    splitViewMode: 'exploded',
    splitProgress: null,
    dedupStats: null,
    hoveredPieceLabel: null,
    selectedPieceLabel: null,
    exportDialogOpen: false,
    exportFileNameConfig: { style: 'descriptive', customName: '', format: 'stl' },
    exportProgress: null,

    setGenerationStatus: (status) => {
      set((state) => {
        state.generation.status = status;
      });
    },

    setGenerationResult: (result) => {
      set((state) => {
        state.generation.mesh = result;
      });
    },

    setWasmStatus: (status) => {
      set((state) => {
        state.wasmStatus = status;
      });
    },

    bumpEpoch: () => {
      set((state) => {
        state.generation.epoch += 1;
      });
    },

    setTiling: (tiling) => {
      set((state) => {
        // Cast needed: immer wraps readonly arrays in BaseplateTiling.pieces
        state.tiling = tiling as typeof state.tiling;
        state.hoveredPieceLabel = null;
        state.selectedPieceLabel = null;
      });
    },

    setPieceMeshes: (meshes) => {
      set((state) => {
        // Cast needed: immer wraps readonly arrays
        state.pieceMeshes = meshes as PieceMeshEntry[];
        state.hoveredPieceLabel = null;
        state.selectedPieceLabel = null;
      });
    },

    setMarginMeshes: (meshes) => {
      set((state) => {
        // Cast needed: immer wraps readonly arrays
        state.marginMeshes = meshes as MarginMeshEntry[];
      });
    },

    setConnectorKeyMesh: (mesh) => {
      set((state) => {
        state.connectorKeyMesh = mesh;
      });
    },

    setSplitViewMode: (mode) => {
      set((state) => {
        state.splitViewMode = mode;
      });
    },

    setSplitProgress: (progress) => {
      set((state) => {
        state.splitProgress = progress;
      });
    },

    setHoveredPieceLabel: (label) => {
      set((state) => {
        state.hoveredPieceLabel = label;
      });
    },

    setSelectedPieceLabel: (label) => {
      set((state) => {
        state.selectedPieceLabel = label;
      });
    },

    setExportDialogOpen: (open) => {
      set((state) => {
        state.exportDialogOpen = open;
      });
    },

    setExportFileNameConfig: (config) => {
      set((state) => {
        state.exportFileNameConfig = config;
      });
    },

    setExportProgress: (progress) => {
      set((state) => {
        state.exportProgress = progress;
      });
    },

    setDedupStats: (stats) => {
      set((state) => {
        state.dedupStats = stats;
      });
    },
  }))
);
