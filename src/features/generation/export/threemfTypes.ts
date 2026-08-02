export interface ThreeMFColorConfig {
  readonly materials: readonly { readonly color: string }[];
  readonly triangleMaterialIndices: readonly number[];
}

export interface ThreeMFObject {
  readonly vertices: Float32Array;
  readonly normals: Float32Array;
  readonly name: string;
  readonly colorConfig?: ThreeMFColorConfig;
}

export interface ThreeMFOptions {
  readonly name: string;
  readonly thumbnail?: Uint8Array;
  readonly printSettings?: ThreeMFPrintSettings;
  readonly colorConfig?: ThreeMFColorConfig;
  /**
   * Vertical stacking — the mesh is emitted once and referenced by `count`
   * build items, each translated by `i * (zHeightMm + spacingMm)` along Z so
   * slicers see each instance as a separate placement (issue #1642).
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
