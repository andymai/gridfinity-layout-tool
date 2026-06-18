/**
 * Pure adapters between the flat `BinParams` (the canonical bin payload, still
 * used everywhere on the bin path) and the general `GridfinityItem` wire shape.
 *
 * `itemToBinParams(binParamsToItem(p))` is the identity for any `BinParams`
 * (asserted by itemAdapter.test). The adapter runs only at the worker/persistence
 * boundary, so nothing in the bin generator changes.
 */
import type { BaseConfig, BinParams } from '@/shared/types/bin';
import type {
  AttachmentConfig,
  BinStructure,
  GridfinityItem,
  ItemEnvelope,
} from '@/shared/types/item';

/** Project the baseplate-mating subset out of a bin's `BaseConfig`. */
export function attachmentFromBase(base: BaseConfig): AttachmentConfig {
  const hasMagnet = base.style === 'magnet' || base.style === 'magnet_and_screw';
  const hasScrew = base.style === 'screw' || base.style === 'magnet_and_screw';
  return {
    magnetHoles: hasMagnet,
    magnetDiameter: base.magnetDiameter,
    magnetDepth: base.magnetDepth,
    screwHoles: hasScrew,
    screwDiameter: base.screwDiameter,
  };
}

/** Flat `BinParams` -> `GridfinityItem`. Lossless. */
export function binParamsToItem(p: BinParams): GridfinityItem {
  const { width, depth, gridUnitMm, heightUnitMm, featureColors, ...rest } = p;
  const envelope: ItemEnvelope = {
    width,
    depth,
    gridUnitMm,
    heightUnitMm,
    featureColors,
    attachment: attachmentFromBase(p.base),
  };
  const structure: BinStructure = { kind: 'bin', ...rest };
  return { envelope, structure };
}

/** `GridfinityItem` (kind 'bin') -> flat `BinParams`. Throws on non-bin. */
export function itemToBinParams(item: GridfinityItem): BinParams {
  if (item.structure.kind !== 'bin') {
    throw new Error(`itemToBinParams: expected kind 'bin', got '${item.structure.kind}'`);
  }
  const { kind: _kind, ...binFields } = item.structure;
  const { width, depth, gridUnitMm, heightUnitMm, featureColors } = item.envelope;
  return {
    ...binFields,
    width,
    depth,
    gridUnitMm,
    heightUnitMm,
    featureColors,
  };
}
