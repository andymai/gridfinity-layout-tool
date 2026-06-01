import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import { PALETTE, coloredFeatures } from './palette';

/**
 * Rich, colored "hero" examples that combine capabilities to showcase the
 * designer's range. Selectively colored via the cohesive gallery palette.
 */
export const HERO_EXAMPLES: ExampleDesign[] = [
  {
    id: 'hero-multicolor-organizer',
    nameKey: 'binExamples.heroMulticolorOrganizer.name',
    descriptionKey: 'binExamples.heroMulticolorOrganizer.description',
    techniques: ['compartments', 'labelTab', 'scoop'],
    tier: 'showcase',
    popular: true,
    tags: ['multicolor', 'organizer', '3x2'],
    complexity: 3,
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
        cells: [0, 1, 2, 3, 4, 5],
      },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
      featureColors: coloredFeatures({
        dividers: PALETTE.teal,
        labelTab: PALETTE.amber,
        scoop: PALETTE.coral,
        lip: {
          frontLeft: PALETTE.amber,
          frontRight: PALETTE.amber,
          backRight: PALETTE.amber,
          backLeft: PALETTE.amber,
        },
      }),
    },
    metrics: { width: 3, depth: 2, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'hero-honeycomb-caddy',
    nameKey: 'binExamples.heroHoneycombCaddy.name',
    descriptionKey: 'binExamples.heroHoneycombCaddy.description',
    techniques: ['wallPattern', 'scoop'],
    tier: 'showcase',
    popular: true,
    tags: ['honeycomb', 'ventilated', '2x3'],
    complexity: 2,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 3,
      height: 5,
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
      featureColors: coloredFeatures({ scoop: PALETTE.teal }),
    },
    metrics: { width: 2, depth: 3, height: 5, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
