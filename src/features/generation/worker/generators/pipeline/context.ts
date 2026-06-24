/**
 * Pipeline context factory.
 *
 * Derives BinDimensions from BinParams and creates the initial
 * PipelineContext that flows through all pipeline stages.
 */

import type { BinParams } from '@/shared/types/bin';
import { hashMask, isPartialMask } from '@/shared/utils/cellMask';
import {
  SIZE,
  HEIGHT_UNIT,
  CLEARANCE,
  SOCKET_HEIGHT,
  LIP_SMALL_TAPER,
} from '../generatorConstants';
import {
  buildCompartmentsCacheKey,
  compartmentCavitiesAreViable,
  compartmentCavitiesAreViableWithOverrides,
  compartmentCornersRoundCleanly,
  compartmentEdgesAreSinglePair,
  compartmentsAreRectangular,
  hasDividerOverrides,
  hasMultipleCompartments,
} from '../compartmentBuilder';
// SIZE and HEIGHT_UNIT are kept as fallback defaults for backwards compatibility
// with callers (or serialized designs) that predate gridUnitMm/heightUnitMm.
import type { ProgressFn } from '../meshUtils';
import { buildCacheKey, quantize, compactKey } from '../cacheKeyUtils';
import type { BinDimensions, PipelineContext } from './types';
import type { PerfCollector } from './perfCollector';
import { resolveOverhang, overhangKey, hasOverhang, overhangExpansion } from '../overhang';

/** Derive all dimensions from bin parameters. */
function deriveDimensions(params: BinParams, _forExport: boolean): BinDimensions {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- fallback for legacy BinParams without heightUnitMm
  const heightUnit = params.heightUnitMm ?? HEIGHT_UNIT;
  const totalHeight = params.height * heightUnit;
  const isFlat = params.base.style === 'flat';
  // User flag only. When the mask has mixed half-bin detail, the socket
  // builder does a per-cell dispatch using the mask — it splits only
  // those 1u cells that straddle a half-bin boundary into quarter
  // sockets, leaving uniform 1u cells as one full socket. This avoids
  // decomposing every cell unnecessarily.
  const halfSockets = params.base.halfSockets && !isFlat;
  const solid = params.base.solid;
  // Lightweight shells the socket region; a flat bin has no socket, so the
  // flag is inert there. migrateParams backfills the field on legacy designs.
  const lightweight = params.base.lightweight && !isFlat;
  const wallHeight = isFlat ? totalHeight : totalHeight - SOCKET_HEIGHT;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defensive fallback for backwards compatibility
  const gridUnit = params.gridUnitMm ?? SIZE;
  const outerW = params.width * gridUnit - CLEARANCE;
  const outerD = params.depth * gridUnit - CLEARANCE;

  // Resolve overhang before innerW/innerD so interior features (compartments,
  // scoops, label tabs, etc.) see the actual available space. The box shell
  // expands in lockstep with the overhang, so innerW/innerD must include the
  // per-side addW/addD expansion.
  // Overhang is suppressed for polygon masks (the mask defines its own footprint).
  const { cellMask } = params;
  const overhang = resolveOverhang(isPartialMask(cellMask) ? undefined : params.overhang);
  const ovhExp = hasOverhang(overhang) ? overhangExpansion(overhang) : null;

  const innerW = outerW + (ovhExp?.addW ?? 0) - 2 * params.wallThickness;
  const innerD = outerD + (ovhExp?.addD ?? 0) - 2 * params.wallThickness;
  const innerOffsetX = ovhExp?.offsetX ?? 0;
  const innerOffsetY = ovhExp?.offsetY ?? 0;
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

  // Bake compartment walls into the shell as a single multi-cavity cut when
  // the shape is amenable to that path: rectangular footprint (no polygon
  // mask), not solid mode, not slotted, the compartments are rectangles
  // (their cells fill their bounding box), and every per-compartment cavity
  // has viable post-inset dimensions. This avoids the fuse T-junction at
  // the cavity floor that BambuStudio flagged as non-manifold (#1753).
  //
  // TODO #1753: polygon-mask bins (L/T/U footprints) with compartments
  // still use the additive-fuse path and remain susceptible to the
  // T-junction non-manifold bug. See the skipped scenario in
  // `compartmentBuilder.scenario.manifold.test.ts` ("polygon-mask gap").
  const overridesAllowCutPath =
    !hasDividerOverrides(params) ||
    (compartmentEdgesAreSinglePair(params) &&
      compartmentCavitiesAreViableWithOverrides(params, innerW, innerD));
  // A partial divider height can't be expressed by the cut-based multi-cavity
  // shell (cut pockets reach the rim, so the leftover divider is always full
  // height). A numeric height below the full interior height therefore always
  // routes to the additive divider-wall path (short wall boxes from the floor).
  // A numeric value that clamps up to the full interior height is treated as
  // full so it keeps the faster cut-path. (Contrast tilt overrides, which only
  // fall back to the additive path for some layouts — see overridesAllowCutPath.)
  const { dividerHeight } = params.compartments;
  const dividerHeightIsFull =
    dividerHeight === undefined ||
    dividerHeight === 'auto' ||
    (typeof dividerHeight === 'number' && dividerHeight >= interiorHeight);
  const compartmentsBakedIntoShell =
    !isSlotted &&
    !solid &&
    !isPartialMask(params.cellMask) &&
    hasMultipleCompartments(params) &&
    compartmentsAreRectangular(params) &&
    compartmentCavitiesAreViable(params, innerW, innerD) &&
    compartmentCornersRoundCleanly(params, innerW, innerD) &&
    overridesAllowCutPath &&
    dividerHeightIsFull;

  // Shell cache key — versioned + quantized for deterministic matching.
  // Mask hash is included only when the mask triggers the polygon path so
  // rectangular bins continue to share the existing cache bucket. The
  // compartments segment is "none" unless the bin uses the multi-cavity
  // cut path, so single-compartment bins keep their existing cache bucket.
  const maskKeySegment = isPartialMask(cellMask) ? hashMask(cellMask) : 'rect';
  // Lightweight bins also depend on the compartment layout: the body floor
  // openings are clipped away from divider walls, so two lite bins differing
  // only in dividers must not share a cached body.
  const compartmentsKey =
    compartmentsBakedIntoShell || lightweight ? buildCompartmentsCacheKey(params) : 'none';

  const shellKey = compactKey(
    buildCacheKey(
      'v7',
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
      lightweight,
      maskKeySegment,
      compartmentsKey,
      overhangKey(overhang)
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
    lightweight,
    solid,
    isSlotted,
    hasLip,
    interiorHeight,
    maxDimension,
    shellKey,
    withMagnet,
    withScrew,
    compartmentsBakedIntoShell,
    overhang,
    innerOffsetX,
    innerOffsetY,
  };
}

/** Create the initial pipeline context from bin parameters. */
export function createInitialContext(
  params: BinParams,
  onProgress?: ProgressFn,
  forExport = false,
  signal?: AbortSignal,
  perfCollector?: PerfCollector
): PipelineContext {
  return {
    params,
    dimensions: deriveDimensions(params, forExport),
    forExport,
    signal,
    onProgress,
    solid: null,
    deferredSolid: null,
    deferredSolidKey: null,
    originToTag: new Map<number, number>(),
    fuseTargets: [],
    cutTargets: [],
    patternCutTargets: [],
    featuresKey: null,
    mesh: null,
    coarseMesh: null,
    perfCollector,
  };
}
