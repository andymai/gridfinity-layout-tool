/**
 * Bin — descriptor that registers today's bin as one item kind. The bin's real
 * validation/migration still lives in `migrateParams`; this descriptor adapts it
 * to the item-type contract (labels, defaults, kind-aware migrate) without
 * changing the bin path. Reconstructs a flat `BinParams` from envelope+structure,
 * runs the unchanged `migrateParams`, then re-splits.
 */
import { z } from 'zod';
import { DEFAULT_BIN_PARAMS, migrateParams } from '@/features/bin-designer/constants/defaults';
import type { ItemTypeDescriptor } from '@/shared/items/registry';
import type { BinStructure, ItemEnvelope } from '@/shared/types/item';
import { binParamsToItem } from '@/shared/types/itemAdapter';

const binStructureSchema = z.custom<BinStructure>(
  (value) =>
    typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'bin'
);

export const binDescriptor: ItemTypeDescriptor<BinStructure> = {
  kind: 'bin',
  schema: binStructureSchema,
  defaults: () => binParamsToItem(DEFAULT_BIN_PARAMS).structure as BinStructure,
  migrate: (raw: unknown, envelope: ItemEnvelope): BinStructure => {
    const flat = {
      ...(raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}),
      width: envelope.width,
      depth: envelope.depth,
      gridUnitMm: envelope.gridUnitMm,
      heightUnitMm: envelope.heightUnitMm,
      featureColors: envelope.featureColors,
    };
    return binParamsToItem(migrateParams(flat)).structure as BinStructure;
  },
  labelKey: 'binDesigner.itemKind.bin',
  descriptionKey: 'binDesigner.itemKind.bin.description',
  exportFileName: (envelope, structure) =>
    `bin_${envelope.width}x${envelope.depth}x${structure.height}`,
};
