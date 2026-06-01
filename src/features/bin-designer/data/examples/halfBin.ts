import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';


export const HALF_BIN_EXAMPLES: ExampleDesign[] = [
  {
    id: 'half-bin-1_5x1_5',
    nameKey: 'binExamples.halfBin15x15.name',
    descriptionKey: 'binExamples.halfBin15x15.description',
    techniques: ['halfBin'],
    tier: 'technique',
    popular: true,
    tags: ['half-bin', 'fractional', '1.5x1.5'],
    complexity: 1,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 1.5,
      depth: 1.5,
      height: 3,
    },
    metrics: { width: 1.5, depth: 1.5, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'half-bin-0_5x2-strip',
    nameKey: 'binExamples.halfBin05x2Strip.name',
    descriptionKey: 'binExamples.halfBin05x2Strip.description',
    techniques: ['halfBin'],
    tier: 'technique',
    popular: false,
    tags: ['half-bin', 'strip', '0.5x2'],
    complexity: 1,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 0.5,
      depth: 2,
      height: 3,
    },
    metrics: { width: 0.5, depth: 2, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
