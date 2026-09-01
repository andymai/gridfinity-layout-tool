/**
 * Types for `@3dconnexion/3dconnexionjs` (0.8.1), which ships no declarations.
 * Covers only the surface this integration uses. The driver reads the getters
 * and writes the setters; every callback is optional except `onConnect`.
 * Matrices/vectors are plain number arrays (column-major for affines, matching
 * THREE's `Matrix4.toArray()`). The package is loaded through {@link ./tdx}.
 */
export interface NavlibClient {
  /** Required. Fired once the NL-Proxy websocket is up; call `create3dmouse` here. */
  onConnect(): void;
  onDisconnect?(reason: string): void;
  /** Fired once the 3dcontroller exists; export commands / set the timing source here. */
  on3dmouseCreated?(): void;
  onStartMotion?(): void;
  onStopMotion?(): void;

  // Reads (driver → app)
  getViewMatrix?(): number[];
  getViewExtents?(): number[];
  getViewFrustum?(): number[];
  getViewTarget?(): number[];
  getViewRotatable?(): boolean;
  getFov?(): number;
  getPerspective?(): boolean;
  getModelExtents?(): number[] | null;
  getPivotPosition?(): number[] | null;
  getConstructionPlane?(): number[];
  getFloorPlane?(): number[];
  getUnitsToMeters?(): number;
  getCoordinateSystem?(): number[];
  getFrontView?(): number[];
  getPointerPosition?(): number[] | null;
  getLookAt?(): number[] | null;

  // Writes (driver → app)
  setViewMatrix?(data: number[]): void;
  setViewExtents?(data: number[]): void;
  setFov?(data: number): void;
  setTarget?(data: number[]): void;
  setMoving?(moving: boolean): void;
  setTransaction?(transaction: number): void;
  setActiveCommand?(id: string): void;
  setLookFrom?(data: number[]): void;
  setLookDirection?(data: number[]): void;
  setLookAperture?(data: number): void;
  setSelectionOnly?(data: boolean): void;
}

/** A node in the exported command tree (button-configurable in the driver UI). */
export interface NavlibActionNode {
  push(node: NavlibActionNode): NavlibActionNode;
}

export interface NavlibImageItem {
  id: string;
}

export interface NavlibImageCache {
  onload: (() => void) | null;
  images: NavlibImageItem[];
  push(item: NavlibImageItem): void;
}

export interface Navlib {
  version: string;
  /** Kicks off the connection to the local NL-Proxy. Returns 0 on synchronous failure. */
  connect(): number;
  /**
   * Binds the controller to a container element (or `window`) whose focus/blur
   * gates input, and registers `appName` as the profile shown in the driver UI.
   */
  create3dmouse(view: Window | HTMLElement, appName: string, options?: number): void;
  update3dcontroller(value: Record<string, unknown>): Promise<unknown>;
  read3dcontroller(property: string, onRead?: (result: unknown) => void): Promise<unknown>;
  delete3dmouse(): void;
  close(): void;
}

/** The library's single constructor; its command classes hang off it as statics. */
export interface NavlibConstructor {
  new (client: NavlibClient): Navlib;
  nlOptions: { none: number; rowMajorOrder: number };
  ActionTree: new () => NavlibActionNode;
  ActionSet: new (id: string, label: string) => NavlibActionNode;
  Category: new (id: string, label: string) => NavlibActionNode;
  Action: new (id: string, label: string, description?: string) => NavlibActionNode;
  ImageCache: new () => NavlibImageCache;
  ImageItem: { fromURL(url: string, id: string): NavlibImageItem };
}
