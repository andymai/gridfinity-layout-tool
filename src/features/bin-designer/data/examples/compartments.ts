import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';

export const COMPARTMENT_EXAMPLES: ExampleDesign[] = [
  {
    id: 'compartments-2x2-split',
    nameKey: 'binExamples.compartments2x2Split.name',
    descriptionKey: 'binExamples.compartments2x2Split.description',
    techniques: ['compartments'],
    tier: 'technique',
    popular: true,
    tags: ['divided', 'organizer', '2x2'],
    complexity: 1,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 3,
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 1, cells: [0, 1] },
    },
    thumbnail: '/src/features/bin-designer/data/examples/thumbnails/compartments-2x2-split.png',
    metrics: { width: 2, depth: 2, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'compartments-3x2-grid',
    nameKey: 'binExamples.compartments3x2Grid.name',
    descriptionKey: 'binExamples.compartments3x2Grid.description',
    techniques: ['compartments'],
    tier: 'technique',
    popular: false,
    tags: ['divided', 'grid', '3x2'],
    complexity: 1,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 2,
      height: 3,
      compartments: {
        ...DEFAULT_BIN_PARAMS.compartments,
        cols: 3,
        rows: 2,
        cells: [0, 1, 2, 3, 4, 5],
      },
    },
    thumbnail: '/src/features/bin-designer/data/examples/thumbnails/compartments-3x2-grid.png',
    metrics: { width: 3, depth: 2, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
