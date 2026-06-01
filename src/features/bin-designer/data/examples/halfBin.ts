import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { PALETTE, coloredFeatures } from './palette';

export const HALF_BIN_EXAMPLES: ExampleDesign[] = [
  {
    id: 'half-bin-0_5x2-strip',
    nameKey: 'binExamples.halfBin05x2Strip.name',
    descriptionKey: 'binExamples.halfBin05x2Strip.description',
    techniques: ['halfBin'],
    tier: 'showcase',
    popular: true,
    tags: ['half-bin', 'strip', '0.5x2'],
    complexity: 1,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 0.5,
      depth: 2,
      height: 3,
      featureColors: coloredFeatures({ body: PALETTE.coral }),
    },
    metrics: { width: 0.5, depth: 2, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
