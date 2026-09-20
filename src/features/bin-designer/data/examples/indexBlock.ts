import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import type { Cutout } from '@/features/bin-designer/types';

/** Interior of a 2x2 block at the default wall: 84 − 0.5 tolerance − 2 × 1.2. */
const INNER = 81.1;
/** Fill left between the square's corner and the two walls it does not exit. */
const CORNER_INSET = 14;
/** A 12x8in framing square: 1.5in body, 1in tongue, plus a sliding clearance. */
const BODY_WIDTH = 38.7;
const TONGUE_WIDTH = 26;
/** Deep enough to hold a 1/8in blade below the block's top. */
const CUT_DEPTH = 6;

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
 * The two arms meet at the square's corner, so each pocket runs from the corner
 * inset to the wall it leaves through: the body exits right, the tongue front.
 */
export const INDEX_BLOCK_EXAMPLES: ExampleDesign[] = [
  {
    id: 'corner-index-block',
    nameKey: 'binExamples.cornerIndexBlock.name',
    descriptionKey: 'binExamples.cornerIndexBlock.description',
    techniques: ['workshop'],
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
      cutouts: [
        arm('body', {
          x: CORNER_INSET,
          y: INNER - CORNER_INSET - BODY_WIDTH,
          width: INNER - CORNER_INSET,
          depth: BODY_WIDTH,
          openSides: [{ side: 'right' }],
        }),
        arm('tongue', {
          x: CORNER_INSET,
          y: 0,
          width: TONGUE_WIDTH,
          depth: INNER - CORNER_INSET,
          openSides: [{ side: 'front' }],
        }),
      ],
    },
    metrics: { width: 2, depth: 2, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
