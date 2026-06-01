import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';

export const STYLE_EXAMPLES: ExampleDesign[] = [
  {
    id: 'slotted-2x2',
    nameKey: 'binExamples.slotted2x2.name',
    descriptionKey: 'binExamples.slotted2x2.description',
    techniques: ['slotted'],
    tier: 'technique',
    tags: ['slotted', 'dividers', '2x2'],
    complexity: 1,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 4,
      style: 'slotted',
    },
    metrics: { width: 2, depth: 2, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
