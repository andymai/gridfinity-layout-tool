/**
 * Bin generator module — routes the item-type system through the unchanged
 * `generateBin`/`exportBin` via the flat-`BinParams` adapter, so a bin built
 * via `GENERATE_ITEM` is byte-identical to one built via `GENERATE`.
 */
import { itemToBinParams } from '@/shared/types/itemAdapter';
import { generateBin, exportBin } from '../generators/binGenerator';
import type { ItemGeneratorModule } from './generatorRegistry';

export const binGeneratorModule: ItemGeneratorModule = {
  kind: 'bin',
  generate: (item, onProgress, isExport, signal) =>
    generateBin(itemToBinParams(item), onProgress, isExport, signal),
  export: async (item, format) => {
    const result = await exportBin(itemToBinParams(item), format);
    return { data: result.data, fileName: result.fileName };
  },
};
