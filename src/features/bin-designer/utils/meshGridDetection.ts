/**
 * Grid-footprint inference for imported bin STLs.
 *
 * Reads the oriented mesh bounding box and proposes the Gridfinity footprint
 * the model most plausibly is: width/depth snapped to the designer's 0.5-unit
 * steps (a W-unit bin's outer size is W·gridUnit − TOLERANCE), and height in
 * whole 7mm units. Height units include the base, and a bin exported WITH its
 * stacking lip measures H·7 + 4.4mm — both candidates are tested and the
 * closer one wins, so a lipped 3U bin (25.4mm) reads as 3U, not 4U.
 *
 * Deviations are reported in mm so the import dialog can warn when a model
 * is meaningfully off-grid (not actually a Gridfinity bin, or scaled).
 */
import { GRIDFINITY_SPEC } from '@/shared/printSettings';
import { DESIGNER_CONSTRAINTS } from '../constants/gridfinity';

export interface DetectedGrid {
  /** Snapped footprint width in grid units (0.5 steps). */
  readonly width: number;
  /** Snapped footprint depth in grid units (0.5 steps). */
  readonly depth: number;
  /** Snapped height in whole Gridfinity height units. */
  readonly heightUnits: number;
  /** mm deviation of the mesh from the snapped grid dimension per axis. */
  readonly deviation: { readonly x: number; readonly y: number; readonly z: number };
  /** True when the mesh height reads best as heightUnits·7 + stacking lip. */
  readonly hasLip: boolean;
  /** True when any axis deviates more than the warning threshold. */
  readonly offGrid: boolean;
}

/** Deviation (mm) beyond which the import dialog shows an off-grid warning. */
export const OFF_GRID_WARNING_MM = 2;

const DIM_STEP = DESIGNER_CONSTRAINTS.DIMENSION_STEP;
const MIN_DIM = DESIGNER_CONSTRAINTS.MIN_DIMENSION;
const MAX_DIM = DESIGNER_CONSTRAINTS.MAX_DIMENSION;
const MIN_H = 1;
const MAX_H = DESIGNER_CONSTRAINTS.MAX_HEIGHT;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Snap one footprint axis: outer mm of a W-unit bin is W·gridUnit − TOLERANCE. */
function snapFootprintAxis(mm: number, gridUnitMm: number): { units: number; deviation: number } {
  const rawUnits = (mm + GRIDFINITY_SPEC.TOLERANCE) / gridUnitMm;
  const units = clamp(Math.round(rawUnits / DIM_STEP) * DIM_STEP, MIN_DIM, MAX_DIM);
  const nominalMm = units * gridUnitMm - GRIDFINITY_SPEC.TOLERANCE;
  return { units, deviation: Math.abs(mm - nominalMm) };
}

/** Snap the height axis, testing lipless (H·hu) and lipped (H·hu + lip) reads. */
function snapHeightAxis(
  mm: number,
  heightUnitMm: number
): { units: number; deviation: number; hasLip: boolean } {
  const noLipUnits = clamp(Math.round(mm / heightUnitMm), MIN_H, MAX_H);
  const noLipDeviation = Math.abs(mm - noLipUnits * heightUnitMm);

  const lipUnits = clamp(
    Math.round((mm - GRIDFINITY_SPEC.LIP_HEIGHT) / heightUnitMm),
    MIN_H,
    MAX_H
  );
  const lipDeviation = Math.abs(mm - (lipUnits * heightUnitMm + GRIDFINITY_SPEC.LIP_HEIGHT));

  return lipDeviation < noLipDeviation
    ? { units: lipUnits, deviation: lipDeviation, hasLip: true }
    : { units: noLipUnits, deviation: noLipDeviation, hasLip: false };
}

export function detectGridFromSize(
  sizeMm: { readonly x: number; readonly y: number; readonly z: number },
  gridUnitMm: number = GRIDFINITY_SPEC.GRID_SIZE,
  heightUnitMm: number = GRIDFINITY_SPEC.HEIGHT_UNIT
): DetectedGrid {
  const x = snapFootprintAxis(sizeMm.x, gridUnitMm);
  const y = snapFootprintAxis(sizeMm.y, gridUnitMm);
  const z = snapHeightAxis(sizeMm.z, heightUnitMm);

  return {
    width: x.units,
    depth: y.units,
    heightUnits: z.units,
    deviation: { x: x.deviation, y: y.deviation, z: z.deviation },
    hasLip: z.hasLip,
    offGrid:
      x.deviation > OFF_GRID_WARNING_MM ||
      y.deviation > OFF_GRID_WARNING_MM ||
      z.deviation > OFF_GRID_WARNING_MM,
  };
}
