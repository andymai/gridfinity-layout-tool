import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import type { Cutout } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';

/** 2×2 units with the bottom-right unit removed: the L the square's corner sits in. */
const CORNER_MASK: CellMask = {
  cols: 4,
  rows: 4,
  cells: [1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
};

/** Interior of a 2x2 block at the default wall: 84 − 0.5 tolerance − 2 × 1.2. */
const INNER = 81.1;
/** Each arm's usable span starts past the inner corner's wall: 42 − 0.25 − 1.2 on each axis. */
const ARM_INNER_FACE = 42;
/** A 12x8in framing square: 1.5in body, 1in tongue, plus a sliding clearance. */
const BODY_WIDTH = 38.7;
const TONGUE_WIDTH = 26;
/** Deep enough to hold a 1/8in blade below the block's top. */
const CUT_DEPTH = 6;
/** The square's outer corner sits this far in from the block's outer walls. */
const OUTER_INSET = 6.55;

function arm(id: string, rect: Pick<Cutout, 'x' | 'y' | 'width' | 'depth' | 'openSides'>): Cutout {
  return {
    id,
    shape: 'rectangle',
    cutDepth: CUT_DEPTH,
    rotation: 0,
    cornerRadius: 1,
    label: '',
    groupId: null,
    ...rect,
  };
}

/**
 * The two arms meet at the square's outer corner in the L's top-left unit:
 * the body runs along the top arm and exits its right end, the tongue runs
 * down the left arm and exits its bottom end.
 */
export const INDEX_BLOCK_EXAMPLES: ExampleDesign[] = [
  {
    id: 'corner-index-block',
    nameKey: 'binExamples.cornerIndexBlock.name',
    descriptionKey: 'binExamples.cornerIndexBlock.description',
    techniques: ['workshop', 'customShape'],
    tier: 'technique',
    tags: ['workshop', 'index-block', 'framing-square', '2x2'],
    complexity: 1,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 3,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cellMask: CORNER_MASK,
      cutouts: [
        arm('body', {
          x: OUTER_INSET,
          y: ARM_INNER_FACE,
          width: INNER - OUTER_INSET,
          depth: BODY_WIDTH,
          openSides: [{ side: 'right' }],
        }),
        arm('tongue', {
          x: OUTER_INSET,
          y: 0,
          width: TONGUE_WIDTH,
          depth: INNER - OUTER_INSET,
          openSides: [{ side: 'front' }],
        }),
      ],
    },
    metrics: { width: 2, depth: 2, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
