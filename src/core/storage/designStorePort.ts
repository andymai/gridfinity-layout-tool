/**
 * Design-store port — the seam that lets `core/storage` persist and read bin
 * designs without importing `features/bin-designer`.
 *
 * `core/` is infrastructure and must not depend on a feature (the
 * `boundaries/dependencies` rule makes `core → feature` a `disallow` edge).
 * Share/archive flows nonetheless need to load and save designs, so they talk
 * to this interface instead of `DesignerStorage`/`customBinRegistry` directly.
 * The concrete adapter lives in `features/bin-designer/storage/designStoreAdapter`
 * and is registered at the `shared/` composition root at app boot — mirroring
 * how the sync engine consumes `SyncAdapter`/`DesignAdapter`.
 *
 * Bin params are typed `unknown` here because `BinParams` lives in the feature
 * and core cannot import it; the concrete adapter re-narrows them (same pattern
 * as `DesignSyncPayload.params` in `@/core/sync/adapters/types`).
 */

import type { Result, StorageError } from '@/core/result';
import type { DesignId } from '@/core/types';

/** The slice of a stored design the share/archive flows read back on load. */
export interface LoadedDesignData {
  readonly id: DesignId;
  readonly name: string;
  /** Bin params (opaque; absent for non-bin design kinds). */
  readonly params?: unknown;
  /** Item kind for non-bin designs (opaque; the adapter narrows it). */
  readonly kind?: string;
  /** Envelope + structure for non-bin kinds (opaque, like `params`). */
  readonly envelope?: unknown;
  readonly structure?: unknown;
}

/** What core hands the port to persist a design. */
export interface SaveDesignInput {
  /** Omit to mint a fresh id; provide to upsert a specific design. */
  readonly id?: DesignId;
  readonly name: string;
  readonly params?: unknown;
  /**
   * Workshop assembly persistence: when `kind` is 'assembly' the adapter
   * gates `structure` through the descriptor's migration (schema salvage)
   * before saving — the same trust boundary the sync engine applies to a
   * remote payload. `params` is ignored for assembly saves.
   */
  readonly kind?: 'assembly';
  readonly envelope?: unknown;
  readonly structure?: unknown;
  readonly thumbnail: string | null;
  readonly exportFileNameConfig: null;
}

/** The slice of a saved design core reads back after a successful save. */
export interface SavedDesignData {
  readonly id: DesignId;
  readonly name: string;
  readonly updatedAt: string;
}

/**
 * Fractional-edge projection carried on a registry entry — mirrors the shape
 * the feature's `registryEdgeFields` returns so the two can't drift.
 */
export interface DesignRegistryEdgeFields {
  readonly fractionalEdgeX?: 'start' | 'end';
  readonly fractionalEdgeY?: 'start' | 'end';
  readonly fractionalEdgeManualX?: boolean;
  readonly fractionalEdgeManualY?: boolean;
  readonly halfSockets?: boolean;
}

/**
 * Lightweight registry entry core upserts after restoring a shared design —
 * mirrors the feature's `CustomBinRef` public shape (minus feature-only fields
 * core never sets).
 */
export interface DesignRegistryEntry extends DesignRegistryEdgeFields {
  readonly id: DesignId;
  readonly name: string;
  readonly width: number;
  readonly depth: number;
  readonly height: number;
  /** Item kind of the design; absent = parametric bin. */
  readonly kind?: 'importedMesh' | 'assembly';
  /** Assembled-rise fields — mirror the feature's `CustomBinRef`. */
  readonly assembledRiseMm?: number;
  readonly socketless?: boolean;
  readonly hasLip?: boolean;
  readonly overhangMm?: {
    readonly left: number;
    readonly right: number;
    readonly front: number;
    readonly back: number;
  };
  readonly updatedAt: string;
}

/**
 * The four operations `core/storage` needs from the bin-designer feature.
 * Every method is async so the adapter can lazily `import()` the feature
 * chunk on first use, preserving the code-splitting the old dynamic imports
 * gave us.
 */
export interface DesignStorePort {
  loadDesign(id: DesignId): Promise<Result<LoadedDesignData, StorageError>>;
  saveDesign(input: SaveDesignInput): Promise<Result<SavedDesignData, StorageError>>;
  upsertRegistryEntry(entry: DesignRegistryEntry): Promise<Result<void, StorageError>>;
  registryEdgeFields(params: unknown): Promise<DesignRegistryEdgeFields>;
}

let port: DesignStorePort | null = null;

/** Install the concrete port. Called once from the shared composition root. */
export function registerDesignStorePort(next: DesignStorePort): void {
  port = next;
}

/**
 * The installed port, or `null` before boot has registered it. Callers must
 * treat `null` as "no designs available" and fall back gracefully.
 */
export function getDesignStorePort(): DesignStorePort | null {
  return port;
}

/** Clear the installed port. For test teardown; not used in production. */
export function resetDesignStorePort(): void {
  port = null;
}
