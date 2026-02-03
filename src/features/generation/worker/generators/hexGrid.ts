/**
 * Hexagonal grid geometry for wall patterns.
 *
 * Pure math module — calculates hex center positions for a honeycomb pattern.
 * No brepjs imports; the caller (binGenerator) builds actual 3D shapes.
 *
 * Both axes are strictly bounded: no hex protrudes past the fill area.
 * This protects wall corners (X) and stacking lip / base (Y).
 *
 * Flat-top hex geometry (circumradius R):
 *   vertex-to-vertex width = 2R
 *   flat-to-flat height   = √3 × R
 *   column spacing         = 1.5R + web
 *   row spacing            = √3R + web
 *   odd columns offset     = rowSpacing / 2
 */

/** Configuration for hex grid generation (all dimensions in mm). */
export interface HexGridConfig {
  /** Width to fill — hexes stay within this boundary */
  readonly fillW: number;
  /** Height to fill — hexes stay within this boundary */
  readonly fillH: number;
  /** Circumradius of each hex hole (center to vertex, mm) */
  readonly hexRadius: number;
  /** Solid web thickness between adjacent hex holes (mm) */
  readonly webThickness: number;
}

/** Center position of a single hex cell. */
export interface HexCenter {
  readonly x: number;
  readonly y: number;
}

/**
 * Calculate flat-top hex center positions.
 *
 * Both axes are strictly bounded — no hex protrudes past ±fillW/2 or ±fillH/2.
 */
export function calculateHexCenters(config: HexGridConfig): HexCenter[] {
  const { fillW, fillH, hexRadius, webThickness } = config;

  if (hexRadius <= 0) return [];

  const R = hexRadius;
  const inradius = (Math.sqrt(3) / 2) * R;
  const colSpacing = 1.5 * R + webThickness;
  const rowSpacing = Math.sqrt(3) * R + webThickness;

  const maxX = fillW / 2 - R;
  const maxY = fillH / 2 - inradius;

  if (maxX < 0 || maxY < 0) return [];

  const centers: HexCenter[] = [];

  const startCol = Math.floor(-maxX / colSpacing);
  const endCol = Math.ceil(maxX / colSpacing);

  for (let col = startCol; col <= endCol; col++) {
    const x = col * colSpacing;
    if (Math.abs(x) > maxX) continue;

    const yOffset = (col & 1) === 1 ? rowSpacing / 2 : 0;

    const startRow = Math.ceil((-maxY - yOffset) / rowSpacing);
    const endRow = Math.floor((maxY - yOffset) / rowSpacing);

    for (let row = startRow; row <= endRow; row++) {
      const y = row * rowSpacing + yOffset;
      centers.push({ x, y });
    }
  }

  return centers;
}
