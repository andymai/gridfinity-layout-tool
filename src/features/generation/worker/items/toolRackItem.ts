/** Tool rack generator module. */
import { isItemKind } from '@/shared/types/item';
import { exportToolRack, generateToolRack } from '../generators/toolRackGenerator';
import type { ItemGeneratorModule } from './generatorRegistry';

export const toolRackGeneratorModule: ItemGeneratorModule = {
  kind: 'toolRack',
  generate: (item, onProgress, isExport, signal) => {
    if (!isItemKind(item, 'toolRack')) {
      throw new Error('toolRack generator received a non-toolRack item');
    }
    return generateToolRack(item.structure, item.envelope, onProgress, isExport, signal);
  },
  export: async (item, format, tolerance, angularTolerance) => {
    if (!isItemKind(item, 'toolRack')) {
      throw new Error('toolRack export received a non-toolRack item');
    }
    return exportToolRack(item.structure, item.envelope, format, tolerance, angularTolerance);
  },
};
