export interface SocketPosition {
  index: number;
  col: number;
  row: number;
  /** Scene-space position on the baseplate plane (centered on origin). */
  x: number;
  z: number;
}

export interface BaseplateLayout {
  columns: number;
  rows: number;
  pitch: number;
  width: number;
  depth: number;
  positions: SocketPosition[];
}

/**
 * Arrange `count` bins into a centered, slightly-wide socket grid on a
 * baseplate. Pure and deterministic so it can be unit-tested; the scene
 * consumes the returned positions directly (scene units, one bin per pitch).
 */
export function computeBaseplateLayout(count: number, pitch = 1.12): BaseplateLayout {
  const safeCount = Math.max(0, Math.floor(count));
  const columns = Math.min(
    Math.max(1, safeCount),
    Math.max(1, Math.ceil(Math.sqrt(safeCount * 1.6)))
  );
  const rows = safeCount === 0 ? 0 : Math.ceil(safeCount / columns);

  const positions: SocketPosition[] = [];
  for (let index = 0; index < safeCount; index++) {
    const col = index % columns;
    const row = Math.floor(index / columns);
    positions.push({
      index,
      col,
      row,
      x: (col - (columns - 1) / 2) * pitch,
      z: (row - (rows - 1) / 2) * pitch,
    });
  }

  return { columns, rows, pitch, width: columns * pitch, depth: rows * pitch, positions };
}
