/**
 * Pipeline context factory.
 *
 * Derives BinDimensions from BinParams and creates the initial
 * PipelineContext that flows through all pipeline stages.
 */

import type { BinParams } from '@/shared/types/bin';
import { GRIDFINITY } from '@/shared/constants/bin';
import { SIZE, CLEARANCE, SOCKET_HEIGHT, LIP_SMALL_TAPER } from '../generatorConstants';
import type { ProgressFn } from '../meshUtils';
import type { BinDimensions, PipelineContext } from './types';

/** Derive all dimensions from bin parameters. */
function deriveDimensions(params: BinParams, forExport: boolean): BinDimensions {
  const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;
  const isFlat = params.base.style === 'flat';
  const halfSockets = params.base.halfSockets && !isFlat;
  const solid = params.base.solid;
  const wallHeight = isFlat ? totalHeight : totalHeight - SOCKET_HEIGHT;

  const outerW = params.width * SIZE - CLEARANCE;
  const outerD = params.depth * SIZE - CLEARANCE;
  const innerW = outerW - 2 * params.wallThickness;
  const innerD = outerD - 2 * params.wallThickness;
  const isSlotted = params.style === 'slotted';

  const withMagnet =
    !isFlat && (params.base.style === 'magnet' || params.base.style === 'magnet_and_screw');
  const withScrew =
    !isFlat && (params.base.style === 'screw' || params.base.style === 'magnet_and_screw');

  const maxDimension = Math.max(params.width, params.depth) * SIZE;
  const isSmallBin = maxDimension <= 200;
  const useHighQuality = forExport || isSmallBin || params.base.stackingLip;

  const hasLip = params.base.stackingLip;
  const interiorHeight = hasLip ? wallHeight - LIP_SMALL_TAPER : wallHeight;

  // Shell cache key — must match the original binGenerator computation exactly
  const shellKey = [
    params.width,
    params.depth,
    isFlat,
    halfSockets,
    withMagnet,
    withScrew,
    params.base.magnetDiameter,
    params.base.magnetDepth,
    params.base.screwDiameter,
    useHighQuality,
    wallHeight,
    params.wallThickness,
    params.base.stackingLip,
    solid,
  ].join('|');

  return {
    outerW,
    outerD,
    innerW,
    innerD,
    wallHeight,
    totalHeight,
    isFlat,
    halfSockets,
    solid,
    isSlotted,
    hasLip,
    interiorHeight,
    useHighQuality,
    maxDimension,
    shellKey,
    withMagnet,
    withScrew,
  };
}

/** Create the initial pipeline context from bin parameters. */
export function createInitialContext(
  params: BinParams,
  onProgress?: ProgressFn,
  forExport = false,
  signal?: AbortSignal
): PipelineContext {
  return {
    params,
    dimensions: deriveDimensions(params, forExport),
    forExport,
    signal,
    onProgress,
    solid: null,
    originToTag: new Map<number, number>(),
    fuseTargets: [],
    cutTargets: [],
    mesh: null,
  };
}
