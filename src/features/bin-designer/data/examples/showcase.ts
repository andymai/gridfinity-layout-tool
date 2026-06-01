import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import type { CellMask } from '@/shared/utils/cellMask';

/** 2×2 bin (4×4 half-cells) with the top-right 1u quadrant removed → L-shape. */
const L_SHAPE_MASK: CellMask = {
  cols: 4,
  rows: 4,
  cells: [
    1,
    1,
    1,
    1, // row 0 (bottom)
    1,
    1,
    1,
    1, // row 1
    1,
    1,
    0,
    0, // row 2
    1,
    1,
    0,
    0, // row 3 (top)
  ],
};

export const SHOWCASE_EXAMPLES: ExampleDesign[] = [
  {
    id: 'custom-l-shape',
    nameKey: 'binExamples.customLShape.name',
    descriptionKey: 'binExamples.customLShape.description',
    techniques: ['customShape'],
    tier: 'technique',
    tags: ['custom-shape', 'l-shape', '2x2'],
    complexity: 1,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 4,
      cellMask: L_SHAPE_MASK,
    },
    metrics: { width: 2, depth: 2, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
