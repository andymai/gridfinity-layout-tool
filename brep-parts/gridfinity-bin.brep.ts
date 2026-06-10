import { box, cut, unwrap } from 'brepjs';

// Standard Gridfinity (matches the tool's CONSTRAINTS defaults).
const GRID_UNIT = 42; // mm
const HEIGHT_UNIT = 7; // mm
const GRID_X = 1;
const GRID_Y = 2;
const HEIGHT_UNITS = 3;
const WALL = 1.2;
const FLOOR = 1.0;
const CLEARANCE = 0.5; // gap to neighbouring cells

export default () => {
  const w = GRID_X * GRID_UNIT - CLEARANCE;
  const d = GRID_Y * GRID_UNIT - CLEARANCE;
  const h = HEIGHT_UNITS * HEIGHT_UNIT;
  const body = box(w, d, h);
  // Hollow it: remove an inner cavity, leaving floor + walls.
  const cavity = box(w - 2 * WALL, d - 2 * WALL, h, { at: [WALL, WALL, FLOOR] });
  return unwrap(cut(body, cavity));
};
