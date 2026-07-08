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
  {
    id: 'toothpick-holder',
    nameKey: 'binExamples.toothpickHolder.name',
    descriptionKey: 'binExamples.toothpickHolder.description',
    techniques: ['lid'],
    tier: 'technique',
    tags: ['lid', 'enclosed', 'tall-lid', '1x1'],
    complexity: 1,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      // Short bin: contents (e.g. toothpicks) stick up out of it…
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      // …and a tall lid (45mm above the standard cavity) encloses them.
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true, extraHeightMm: 45 },
      featureColors: coloredFeatures({ lid: PALETTE.amber }),
    },
    metrics: { width: 1, depth: 1, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
