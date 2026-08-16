export interface ThreeMFColorConfig {
  readonly materials: readonly { readonly color: string }[];
  readonly triangleMaterialIndices: readonly number[];
}

/**
 * Where a part sits when the file carries build plates.
 *
 * `x`/`y` are WORLD coordinates with the plate's own origin already applied,
 * because BambuStudio/OrcaSlicer lay plates out as a grid in one world space
 * (`PartPlateList`, stride = bed size * 1.2). Resolving the origin in the
 * caller keeps the grid math in one tested place: the transform written here
 * and the `plater_id` written into `model_settings.config` come from the same
 * computation, and a slicer shows parts floating off their plate if they
 * disagree.
 */
export interface ThreeMFPlacement {
  /** Zero-based plate index. Serialised as a 1-based `plater_id`. */
  readonly plate: number;
  /** World centre of the part's footprint, in mm. */
  readonly x: number;
  readonly y: number;
}

export interface ThreeMFObject {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly name: string;
  readonly colorConfig?: ThreeMFColorConfig;
  readonly placement?: ThreeMFPlacement;
}

export interface ThreeMFOptions {
  readonly name: string;
  readonly thumbnail?: Uint8Array;
  readonly printSettings?: ThreeMFPrintSettings;
  readonly colorConfig?: ThreeMFColorConfig;
  /**
   * Vertical stacking — the mesh is emitted once and referenced by `count`
   * build items, each translated by `i * (zHeightMm + spacingMm)` along Z so
   * slicers see each instance as a separate placement.
   * Honored by single-object export only; `export3MFMultiObject` ignores it
   * since stacking a heterogeneous bin + lid pair has no slicer interpretation.
   */
  readonly stack?: {
    readonly count: number;
    readonly zHeightMm: number;
    readonly spacingMm: number;
  };
}

export interface ThreeMFPrintSettings {
  readonly layerHeight?: number;
  readonly infillPercent?: number;
  readonly material?: string;
  readonly supportRequired?: boolean;
  readonly estimatedMinutes?: number;
  readonly estimatedGrams?: number;
}

export interface IndexedMesh {
  readonly vertices: readonly [number, number, number][];
  readonly triangles: readonly [number, number, number][];
}

export interface BBox {
  readonly min: { x: number; y: number; z: number };
  readonly max: { x: number; y: number; z: number };
}
