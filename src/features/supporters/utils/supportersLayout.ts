export interface SocketPosition {
  index: number;
  col: number;
  row: number;
  /** Scene-space position on the baseplate plane (centered on origin). */
  x: number;
  z: number;
}

export interface BaseplateLayout {
  /** Bin-cluster grid (excludes the empty margin ring). */
  columns: number;
  rows: number;
  /** Full plate grid (bin cluster + margin ring of empty sockets). */
  plateColumns: number;
  plateRows: number;
  /** Plate footprint in scene units (1 unit = one 42mm socket). */
  width: number;
  depth: number;
  /** One seat per supporter bin, row-major from the back-left. */
  positions: SocketPosition[];
  /** Every socket tile on the plate (occupied or not), for instancing. */
  sockets: { x: number; z: number }[];
}

/**
 * Arrange `count` bins into a centered, slightly-wide grid of real sockets.
 * Bins sit on exact 42mm pitch (1 unit) like a physical plate; a one-socket
 * margin ring stays empty so the plate visibly has room for more supporters.
 * Pure and deterministic so it can be unit-tested; the scene consumes the
 * returned positions directly.
 */
export function computeBaseplateLayout(count: number): BaseplateLayout {
  const safeCount = Math.max(0, Math.floor(count));
  const columns = Math.min(
    Math.max(1, safeCount),
    Math.max(1, Math.ceil(Math.sqrt(safeCount * 1.6)))
  );
  const rows = Math.max(1, safeCount === 0 ? 1 : Math.ceil(safeCount / columns));

  const plateColumns = columns + 2;
  const plateRows = rows + 2;

  const socketX = (col: number): number => col - (plateColumns - 1) / 2;
  const socketZ = (row: number): number => row - (plateRows - 1) / 2;

  const positions: SocketPosition[] = [];
  for (let index = 0; index < safeCount; index++) {
    const col = 1 + (index % columns);
    const row = 1 + Math.floor(index / columns);
    positions.push({ index, col, row, x: socketX(col), z: socketZ(row) });
  }

  const sockets: { x: number; z: number }[] = [];
  for (let row = 0; row < plateRows; row++) {
    for (let col = 0; col < plateColumns; col++) {
      sockets.push({ x: socketX(col), z: socketZ(row) });
    }
  }

  return {
    columns,
    rows,
    plateColumns,
    plateRows,
    width: plateColumns,
    depth: plateRows,
    positions,
    sockets,
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
/** Rest direction: slightly right of front, elevated — a workbench glance. */
const CAMERA_DIR: [number, number, number] = [0.22, 0.72, 1];

/**
 * Frame the plate for the current viewport so the whole grid fits with
 * breathing room in both landscape and portrait. Pure math (no three.js):
 * fits the plate's bounding radius against the vertical fov and the
 * aspect-derived horizontal fov, taking whichever needs more distance.
 */
export function computeCameraFrame(
  layout: Pick<BaseplateLayout, 'width' | 'depth'>,
  aspect: number
): CameraFrame {
  const radius = 0.5 * Math.hypot(layout.width, layout.depth) * 1.18;
  const vHalf = (CAMERA_FOV_DEG * Math.PI) / 360;
  const safeAspect = Math.max(0.3, aspect);
  const hHalf = Math.atan(Math.tan(vHalf) * safeAspect);
  const distance = Math.max(6, radius / Math.tan(vHalf), radius / Math.tan(hHalf));

  const len = Math.hypot(...CAMERA_DIR);
  const target: [number, number, number] = [0, -0.4, 0];
  const position: [number, number, number] = [
    target[0] + (CAMERA_DIR[0] / len) * distance,
    target[1] + (CAMERA_DIR[1] / len) * distance,
    target[2] + (CAMERA_DIR[2] / len) * distance,
  ];
  return { position, target, distance };
}
