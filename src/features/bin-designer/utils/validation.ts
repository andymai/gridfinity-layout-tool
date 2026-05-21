/**
 * Bin parameter validation utilities.
 *
 * Validates all BinParams fields against Gridfinity constraints.
 */

import type { Result } from '@/core/result';
import { ok, err } from '@/core/result';
import type { BinParams } from '../types';
import { DESIGNER_CONSTRAINTS, GRIDFINITY, WALL_THICKNESS_OPTIONS } from '../constants';
import { binDimensions } from './binDimensions';

/** Tolerance for floating-point step comparisons */
const EPSILON = 1e-10;

/** Check if a value is a valid multiple of step, accounting for float precision */
function isValidStep(value: number, step: number): boolean {
  const remainder = Math.abs(value % step);
  return remainder < EPSILON || Math.abs(remainder - step) < EPSILON;
}

/** Check if a value matches one of the allowed wall thickness options */
function isValidThickness(value: number): boolean {
  return WALL_THICKNESS_OPTIONS.some((opt) => Math.abs(opt - value) < EPSILON);
}

/** Designer-specific validation error */
export interface DesignerValidationError {
  readonly code: string;
  readonly message: string;
  readonly field?: string;
}

/**
 * Validates all bin parameters against constraints.
 * Returns the params if valid, or an error describing the first violation.
 */
export function validateBinParams(params: BinParams): Result<BinParams, DesignerValidationError> {
  const { MIN_DIMENSION, MAX_DIMENSION, MIN_HEIGHT, MAX_HEIGHT } = DESIGNER_CONSTRAINTS;

  // Dimension range checks
  if (params.width < MIN_DIMENSION || params.width > MAX_DIMENSION) {
    return err({
      code: 'DIMENSION_OUT_OF_RANGE',
      message: `Width must be between ${MIN_DIMENSION} and ${MAX_DIMENSION} units`,
      field: 'width',
    });
  }
  if (params.depth < MIN_DIMENSION || params.depth > MAX_DIMENSION) {
    return err({
      code: 'DIMENSION_OUT_OF_RANGE',
      message: `Depth must be between ${MIN_DIMENSION} and ${MAX_DIMENSION} units`,
      field: 'depth',
    });
  }
  if (params.height < MIN_HEIGHT || params.height > MAX_HEIGHT) {
    return err({
      code: 'DIMENSION_OUT_OF_RANGE',
      message: `Height must be between ${MIN_HEIGHT} and ${MAX_HEIGHT} units`,
      field: 'height',
    });
  }

  // At least one dimension must be ≥ 1 unit (0.5×0.5 produces degenerate socket geometry)
  if (params.width < 1 && params.depth < 1) {
    return err({
      code: 'FOOTPRINT_TOO_SMALL',
      message: 'At least one dimension (width or depth) must be 1 unit or larger',
      field: 'width',
    });
  }

  // Dimension step check (0.5 increments for width/depth, tolerance-based for float safety)
  if (!isValidStep(params.width, DESIGNER_CONSTRAINTS.DIMENSION_STEP)) {
    return err({
      code: 'INVALID_STEP',
      message: `Width must be in ${DESIGNER_CONSTRAINTS.DIMENSION_STEP} unit increments`,
      field: 'width',
    });
  }
  if (!isValidStep(params.depth, DESIGNER_CONSTRAINTS.DIMENSION_STEP)) {
    return err({
      code: 'INVALID_STEP',
      message: `Depth must be in ${DESIGNER_CONSTRAINTS.DIMENSION_STEP} unit increments`,
      field: 'depth',
    });
  }

  // Height must be integer
  if (!Number.isInteger(params.height)) {
    return err({
      code: 'INVALID_STEP',
      message: 'Height must be a whole number',
      field: 'height',
    });
  }

  // Wall thickness check (must be a nozzle-size multiple)
  if (!isValidThickness(params.wallThickness)) {
    return err({
      code: 'WALL_THICKNESS_OUT_OF_RANGE',
      message: `Wall thickness must be one of: ${WALL_THICKNESS_OPTIONS.join(', ')}mm`,
      field: 'wallThickness',
    });
  }

  // Magnet dimension checks (only when magnet is enabled)
  if (params.base.style === 'magnet' || params.base.style === 'magnet_and_screw') {
    if (
      params.base.magnetDiameter < DESIGNER_CONSTRAINTS.MIN_MAGNET_DIAMETER ||
      params.base.magnetDiameter > DESIGNER_CONSTRAINTS.MAX_MAGNET_DIAMETER
    ) {
      return err({
        code: 'MAGNET_DIAMETER_OUT_OF_RANGE',
        message: `Magnet diameter must be between ${DESIGNER_CONSTRAINTS.MIN_MAGNET_DIAMETER}mm and ${DESIGNER_CONSTRAINTS.MAX_MAGNET_DIAMETER}mm`,
        field: 'base.magnetDiameter',
      });
    }
    if (
      params.base.magnetDepth < DESIGNER_CONSTRAINTS.MIN_MAGNET_HEIGHT ||
      params.base.magnetDepth > DESIGNER_CONSTRAINTS.MAX_MAGNET_HEIGHT
    ) {
      return err({
        code: 'MAGNET_HEIGHT_OUT_OF_RANGE',
        message: `Magnet height must be between ${DESIGNER_CONSTRAINTS.MIN_MAGNET_HEIGHT}mm and ${DESIGNER_CONSTRAINTS.MAX_MAGNET_HEIGHT}mm`,
        field: 'base.magnetDepth',
      });
    }
  }

  // Screw dimension check (only when screw is enabled)
  if (params.base.style === 'screw' || params.base.style === 'magnet_and_screw') {
    if (
      params.base.screwDiameter < DESIGNER_CONSTRAINTS.MIN_SCREW_DIAMETER ||
      params.base.screwDiameter > DESIGNER_CONSTRAINTS.MAX_SCREW_DIAMETER
    ) {
      return err({
        code: 'SCREW_DIAMETER_OUT_OF_RANGE',
        message: `Screw diameter must be between ${DESIGNER_CONSTRAINTS.MIN_SCREW_DIAMETER}mm and ${DESIGNER_CONSTRAINTS.MAX_SCREW_DIAMETER}mm`,
        field: 'base.screwDiameter',
      });
    }
  }

  // Compartment grid checks
  if (
    params.compartments.cols < DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID ||
    params.compartments.cols > DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID
  ) {
    return err({
      code: 'COMPARTMENT_GRID_OUT_OF_RANGE',
      message: `Columns must be between ${DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID} and ${DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID}`,
      field: 'compartments.cols',
    });
  }
  if (
    params.compartments.rows < DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID ||
    params.compartments.rows > DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID
  ) {
    return err({
      code: 'COMPARTMENT_GRID_OUT_OF_RANGE',
      message: `Rows must be between ${DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID} and ${DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID}`,
      field: 'compartments.rows',
    });
  }
  if (!isValidThickness(params.compartments.thickness)) {
    return err({
      code: 'COMPARTMENT_THICKNESS_OUT_OF_RANGE',
      message: `Divider thickness must be one of: ${WALL_THICKNESS_OPTIONS.join(', ')}mm`,
      field: 'compartments.thickness',
    });
  }
  if (params.compartments.cells.length !== params.compartments.cols * params.compartments.rows) {
    return err({
      code: 'COMPARTMENT_CELLS_MISMATCH',
      message: 'Compartment cells array length must equal cols × rows',
      field: 'compartments.cells',
    });
  }

  // Label tab validation
  if (params.label.enabled) {
    /* eslint-disable @typescript-eslint/no-unnecessary-condition -- runtime guard for external data */
    if (
      params.label.support !== 'bracket' &&
      params.label.support !== 'solid' &&
      params.label.support !== 'fillet'
    ) {
      /* eslint-enable @typescript-eslint/no-unnecessary-condition */
      return err({
        code: 'LABEL_TAB_SUPPORT_INVALID',
        message: 'Label tab support must be "bracket", "solid", or "fillet"',
        field: 'label.support',
      });
    }
    if (
      params.label.depth < DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_DEPTH ||
      params.label.depth > DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_DEPTH
    ) {
      return err({
        code: 'LABEL_TAB_DEPTH_OUT_OF_RANGE',
        message: `Label tab depth must be between ${DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_DEPTH}mm and ${DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_DEPTH}mm`,
        field: 'label.depth',
      });
    }
    if (
      params.label.width < DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_WIDTH ||
      params.label.width > DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_WIDTH
    ) {
      return err({
        code: 'LABEL_TAB_WIDTH_OUT_OF_RANGE',
        message: `Label tab width must be between ${DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_WIDTH}% and ${DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_WIDTH}%`,
        field: 'label.width',
      });
    }
    if (
      params.label.alignment !== 'left' &&
      params.label.alignment !== 'center' &&
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime guard for external data
      params.label.alignment !== 'right'
    ) {
      return err({
        code: 'LABEL_ALIGNMENT_INVALID',
        message: 'Label alignment must be "left", "center", or "right"',
        field: 'label.alignment',
      });
    }
  }

  // Compartment size validation (ensures grid cells aren't impossibly thin)
  if (params.compartments.cols > 1 || params.compartments.rows > 1) {
    const { innerW: innerWidth, innerD: innerDepth } = binDimensions(params);

    if (params.compartments.cols > 1) {
      const maxDividers = params.compartments.cols - 1;
      const totalDividerWidth = maxDividers * params.compartments.thickness;
      const cellWidth = (innerWidth - totalDividerWidth) / params.compartments.cols;
      if (cellWidth < DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE) {
        return err({
          code: 'COMPARTMENT_TOO_SMALL',
          message: `Too many columns: cells would be ${cellWidth.toFixed(1)}mm wide (min ${DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE}mm)`,
          field: 'compartments.cols',
        });
      }
    }
    if (params.compartments.rows > 1) {
      const maxDividers = params.compartments.rows - 1;
      const totalDividerDepth = maxDividers * params.compartments.thickness;
      const cellDepth = (innerDepth - totalDividerDepth) / params.compartments.rows;
      if (cellDepth < DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE) {
        return err({
          code: 'COMPARTMENT_TOO_SMALL',
          message: `Too many rows: cells would be ${cellDepth.toFixed(1)}mm deep (min ${DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE}mm)`,
          field: 'compartments.rows',
        });
      }
    }
  }

  return ok(params);
}

/** Result of computing minimum cell dimensions (in mm) */
export interface MinCellSize {
  readonly minCellW: number;
  readonly minCellD: number;
}

/**
 * Computes the minimum individual cell dimensions (mm) for a compartment grid,
 * accounting for inner bin dimensions and divider thickness.
 *
 * Used to determine if a grid configuration would produce degenerate geometry.
 */
export function computeMinCellSize(
  width: number,
  depth: number,
  wallThickness: number,
  cols: number,
  rows: number,
  dividerThickness: number,
  gridUnitMm: number = GRIDFINITY.GRID_SIZE
): MinCellSize {
  const innerW = width * gridUnitMm - GRIDFINITY.TOLERANCE - 2 * wallThickness;
  const innerD = depth * gridUnitMm - GRIDFINITY.TOLERANCE - 2 * wallThickness;

  const dividersW = cols > 1 ? (cols - 1) * dividerThickness : 0;
  const dividersD = rows > 1 ? (rows - 1) * dividerThickness : 0;

  const minCellW = (innerW - dividersW) / cols;
  const minCellD = (innerD - dividersD) / rows;

  return { minCellW, minCellD };
}

/**
 * Validates that compartment cell dimensions are large enough for viable geometry.
 * Returns ok(undefined) if valid, or an error describing the constraint violation.
 *
 * Used as a guard before split/grid/thickness operations and before mesh generation.
 */
export function validateCompartmentSizes(
  width: number,
  depth: number,
  wallThickness: number,
  cols: number,
  rows: number,
  dividerThickness: number,
  gridUnitMm: number = GRIDFINITY.GRID_SIZE
): Result<undefined, DesignerValidationError> {
  if (cols < 1 || rows < 1) {
    return err({
      code: 'COMPARTMENT_GRID_INVALID',
      message: 'Compartment grid must have at least 1 column and 1 row.',
      field: cols < 1 ? 'compartments.cols' : 'compartments.rows',
    });
  }
  if (cols <= 1 && rows <= 1) return ok(undefined);

  const { minCellW, minCellD } = computeMinCellSize(
    width,
    depth,
    wallThickness,
    cols,
    rows,
    dividerThickness,
    gridUnitMm
  );

  if (cols > 1 && minCellW < DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE) {
    return err({
      code: 'COMPARTMENT_TOO_SMALL',
      message: `Compartment cells too small (${minCellW.toFixed(1)}mm wide, min ${DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE}mm). Reduce grid size or increase bin dimensions.`,
      field: 'compartments.cols',
    });
  }

  if (rows > 1 && minCellD < DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE) {
    return err({
      code: 'COMPARTMENT_TOO_SMALL',
      message: `Compartment cells too small (${minCellD.toFixed(1)}mm deep, min ${DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE}mm). Reduce grid size or increase bin dimensions.`,
      field: 'compartments.rows',
    });
  }

  return ok(undefined);
}
