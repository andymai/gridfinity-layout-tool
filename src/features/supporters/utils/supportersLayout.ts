export interface ScenePoint {
  x: number;
  z: number;
}

export interface PlateZone extends ScenePoint {
  index: number;
  /** Footprint in sockets. */
  width: number;
  depth: number;
  /** Centre of the department strip printed in the socket row in front of the zone. */
  label: ScenePoint;
}

export interface ZonedLayout {
  zones: PlateZone[];
  plateColumns: number;
  plateRows: number;
  /** Plate footprint in scene units (1 unit = one 42mm socket). */
  width: number;
  depth: number;
  /** Every socket tile on the plate, occupied or not, for instancing. */
  sockets: ScenePoint[];
  /** Where the `slot`-th member of `zone` sits. */
  seat: (zone: number, slot: number) => ScenePoint;
  /** The empty socket the finale offers as "your bin here". */
  vacant: ScenePoint;
}

const ZONE_GRID_COLUMNS = 3;
const AISLE = 1;
const MARGIN = 1;

/**
 * A drawer-style plate: every zone is the same size block, sized to the
 * largest department, laid out three across with a one-socket aisle between
 * them and a margin ring outside. Each zone's label sits in the socket row in
 * front of it, which is an aisle or the front margin, so a strip never covers
 * a seat. Bins fill a zone back-left first, in roll order.
 */
export function computeZonedLayout(zoneSizes: number[]): ZonedLayout {
  const largest = Math.max(1, ...zoneSizes);
  const cols = Math.max(3, Math.ceil(Math.sqrt(largest * 1.25)));
  const rows = Math.max(2, Math.ceil(largest / cols));
  const gridRows = Math.max(1, Math.ceil(zoneSizes.length / ZONE_GRID_COLUMNS));

  const plateColumns = 2 * MARGIN + ZONE_GRID_COLUMNS * cols + (ZONE_GRID_COLUMNS - 1) * AISLE;
  const plateRows = 2 * MARGIN + gridRows * rows + (gridRows - 1) * AISLE;
  const socketX = (col: number): number => col - (plateColumns - 1) / 2;
  const socketZ = (row: number): number => row - (plateRows - 1) / 2;

  const origin = (zone: number) => ({
    col: MARGIN + (zone % ZONE_GRID_COLUMNS) * (cols + AISLE),
    row: MARGIN + Math.floor(zone / ZONE_GRID_COLUMNS) * (rows + AISLE),
  });

  const zones: PlateZone[] = zoneSizes.map((_, index) => {
    const { col, row } = origin(index);
    const x = (socketX(col) + socketX(col + cols - 1)) / 2;
    return {
      index,
      x,
      z: (socketZ(row) + socketZ(row + rows - 1)) / 2,
      width: cols,
      depth: rows,
      label: { x, z: socketZ(row + rows) },
    };
  });

  const seat = (zone: number, slot: number): ScenePoint => {
    const { col, row } = origin(zone);
    return { x: socketX(col + (slot % cols)), z: socketZ(row + Math.floor(slot / cols)) };
  };

  const sockets: ScenePoint[] = [];
  for (let row = 0; row < plateRows; row++) {
    for (let col = 0; col < plateColumns; col++) sockets.push({ x: socketX(col), z: socketZ(row) });
  }

  const frontCentre = { x: 0, z: socketZ(plateRows - 1) };
  let vacant: ScenePoint = { x: socketX(plateColumns - 1), z: socketZ(plateRows - 1) };
  let best = Number.POSITIVE_INFINITY;
  zoneSizes.forEach((size, zone) => {
    for (let slot = size; slot < cols * rows; slot++) {
      const p = seat(zone, slot);
      const d = Math.hypot(p.x - frontCentre.x, p.z - frontCentre.z);
      if (d < best) {
        best = d;
        vacant = p;
      }
    }
  });

  return {
    zones,
    plateColumns,
    plateRows,
    width: plateColumns,
    depth: plateRows,
    sockets,
    seat,
    vacant,
  };
}

export interface CameraFrame {
  /** Camera rest position. */
  position: [number, number, number];
  /** Orbit target (slightly below plate center so the plate sits low). */
  target: [number, number, number];
  distance: number;
}

const CAMERA_FOV_DEG = 38;
/** Rest direction: slightly right of front and elevated, a workbench glance. */
export const CAMERA_DIR: [number, number, number] = [0.22, 0.72, 1];
/** Steeper, for a single zone: label tapes face up, so a higher angle is what makes names readable. */
export const ZONE_CAMERA_DIR: [number, number, number] = [0.1, 1.25, 1];

export interface FrameOptions {
  center?: ScenePoint;
  /** Below 1 trades breathing room for size: a single zone wants it, the whole plate does not. */
  tightness?: number;
  direction?: [number, number, number];
  /** Share of the canvas height the footprint must fit, when credits take the rest. */
  heightFraction?: number;
}

/**
 * Fit a `width` × `depth` footprint into a stage of the given aspect, from the
 * workbench angle: its bounding radius against the stage's vertical fov and
 * the aspect-derived horizontal fov, whichever needs more distance.
 */
export function computeCameraFrame(
  footprint: { width: number; depth: number },
  aspect: number,
  {
    center = { x: 0, z: 0 },
    tightness = 1,
    direction = CAMERA_DIR,
    heightFraction = 1,
  }: FrameOptions = {}
): CameraFrame {
  const radius = 0.5 * Math.hypot(footprint.width, footprint.depth) * 1.18 * tightness;
  const vHalf = Math.atan(Math.tan((CAMERA_FOV_DEG * Math.PI) / 360) * heightFraction);
  const safeAspect = Math.max(0.3, aspect);
  const hHalf = Math.atan(Math.tan(vHalf) * safeAspect);
  const distance = Math.max(6, radius / Math.tan(vHalf), radius / Math.tan(hHalf));

  const len = Math.hypot(...direction);
  const target: [number, number, number] = [center.x, -0.4, center.z];
  const position: [number, number, number] = [
    target[0] + (direction[0] / len) * distance,
    target[1] + (direction[1] / len) * distance,
    target[2] + (direction[2] / len) * distance,
  ];
  return { position, target, distance };
}
