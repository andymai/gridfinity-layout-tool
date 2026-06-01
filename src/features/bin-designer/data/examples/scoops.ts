import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';

const THUMB = '/src/features/bin-designer/data/examples/thumbnails';

export const SCOOP_EXAMPLES: ExampleDesign[] = [
  {
    id: 'scoop-1x2-ramp',
    nameKey: 'binExamples.scoop1x2Ramp.name',
    descriptionKey: 'binExamples.scoop1x2Ramp.description',
    techniques: ['scoop'],
    tier: 'technique',
    popular: false,
    tags: ['scoop', 'small-parts', '1x2'],
    complexity: 1,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 2,
      height: 3,
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
    },
    thumbnail: `${THUMB}/scoop-1x2-ramp.png`,
    metrics: { width: 1, depth: 2, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'scoop-2x3-ramp',
    nameKey: 'binExamples.scoop2x3Ramp.name',
    descriptionKey: 'binExamples.scoop2x3Ramp.description',
    techniques: ['scoop'],
    tier: 'technique',
    popular: false,
    tags: ['scoop', 'hardware', '2x3'],
    complexity: 1,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 3,
      height: 4,
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
    },
    thumbnail: `${THUMB}/scoop-2x3-ramp.png`,
    metrics: { width: 2, depth: 3, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'scoop-1x1-deep',
    nameKey: 'binExamples.scoop1x1Deep.name',
    descriptionKey: 'binExamples.scoop1x1Deep.description',
    techniques: ['scoop'],
    tier: 'technique',
    popular: false,
    tags: ['scoop', 'deep', '1x1'],
    complexity: 1,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 1,
      height: 5,
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
    },
    thumbnail: `${THUMB}/scoop-1x1-deep.png`,
    metrics: { width: 1, depth: 1, height: 5, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
