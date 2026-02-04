/**
 * Hexagonal grid geometry for wall patterns.
 *
 * Pure math module — calculates hex center positions for a honeycomb pattern.
 * No brepjs imports; the caller (binGenerator) builds actual 3D shapes.
 *
 * Both axes are strictly bounded: no hex protrudes past the fill area.
 * This protects wall corners (X) and stacking lip / base (Y).
 *
 * Pointy-top hex geometry (circumradius R):
 *   flat-to-flat width    = √3 × R
 *   vertex-to-vertex height = 2R
 *   column spacing         = √3R + web
 *   row spacing            = 1.5R + web
 *   odd rows offset        = colSpacing / 2
 *
 * Pointy-top orientation improves 3D printing bridging (printer bridges
 * across a point, not a flat edge).
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
 * Calculate pointy-top hex center positions.
 *
 * Both axes are strictly bounded — no hex protrudes past ±fillW/2 or ±fillH/2.
 */
export function calculateHexCenters(config: HexGridConfig): HexCenter[] {
  const { fillW, fillH, hexRadius, webThickness } = config;

  if (hexRadius <= 0) return [];

  const R = hexRadius;
  const inradius = (Math.sqrt(3) / 2) * R;

  // Pointy-top: flat-to-flat width is horizontal (inradius), vertex-to-vertex is vertical (R)
  const colSpacing = Math.sqrt(3) * R + webThickness;
  const rowSpacing = 1.5 * R + webThickness;

  // maxX bounded by inradius (horizontal flat-to-flat), maxY by R (vertical vertex)
  const maxX = fillW / 2 - inradius;
  const maxY = fillH / 2 - R;

  if (maxX < 0 || maxY < 0) return [];

  const centers: HexCenter[] = [];

  const startRow = Math.floor(-maxY / rowSpacing);
  const endRow = Math.ceil(maxY / rowSpacing);

  for (let row = startRow; row <= endRow; row++) {
    const y = row * rowSpacing;
    if (Math.abs(y) > maxY) continue;

    // Odd rows offset horizontally (pointy-top stagger pattern)
    const xOffset = (row & 1) === 1 ? colSpacing / 2 : 0;

    const startCol = Math.ceil((-maxX - xOffset) / colSpacing);
    const endCol = Math.floor((maxX - xOffset) / colSpacing);

    for (let col = startCol; col <= endCol; col++) {
      const x = col * colSpacing + xOffset;
      centers.push({ x, y });
    }
  }

  return centers;
}
