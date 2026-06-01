import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';

const THUMB = '/src/features/bin-designer/data/examples/thumbnails';

export const LABEL_EXAMPLES: ExampleDesign[] = [
  {
    id: 'label-tab-2x2',
    nameKey: 'binExamples.labelTab2x2.name',
    descriptionKey: 'binExamples.labelTab2x2.description',
    techniques: ['labelTab'],
    tier: 'technique',
    popular: false,
    tags: ['label', 'identification', '2x2'],
    complexity: 1,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 3,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
    },
    thumbnail: `${THUMB}/label-tab-2x2.png`,
    metrics: { width: 2, depth: 2, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'label-tab-1x4',
    nameKey: 'binExamples.labelTab1x4.name',
    descriptionKey: 'binExamples.labelTab1x4.description',
    techniques: ['labelTab'],
    tier: 'technique',
    popular: false,
    tags: ['label', 'drawer', '1x4'],
    complexity: 1,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 4,
      height: 3,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, alignment: 'center' },
    },
    thumbnail: `${THUMB}/label-tab-1x4.png`,
    metrics: { width: 1, depth: 4, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'label-tab-3x2-solid',
    nameKey: 'binExamples.labelTab3x2Solid.name',
    descriptionKey: 'binExamples.labelTab3x2Solid.description',
    techniques: ['labelTab'],
    tier: 'technique',
    popular: false,
    tags: ['label', 'solid-support', '3x2'],
    complexity: 1,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 2,
      height: 3,
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, support: 'solid', alignment: 'center' },
    },
    thumbnail: `${THUMB}/label-tab-3x2-solid.png`,
    metrics: { width: 3, depth: 2, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
