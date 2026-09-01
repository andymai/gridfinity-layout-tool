import type { SpaceMouseCommand } from '../types';

/**
 * The read/write surface a single canvas exposes to the driver. One of these is
 * registered per `SpaceMouseController`; the navlib client delegates to whichever
 * canvas the bus reports active, so the one driver controller always drives the
 * focused view. Vectors/matrices are plain arrays; affines are column-major to
 * match THREE's `Matrix4.toArray()`.
 */
export interface NavlibViewAccessors {
  getViewMatrix(): number[];
  setViewMatrix(data: number[]): void;
  getPerspective(): boolean;
  getViewExtents(): number[];
  setViewExtents(data: number[]): void;
  getViewTarget(): number[];
  getFov(): number;
  getViewFrustum(): number[];
  getModelExtents(): number[] | null;
  getPivotPosition(): number[] | null;
  getCoordinateSystem(): number[];
  getFrontView(): number[];
  getViewRotatable(): boolean;
  // Hit testing: the driver sets a ray, then reads back where it lands so it can
  // pivot around the surface under the cursor.
  setLookFrom(data: number[]): void;
  setLookDirection(data: number[]): void;
  setLookAperture(data: number): void;
  setSelectionOnly(data: boolean): void;
  getLookAt(): number[] | null;
  getPointerPosition(): number[] | null;
  /** Wake the (demand) frameloop after the driver writes a new camera. */
  invalidate(): void;
}

/** Commands exported to the driver UI so pucks can bind buttons to them. */
export interface NavlibCommandDef {
  id: string;
  label: string;
  description: string;
  command: SpaceMouseCommand;
}

/**
 * Stable ids (prefixed to avoid colliding with the driver's reserved ids). The
 * driver echoes the id back through `setActiveCommand` when a bound button fires.
 */
export const NAVLIB_COMMANDS: readonly NavlibCommandDef[] = [
  { id: 'GFLT_FIT', label: 'Fit to view', description: 'Frame the model', command: 'fit' },
  {
    id: 'GFLT_RESET',
    label: 'Reset view',
    description: 'Reset to the default view',
    command: 'reset',
  },
  {
    id: 'GFLT_VIEW_TOP',
    label: 'Top view',
    description: 'Look down the up axis',
    command: 'view-top',
  },
  {
    id: 'GFLT_VIEW_FRONT',
    label: 'Front view',
    description: 'Look along the front axis',
    command: 'view-front',
  },
  {
    id: 'GFLT_VIEW_RIGHT',
    label: 'Right view',
    description: 'Look along the side axis',
    command: 'view-right',
  },
  {
    id: 'GFLT_VIEW_ISO',
    label: 'Isometric view',
    description: 'Three-quarter view',
    command: 'view-iso',
  },
  { id: 'GFLT_UNDO', label: 'Undo', description: 'Undo the last action', command: 'undo' },
  { id: 'GFLT_REDO', label: 'Redo', description: 'Redo the last action', command: 'redo' },
];

const BY_ID = new Map<string, SpaceMouseCommand>(NAVLIB_COMMANDS.map((c) => [c.id, c.command]));

/**
 * Resolve a driver command id to our command. Recognizes our exported ids and,
 * as a fallback, the driver's built-in Fit (its reserved id contains "FIT"), so
 * a puck's dedicated Fit button works without the user binding it.
 */
export function commandForId(id: string): SpaceMouseCommand | null {
  const exact = BY_ID.get(id);
  if (exact) return exact;
  if (id.toUpperCase().includes('FIT')) return 'fit';
  return null;
}
