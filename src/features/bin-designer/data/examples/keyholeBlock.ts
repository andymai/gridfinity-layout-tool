import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';

/**
 * A screwdriver lies handle-in: the handle drops into the wide pocket and the
 * shank leaves through a narrow channel in the right wall, so the tool is
 * held by its handle and lifts straight out.
 */
export const KEYHOLE_BLOCK_EXAMPLES: ExampleDesign[] = [
  {
    id: 'keyhole-tool-block',
    nameKey: 'binExamples.keyholeToolBlock.name',
    descriptionKey: 'binExamples.keyholeToolBlock.description',
    techniques: ['workshop'],
    tier: 'technique',
    tags: ['workshop', 'keyhole', 'screwdriver', '3x1'],
    complexity: 1,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 1,
      height: 5,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: [
        {
          id: 'handle',
          shape: 'slot',
          x: 6,
          y: 4.55,
          width: 100,
          depth: 30,
          cutDepth: 20,
          rotation: 0,
          cornerRadius: 0,
          label: '',
          groupId: null,
          chamferWidth: 1,
          openSides: [{ side: 'right', widthMm: 9 }],
        },
      ],
    },
    metrics: { width: 3, depth: 1, height: 5, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
