/**
 * Bin parameter validation utilities.
 *
 * Validates all BinParams fields against Gridfinity constraints.
 */

import type { Result } from '@/core/result';
import { ok, err } from '@/core/result';
import type { BinParams } from '../types';
import { DESIGNER_CONSTRAINTS } from '../constants';

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

  // Vase mode incompatibilities
  if (params.style === 'vase') {
    if (params.dividers.x > 0 || params.dividers.y > 0) {
      return err({
        code: 'VASE_INCOMPATIBLE',
        message: 'Vase mode does not support dividers',
        field: 'dividers',
      });
    }
    if (params.scoop) {
      return err({
        code: 'VASE_INCOMPATIBLE',
        message: 'Vase mode does not support scoops',
        field: 'scoop',
      });
    }
    if (params.label.enabled) {
      return err({
        code: 'VASE_INCOMPATIBLE',
        message: 'Vase mode does not support label embossing',
        field: 'label',
      });
    }
  }

  // Magnet depth range
  if (params.base.style === 'magnet') {
    if (
      params.base.magnetDepth < DESIGNER_CONSTRAINTS.MAGNET_MIN_DEPTH ||
      params.base.magnetDepth > DESIGNER_CONSTRAINTS.MAGNET_MAX_DEPTH
    ) {
      return err({
        code: 'MAGNET_DEPTH_OUT_OF_RANGE',
        message: `Magnet depth must be between ${DESIGNER_CONSTRAINTS.MAGNET_MIN_DEPTH}mm and ${DESIGNER_CONSTRAINTS.MAGNET_MAX_DEPTH}mm`,
        field: 'base.magnetDepth',
      });
    }
  }

  return ok(params);
}
