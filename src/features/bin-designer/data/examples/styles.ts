import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { PALETTE, coloredFeatures } from './palette';

export const STYLE_EXAMPLES: ExampleDesign[] = [
  {
    id: 'slotted-2x2',
    nameKey: 'binExamples.slotted2x2.name',
    descriptionKey: 'binExamples.slotted2x2.description',
    techniques: ['slotted'],
    tier: 'technique',
    popular: false,
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
  {
    id: 'wall-pattern-2x2',
    nameKey: 'binExamples.wallPattern2x2.name',
    descriptionKey: 'binExamples.wallPattern2x2.description',
    techniques: ['wallPattern'],
    tier: 'technique',
    popular: false,
    tags: ['honeycomb', 'ventilated', '2x2'],
    complexity: 1,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 4,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
    },
    metrics: { width: 2, depth: 2, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'solid-1x1x6-block',
    nameKey: 'binExamples.solid1x1x6Block.name',
    descriptionKey: 'binExamples.solid1x1x6Block.description',
    techniques: ['solid'],
    tier: 'showcase',
    popular: true,
    tags: ['solid', 'canister', '1x1'],
    complexity: 1,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      height: 6,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      featureColors: coloredFeatures({ body: PALETTE.teal }),
    },
    metrics: { width: 1, depth: 1, height: 6, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
