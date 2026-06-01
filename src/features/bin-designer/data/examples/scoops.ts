import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { PALETTE, coloredFeatures } from './palette';

export const SCOOP_EXAMPLES: ExampleDesign[] = [
  {
    id: 'scoop-2x3-ramp',
    nameKey: 'binExamples.scoop2x3Ramp.name',
    descriptionKey: 'binExamples.scoop2x3Ramp.description',
    techniques: ['scoop'],
    tier: 'technique',
    tags: ['scoop', 'hardware', '2x3'],
    complexity: 1,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 3,
      height: 4,
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
      featureColors: coloredFeatures({ scoop: PALETTE.teal }),
    },
    metrics: { width: 2, depth: 3, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
