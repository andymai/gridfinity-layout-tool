import {
  DEFAULT_BIN_PARAMS,
  DISABLED_WALL_CUTOUT,
} from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { PALETTE, coloredFeatures } from './palette';

export const WALL_CUTOUT_EXAMPLES: ExampleDesign[] = [
  {
    id: 'wall-cutout-2x4-cable',
    nameKey: 'binExamples.wallCutout2x4Cable.name',
    descriptionKey: 'binExamples.wallCutout2x4Cable.description',
    techniques: ['wallCutouts'],
    tier: 'showcase',
    tags: ['cable', 'desk', '2x4'],
    complexity: 2,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 4,
      height: 4,
      walls: {
        ...DEFAULT_BIN_PARAMS.walls,
        enabled: true,
        front: {
          enabled: true,
          width: 60,
          depth: 70,
          alignment: 'center',
          offset: 0,
          widthMm: null,
        },
        back: DISABLED_WALL_CUTOUT,
        left: DISABLED_WALL_CUTOUT,
        right: DISABLED_WALL_CUTOUT,
      },
      featureColors: coloredFeatures({
        lip: PALETTE.amber,
      }),
    },
    metrics: { width: 2, depth: 4, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
