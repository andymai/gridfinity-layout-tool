import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { PALETTE, coloredFeatures } from './palette';

export const LID_EXAMPLES: ExampleDesign[] = [
  {
    id: 'lid-2x2',
    nameKey: 'binExamples.lid2x2.name',
    descriptionKey: 'binExamples.lid2x2.description',
    techniques: ['lid'],
    tier: 'technique',
    tags: ['lid', 'enclosed', '2x2'],
    complexity: 1,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 4,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
      featureColors: coloredFeatures({ lid: PALETTE.amber }),
    },
    metrics: { width: 2, depth: 2, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
