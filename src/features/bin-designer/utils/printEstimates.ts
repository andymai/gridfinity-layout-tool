/**
 * Print estimate calculations for the bin designer.
 *
 * Analytically computes material volume from bin parameters,
 * then derives filament usage and print time estimates.
 *
 * Volume is computed as: outer shell + dividers + gussets (minus cavity).
 * This avoids expensive mesh-based volume integration.
 */

import type { BinParams } from '@/features/bin-designer/types';
import { GRIDFINITY, STYLE_WALL_THICKNESS } from '@/features/bin-designer/constants/gridfinity';
import { getStyleConstraints } from '@/features/bin-designer/utils/styleConstraints';

// ─── Material Constants ──────────────────────────────────────────────────────

/** PLA density in g/cm³ */
const PLA_DENSITY = 1.24;

/** 1.75mm filament cross-section area in mm² */
const FILAMENT_AREA_MM2 = Math.PI * (1.75 / 2) ** 2;

/** Default cost per kg of filament (USD) */
const DEFAULT_COST_PER_KG = 25;

/** Print speed constants (calibrated for 0.4mm nozzle, 0.2mm layer, 15% infill) */
const OVERHEAD_MINUTES = 16; // Bed heat, first layer
const MINUTES_PER_METER = 3.6; // Extrusion + travel

// ─── Result Type ─────────────────────────────────────────────────────────────

export interface PrintEstimate {
  /** Estimated material volume in mm³ */
  readonly volumeMm3: number;
  /** Estimated filament mass in grams */
  readonly gramsFilament: number;
  /** Estimated filament length in meters */
  readonly metersFilament: number;
  /** Estimated print time in minutes */
  readonly printTimeMinutes: number;
  /** Estimated cost in USD */
  readonly costUSD: number;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Computes print estimates from bin parameters.
 *
 * @param params - Complete bin parameter set
 * @param costPerKg - Filament cost in USD/kg (default $25)
 * @returns Print estimates including volume, mass, filament length, time, and cost
 */
export function estimatePrint(
  params: BinParams,
  costPerKg: number = DEFAULT_COST_PER_KG
): PrintEstimate {
  const volumeMm3 = computeBinVolume(params);
  const volumeCm3 = volumeMm3 / 1000; // mm³ → cm³
  const gramsFilament = volumeCm3 * PLA_DENSITY;
  const metersFilament = volumeMm3 / FILAMENT_AREA_MM2 / 1000; // mm³ → mm length → m
  const printTimeMinutes = OVERHEAD_MINUTES + metersFilament * MINUTES_PER_METER;
  const costUSD = (gramsFilament / 1000) * costPerKg; // g → kg × $/kg

  return {
    volumeMm3: Math.round(volumeMm3),
    gramsFilament: Math.round(gramsFilament * 10) / 10,
    metersFilament: Math.round(metersFilament * 100) / 100,
    printTimeMinutes: Math.round(printTimeMinutes),
    costUSD: Math.round(costUSD * 100) / 100,
  };
}

/**
 * Formats print time as human-readable string.
 */
export function formatPrintTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Formats filament length for display.
 */
export function formatFilament(meters: number): string {
  if (meters < 1) return `${Math.round(meters * 100)}cm`;
  return `${meters.toFixed(1)}m`;
}

// ─── Volume Calculation ──────────────────────────────────────────────────────

/**
 * Computes total material volume analytically from bin parameters.
 *
 * Components:
 * 1. Outer shell (walls + bottom)
 * 2. Divider walls
 * 3. Corner gussets (solid/rugged styles)
 *
 * Scoops and label tabs are small relative to the bin volume
 * and are included as minor additions rather than subtractions.
 */
function computeBinVolume(params: BinParams): number {
  const wallThickness = STYLE_WALL_THICKNESS[params.style] ?? GRIDFINITY.WALL_THICKNESS;
  const constraints = getStyleConstraints(params.style);

  // Outer dimensions in mm
  const outerW = params.width * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  const outerD = params.depth * GRIDFINITY.GRID_SIZE - GRIDFINITY.TOLERANCE;
  // Height units INCLUDE the base (first unit = base, no cavity)
  const totalH = params.height * GRIDFINITY.HEIGHT_UNIT;

  // Base height (7mm dead space: profile + bridge + floor, no cavity here)
  const bottomH = GRIDFINITY.BASE_HEIGHT;

  // For vase mode: thin outer shell only
  if (params.style === 'vase') {
    return computeHollowBoxVolume(outerW, outerD, totalH, wallThickness, bottomH);
  }

  let volume = 0;

  // Shell volume (outer walls + bottom), accounting for wall cutouts
  const hasWallCutouts = !constraints.disabledFeatures.includes('walls') &&
    (params.walls.front > 0 || params.walls.back > 0 || params.walls.left > 0 || params.walls.right > 0);

  if (hasWallCutouts) {
    volume += computeWallCutoutVolume(outerW, outerD, totalH, wallThickness, bottomH, params.walls);
  } else {
    volume += computeHollowBoxVolume(outerW, outerD, totalH, wallThickness, bottomH);
  }

  // Divider volumes
  if (!constraints.disabledFeatures.includes('dividers')) {
    volume += computeDividerVolume(params, outerW, outerD, totalH, wallThickness, bottomH);
  }

  // Corner gussets
  if (constraints.hasGussets) {
    const gussetSize = wallThickness * 2;
    const gussetHeight = totalH - bottomH;
    // 4 triangular prisms: volume = 0.5 * size * size * height each
    volume += 4 * 0.5 * gussetSize * gussetSize * gussetHeight;
  }

  return volume;
}

/**
 * Volume of a hollow box (outer - inner cavity).
 */
function computeHollowBoxVolume(
  w: number, d: number, h: number,
  wall: number, bottomH: number
): number {
  const outerVol = w * d * h;
  const innerW = w - 2 * wall;
  const innerD = d - 2 * wall;
  const innerH = h - bottomH;

  if (innerW <= 0 || innerD <= 0 || innerH <= 0) {
    return outerVol; // Solid block (walls too thick)
  }

  return outerVol - innerW * innerD * innerH;
}

/**
 * Volume of a bin shell with per-wall height reductions (cutouts).
 *
 * Each wall is independently reduced in height based on its cutout percentage.
 * Front/back walls span the full outer width; left/right span the inner depth
 * (avoiding corner overlap, matching the geometry generator).
 */
function computeWallCutoutVolume(
  outerW: number, outerD: number, totalH: number,
  wall: number, bottomH: number,
  cutouts: { front: number; back: number; left: number; right: number }
): number {
  const innerD = outerD - 2 * wall;
  const fullWallH = totalH - bottomH;

  if (fullWallH <= 0 || innerD <= 0) {
    // Solid block (walls too thick or no cavity height)
    return outerW * outerD * totalH;
  }

  // Bottom plate (always full)
  let volume = outerW * outerD * bottomH;

  // Front wall: spans full outer width
  const frontH = fullWallH * (1 - cutouts.front / 100);
  if (frontH > 0) volume += outerW * wall * frontH;

  // Back wall: spans full outer width
  const backH = fullWallH * (1 - cutouts.back / 100);
  if (backH > 0) volume += outerW * wall * backH;

  // Left wall: spans inner depth (between front/back walls)
  const leftH = fullWallH * (1 - cutouts.left / 100);
  if (leftH > 0) volume += innerD * wall * leftH;

  // Right wall: spans inner depth
  const rightH = fullWallH * (1 - cutouts.right / 100);
  if (rightH > 0) volume += innerD * wall * rightH;

  return volume;
}

/**
 * Volume of all divider walls inside the cavity.
 */
function computeDividerVolume(
  params: BinParams,
  outerW: number, outerD: number, totalH: number,
  wallThickness: number, bottomH: number
): number {
  const innerW = outerW - 2 * wallThickness;
  const innerD = outerD - 2 * wallThickness;
  const dividerH = totalH - bottomH;
  const { x: divX, y: divY, thickness } = params.dividers;

  let volume = 0;

  // Y dividers (walls parallel to Y axis, splitting width)
  if (divX > 0) {
    volume += divX * thickness * innerD * dividerH;
  }

  // X dividers (walls parallel to X axis, splitting depth)
  if (divY > 0) {
    volume += divY * thickness * innerW * dividerH;
  }

  // Subtract double-counted intersections where X and Y dividers cross
  if (divX > 0 && divY > 0) {
    volume -= divX * divY * thickness * thickness * dividerH;
  }

  return volume;
}
