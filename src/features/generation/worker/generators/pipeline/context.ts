/**
 * Pipeline context factory.
 *
 * Derives BinDimensions from BinParams and creates the initial
 * PipelineContext that flows through all pipeline stages.
 */

import type { BinParams } from '@/shared/types/bin';
import { GRIDFINITY } from '@/shared/constants/bin';
import { hashMask, isPartialMask } from '@/shared/utils/cellMask';
import { SIZE, CLEARANCE, SOCKET_HEIGHT, LIP_SMALL_TAPER } from '../generatorConstants';
// SIZE is kept as a fallback default for backwards compatibility with callers
// that construct BinParams without gridUnitMm.
import type { ProgressFn } from '../meshUtils';
import { buildCacheKey, quantize, compactKey } from '../cacheKeyUtils';
import type { BinDimensions, PipelineContext } from './types';

/** Derive all dimensions from bin parameters. */
function deriveDimensions(params: BinParams, _forExport: boolean): BinDimensions {
  const totalHeight = params.height * GRIDFINITY.HEIGHT_UNIT;
  const isFlat = params.base.style === 'flat';
  // User flag only. When the mask has mixed half-bin detail, the socket
  // builder does a per-cell dispatch using the mask — it splits only
  // those 1u cells that straddle a half-bin boundary into quarter
  // sockets, leaving uniform 1u cells as one full socket. This avoids
  // decomposing every cell unnecessarily.
  const halfSockets = params.base.halfSockets && !isFlat;
  const solid = params.base.solid;
  const wallHeight = isFlat ? totalHeight : totalHeight - SOCKET_HEIGHT;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive fallback for backwards compatibility
  const gridUnit = params.gridUnitMm ?? SIZE;
  const outerW = params.width * gridUnit - CLEARANCE;
  const outerD = params.depth * gridUnit - CLEARANCE;
  const innerW = outerW - 2 * params.wallThickness;
  const innerD = outerD - 2 * params.wallThickness;
  const isSlotted = params.style === 'slotted';

  const withMagnet =
    !isFlat && (params.base.style === 'magnet' || params.base.style === 'magnet_and_screw');
  const withScrew =
    !isFlat && (params.base.style === 'screw' || params.base.style === 'magnet_and_screw');

  const maxDimension = Math.max(params.width, params.depth) * gridUnit;

  const hasLip = params.base.stackingLip;
  // Safety: LIP_OVERLAP (0.1mm) < LIP_SMALL_TAPER (0.7mm) so interiorHeight
  // already clears the actual lip base at wallHeight - LIP_OVERLAP.
  const interiorHeight = hasLip ? wallHeight - LIP_SMALL_TAPER : wallHeight;

  // Shell cache key — versioned + quantized for deterministic matching.
  // Mask hash is included only when the mask triggers the polygon path so
  // rectangular bins continue to share the existing cache bucket.
  const { cellMask } = params;
  const maskKeySegment = isPartialMask(cellMask) ? hashMask(cellMask) : 'rect';
  const shellKey = compactKey(
    buildCacheKey(
      'v5',
      quantize(params.width),
      quantize(params.depth),
      quantize(gridUnit),
      isFlat,
      halfSockets,
      withMagnet,
      withScrew,
      quantize(params.base.magnetDiameter),
      quantize(params.base.magnetDepth),
      quantize(params.base.screwDiameter),
      quantize(wallHeight),
      quantize(params.wallThickness),
      params.base.stackingLip,
      solid,
      maskKeySegment
    )
  );

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
    patternCutTargets: [],
    mesh: null,
    coarseMesh: null,
  };
}
