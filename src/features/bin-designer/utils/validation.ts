/**
 * Bin parameter validation utilities.
 *
 * Validates all BinParams fields against Gridfinity constraints.
 */

import type { Result } from '@/core/result';
import { ok, err } from '@/core/result';
import type { BinParams } from '../types';
import { DESIGNER_CONSTRAINTS, GRIDFINITY } from '../constants';

/** Tolerance for floating-point step comparisons */
const EPSILON = 1e-10;

/** Check if a value is a valid multiple of step, accounting for float precision */
function isValidStep(value: number, step: number): boolean {
  const remainder = Math.abs(value % step);
  return remainder < EPSILON || Math.abs(remainder - step) < EPSILON;
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
export function validateBinParams(
  params: BinParams
): Result<BinParams, DesignerValidationError> {
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

  // Wall thickness check
  if (
    params.wallThickness < DESIGNER_CONSTRAINTS.MIN_WALL_THICKNESS ||
    params.wallThickness > DESIGNER_CONSTRAINTS.MAX_WALL_THICKNESS
  ) {
    return err({
      code: 'WALL_THICKNESS_OUT_OF_RANGE',
      message: `Wall thickness must be between ${DESIGNER_CONSTRAINTS.MIN_WALL_THICKNESS}mm and ${DESIGNER_CONSTRAINTS.MAX_WALL_THICKNESS}mm`,
      field: 'wallThickness',
    });
  }

  // Magnet dimension checks (only when magnet is enabled)
  if (params.base.style === 'magnet' || params.base.style === 'magnet_and_screw') {
    const magnetRadius = params.base.magnetDiameter / 2;
    if (
      magnetRadius < DESIGNER_CONSTRAINTS.MIN_MAGNET_RADIUS ||
      magnetRadius > DESIGNER_CONSTRAINTS.MAX_MAGNET_RADIUS
    ) {
      return err({
        code: 'MAGNET_RADIUS_OUT_OF_RANGE',
        message: `Magnet radius must be between ${DESIGNER_CONSTRAINTS.MIN_MAGNET_RADIUS}mm and ${DESIGNER_CONSTRAINTS.MAX_MAGNET_RADIUS}mm`,
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
    const screwRadius = params.base.screwDiameter / 2;
    if (
      screwRadius < DESIGNER_CONSTRAINTS.MIN_SCREW_RADIUS ||
      screwRadius > DESIGNER_CONSTRAINTS.MAX_SCREW_RADIUS
    ) {
      return err({
        code: 'SCREW_RADIUS_OUT_OF_RANGE',
        message: `Screw radius must be between ${DESIGNER_CONSTRAINTS.MIN_SCREW_RADIUS}mm and ${DESIGNER_CONSTRAINTS.MAX_SCREW_RADIUS}mm`,
        field: 'base.screwDiameter',
      });
    }
  }

  // Divider checks
  if (params.dividers.x < 0 || params.dividers.x > DESIGNER_CONSTRAINTS.MAX_DIVIDERS) {
    return err({
      code: 'DIVIDER_OUT_OF_RANGE',
      message: `X dividers must be between 0 and ${DESIGNER_CONSTRAINTS.MAX_DIVIDERS}`,
      field: 'dividers.x',
    });
  }
  if (params.dividers.y < 0 || params.dividers.y > DESIGNER_CONSTRAINTS.MAX_DIVIDERS) {
    return err({
      code: 'DIVIDER_OUT_OF_RANGE',
      message: `Y dividers must be between 0 and ${DESIGNER_CONSTRAINTS.MAX_DIVIDERS}`,
      field: 'dividers.y',
    });
  }
  if (
    params.dividers.thickness < DESIGNER_CONSTRAINTS.MIN_DIVIDER_THICKNESS ||
    params.dividers.thickness > DESIGNER_CONSTRAINTS.MAX_DIVIDER_THICKNESS
  ) {
    return err({
      code: 'DIVIDER_THICKNESS_OUT_OF_RANGE',
      message: `Divider thickness must be between ${DESIGNER_CONSTRAINTS.MIN_DIVIDER_THICKNESS}mm and ${DESIGNER_CONSTRAINTS.MAX_DIVIDER_THICKNESS}mm`,
      field: 'dividers.thickness',
    });
  }

  // Wall cutout checks (0 or 20-100%)
  const wallFields = ['front', 'back', 'left', 'right'] as const;
  for (const side of wallFields) {
    const value = params.walls[side];
    if (value < 0 || value > DESIGNER_CONSTRAINTS.MAX_WALL_CUTOUT) {
      return err({
        code: 'WALL_CUTOUT_OUT_OF_RANGE',
        message: `${side} wall cutout must be between 0 and ${DESIGNER_CONSTRAINTS.MAX_WALL_CUTOUT}%`,
        field: `walls.${side}`,
      });
    }
    if (value > 0 && value < DESIGNER_CONSTRAINTS.MIN_WALL_CUTOUT) {
      return err({
        code: 'WALL_CUTOUT_TOO_SMALL',
        message: `${side} wall cutout must be 0% or at least ${DESIGNER_CONSTRAINTS.MIN_WALL_CUTOUT}%`,
        field: `walls.${side}`,
      });
    }
  }

  // Label text length
  if (params.label.text.length > DESIGNER_CONSTRAINTS.MAX_LABEL_LENGTH) {
    return err({
      code: 'LABEL_TOO_LONG',
      message: `Label text must be at most ${DESIGNER_CONSTRAINTS.MAX_LABEL_LENGTH} characters`,
      field: 'label.text',
    });
  }

  // Scoop radius check (when not 'auto')
  if (params.scoop.enabled && typeof params.scoop.radius === 'number') {
    if (
      params.scoop.radius < DESIGNER_CONSTRAINTS.MIN_SCOOP_RADIUS ||
      params.scoop.radius > DESIGNER_CONSTRAINTS.MAX_SCOOP_RADIUS
    ) {
      return err({
        code: 'SCOOP_RADIUS_OUT_OF_RANGE',
        message: `Scoop radius must be between ${DESIGNER_CONSTRAINTS.MIN_SCOOP_RADIUS}mm and ${DESIGNER_CONSTRAINTS.MAX_SCOOP_RADIUS}mm`,
        field: 'scoop.radius',
      });
    }
  }

  // Compartment size validation (ensures dividers don't create impossibly thin sections)
  if (params.dividers.x > 0 || params.dividers.y > 0) {
    const innerWidth = params.width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE - 2 * params.wallThickness;
    const innerDepth = params.depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE - 2 * params.wallThickness;

    if (params.dividers.x > 0) {
      const totalDividerWidth = params.dividers.x * params.dividers.thickness;
      const compartmentWidth = (innerWidth - totalDividerWidth) / (params.dividers.x + 1);
      if (compartmentWidth < DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE) {
        return err({
          code: 'COMPARTMENT_TOO_SMALL',
          message: `Too many X dividers: compartments would be ${compartmentWidth.toFixed(1)}mm wide (min ${DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE}mm)`,
          field: 'dividers.x',
        });
      }
    }
    if (params.dividers.y > 0) {
      const totalDividerDepth = params.dividers.y * params.dividers.thickness;
      const compartmentDepth = (innerDepth - totalDividerDepth) / (params.dividers.y + 1);
      if (compartmentDepth < DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE) {
        return err({
          code: 'COMPARTMENT_TOO_SMALL',
          message: `Too many Y dividers: compartments would be ${compartmentDepth.toFixed(1)}mm deep (min ${DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_SIZE}mm)`,
          field: 'dividers.y',
        });
      }
    }
  }


  return ok(params);
}
