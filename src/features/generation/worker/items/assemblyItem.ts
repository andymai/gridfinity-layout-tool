/** Workshop assembly generator module. */
import { isItemKind } from '@/shared/types/item';
import { exportAssembly, generateAssembly } from '../generators/assemblyGenerator';
import type { ItemGeneratorModule } from './generatorRegistry';

export const assemblyGeneratorModule: ItemGeneratorModule = {
  kind: 'assembly',
  generate: (item, onProgress, isExport, signal) => {
    if (!isItemKind(item, 'assembly')) {
      throw new Error('assembly generator received a non-assembly item');
    }
    return generateAssembly(item.structure, item.envelope, onProgress, isExport, signal);
  },
  export: async (item, format, tolerance, angularTolerance) => {
    if (!isItemKind(item, 'assembly')) {
      throw new Error('assembly export received a non-assembly item');
    }
    return exportAssembly(item.structure, item.envelope, format, tolerance, angularTolerance);
  },
};
