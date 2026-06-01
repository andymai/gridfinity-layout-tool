import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { PALETTE, coloredFeatures } from './palette';

export const COMPARTMENT_EXAMPLES: ExampleDesign[] = [
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
    metrics: { width: 3, depth: 2, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'compartments-3x2-mixed',
    nameKey: 'binExamples.compartments3x2Mixed.name',
    descriptionKey: 'binExamples.compartments3x2Mixed.description',
    techniques: ['compartments'],
    tier: 'showcase',
    popular: false,
    tags: ['divided', 'mixed', '3x2'],
    complexity: 2,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 2,
      height: 4,
      compartments: {
        ...DEFAULT_BIN_PARAMS.compartments,
        cols: 3,
        rows: 2,
        // Top row is one wide compartment; bottom row split into three.
        cells: [0, 0, 0, 1, 2, 3],
      },
      featureColors: coloredFeatures({ dividers: PALETTE.teal }),
    },
    metrics: { width: 3, depth: 2, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
