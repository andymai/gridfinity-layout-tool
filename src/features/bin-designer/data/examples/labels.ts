import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { PALETTE, coloredFeatures } from './palette';

export const LABEL_EXAMPLES: ExampleDesign[] = [
  {
    id: 'label-tab-3x2-solid',
    nameKey: 'binExamples.labelTab3x2Solid.name',
    descriptionKey: 'binExamples.labelTab3x2Solid.description',
    techniques: ['labelTab'],
    tier: 'technique',
    popular: false,
    tags: ['label', 'solid-support', '3x2'],
    complexity: 1,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 2,
      height: 3,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'solid', alignment: 'center' },
      featureColors: coloredFeatures({ labelTab: PALETTE.amber }),
    },
    metrics: { width: 3, depth: 2, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
