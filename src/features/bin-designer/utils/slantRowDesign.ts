import type { DesignId } from '@/core/types';
import { isOk } from '@/core/result';
import { CONSTRAINTS, isFractional } from '@/core/constants';
import { normalizeSlant } from '@/shared/utils/slantPlan';
import type { SlantRowDesignSpec } from '@/shared/utils/slantRowDesign';
import { DEFAULT_BIN_PARAMS } from '../constants/defaults';
import { saveDesign } from '../storage';
import {
  loadRegistry,
  registryEdgeFields,
  registryHeightFields,
  registryKnifeRestFields,
  registryOverhangFields,
  registrySlantFields,
  upsertRegistryEntry,
  type CustomBinRef,
} from '../store/customBinRegistry';

const EPS = 1e-6;

/** A saved parametric bin of the row's size and height that leans the row's way. */
function fitsRow(ref: CustomBinRef, spec: SlantRowDesignSpec): boolean {
  if (ref.kind !== undefined && ref.kind !== 'bin') return false;
  const config = ref.slant?.config;
  const edgeMatches = (size: number, ours: string | undefined, wanted: string): boolean =>
    !isFractional(size) || (ours ?? 'end') === wanted;
  const gridX = ref.slant?.gridUnitMm ?? CONSTRAINTS.GRID_UNIT_MM_DEFAULT;
  const sameUnits =
    Math.abs(gridX - spec.gridUnitMm) < EPS &&
    Math.abs((ref.slant?.gridUnitMmY ?? gridX) - (spec.gridUnitMmY ?? spec.gridUnitMm)) < EPS &&
    Math.abs((ref.slant?.heightUnitMm ?? CONSTRAINTS.HEIGHT_UNIT_MM_DEFAULT) - spec.heightUnitMm) <
      EPS;
  return (
    Math.abs(ref.width - spec.width) < EPS &&
    Math.abs(ref.depth - spec.depth) < EPS &&
    Math.abs(ref.height - spec.height) < EPS &&
    config?.side === spec.slant.side &&
    Math.abs(config.angleDeg - spec.slant.angleDeg) < EPS &&
    config.endSupport !== true &&
    ref.slant?.blocked !== true &&
    (ref.slant?.extraWallMm ?? 0) === 0 &&
    // The row is planned as a socketed bin's support; a flat base reaches further.
    ref.socketless !== true &&
    sameUnits &&
    edgeMatches(spec.width, ref.fractionalEdgeX, spec.fractionalEdgeX) &&
    edgeMatches(spec.depth, ref.fractionalEdgeY, spec.fractionalEdgeY)
  );
}

/**
 * The design a slanted row's bins link to: one already saved that fits, or a
 * new plain bin leaning the row's way. Registered at once, since placing the
 * row reads its slant from the registry.
 */
export async function ensureSlantRowDesign(spec: SlantRowDesignSpec): Promise<DesignId | null> {
  const existing = loadRegistry().find((ref) => fitsRow(ref, spec));
  if (existing) return existing.id;

  const params = normalizeSlant({
    ...DEFAULT_BIN_PARAMS,
    width: spec.width,
    depth: spec.depth,
    height: spec.height,
    gridUnitMm: spec.gridUnitMm,
    ...(spec.gridUnitMmY !== undefined ? { gridUnitMmY: spec.gridUnitMmY } : {}),
    heightUnitMm: spec.heightUnitMm,
    fractionalEdgeX: spec.fractionalEdgeX,
    fractionalEdgeY: spec.fractionalEdgeY,
    slant: spec.slant,
  });
  const saved = await saveDesign({
    name: spec.name,
    params,
    thumbnail: null,
    exportFileNameConfig: null,
  });
  if (!isOk(saved)) return null;
  upsertRegistryEntry({
    id: saved.value.id,
    name: saved.value.name,
    width: params.width,
    depth: params.depth,
    height: params.height,
    ...registryEdgeFields(params),
    ...registryHeightFields(params),
    ...registryOverhangFields(params),
    ...registryKnifeRestFields(params),
    ...registrySlantFields(params),
    updatedAt: saved.value.updatedAt,
  });
  return saved.value.id;
}
