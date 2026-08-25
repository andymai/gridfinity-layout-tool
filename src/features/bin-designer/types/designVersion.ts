import type { DesignId } from '@/core/types';

/**
 * A named, restorable snapshot of one design.
 *
 * Distinct from undo/redo, which is an unnamed in-memory stack bounded by
 * `MAX_HISTORY` and lost on reload. A version is an intentional checkpoint the
 * user named and expects to find later.
 *
 * `content` is a compressed `DesignVersionContent` rather than a `BinParams`:
 * a saved design is not always a bin (`toolRack`, `importedMesh` and `assembly`
 * carry `envelope`/`structure` and no params at all), and a params-shaped record
 * would store nothing for those.
 */
export interface DesignVersion {
  readonly id: string;
  /** The design this version belongs to. */
  readonly designId: DesignId;
  /** User-supplied name, e.g. "0.2 mm, tight". Never blank; the service defaults it. */
  readonly name: string;
  /** `compressString(JSON.stringify(DesignVersionContent))`. */
  readonly content: string;
  /**
   * Preview of the design at capture time. Deliberately NOT part of
   * {@link DesignVersionContent}: it is a rendered PNG data URL, and the design
   * sync envelope is capped at 100KB, so a thumbnail would consume most of the
   * budget for a value that regenerates locally.
   */
  readonly thumbnail: string | null;
  /** ISO timestamp of the capture. Never moves after the version is written. */
  readonly createdAt: string;
  /**
   * ISO timestamp of the last edit to the version's own metadata (a rename or a
   * pin). Absent on versions written before the field existed, which read as
   * never edited.
   *
   * Separate from {@link createdAt} because sync compares mtimes: without it a
   * rename pushes the original capture time, loses last-write-wins against the
   * copy already on the server, and never converges.
   */
  readonly updatedAt?: string;
  /**
   * `'pre-restore'` marks the automatic capture taken immediately before a
   * restore overwrites the working state. Eviction drops these before anything
   * the user named, since only one of the two was a decision.
   */
  readonly origin: DesignVersionOrigin;
  /** Pinned versions are exempt from eviction. */
  readonly pinned?: boolean;
}

export type DesignVersionOrigin = 'manual' | 'pre-restore';

/**
 * The part of a `SavedDesign` a version restores. Mirrors the fields
 * `DesignSyncPayload` carries, so the same body shape works for every
 * `ItemKind` and stays validatable by the existing designer payload validator.
 */
export interface DesignVersionContent {
  readonly name: string;
  readonly params?: unknown;
  readonly kind?: unknown;
  readonly envelope?: unknown;
  readonly structure?: unknown;
}

/**
 * Per-design ceiling. Versions are intentional, so this is generous enough that
 * a normal iteration session never reaches it, and eviction is announced when
 * it does.
 */
export const MAX_VERSIONS_PER_DESIGN = 25;

/** Row metadata for the history list: everything but the compressed body. */
export type DesignVersionSummary = Omit<DesignVersion, 'content'>;
