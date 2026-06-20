import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import type { CellMask } from '@/shared/utils/cellMask';
import { PALETTE, coloredFeatures } from './palette';

/** 3×2 bin (6×4 half-cells): two uprights joined by a bottom band → U-shape. */
const U_SHAPE_MASK: CellMask = {
  cols: 6,
  rows: 4,
  cells: [
    1,
    1,
    1,
    1,
    1,
    1, // row 0 (bottom) — base band
    1,
    1,
    1,
    1,
    1,
    1, // row 1 — base band
    1,
    1,
    0,
    0,
    1,
    1, // row 2 — uprights
    1,
    1,
    0,
    0,
    1,
    1, // row 3 (top) — uprights
  ],
};

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
      // No divider color: a full compartment grid bakes its walls into the
      // shell (compartmentWallsFeature is skipped), so they always render as
      // the body color — a `dividers` override would be a dead no-op.
      featureColors: coloredFeatures({
        labelTab: PALETTE.amber,
        scoop: PALETTE.coral,
        lip: PALETTE.amber,
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
  {
    id: 'hero-handled-tote',
    nameKey: 'binExamples.heroHandledTote.name',
    descriptionKey: 'binExamples.heroHandledTote.description',
    techniques: ['handles'],
    tier: 'showcase',
    tags: ['handles', 'tote', 'carry', '3x2'],
    complexity: 3,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 2,
      height: 10,
      handles: {
        ...DEFAULT_BIN_PARAMS.handles,
        enabled: true,
        shape: 'rectangle',
        width: 50,
        height: 18,
        cornerRadius: 8,
        verticalPosition: 0.8,
        count: 1,
        front: { ...DEFAULT_BIN_PARAMS.handles.front, enabled: true },
        back: { ...DEFAULT_BIN_PARAMS.handles.back, enabled: true },
        left: { ...DEFAULT_BIN_PARAMS.handles.left, enabled: false },
        right: { ...DEFAULT_BIN_PARAMS.handles.right, enabled: false },
      },
      featureColors: coloredFeatures({ body: PALETTE.body }),
    },
    metrics: { width: 3, depth: 2, height: 10, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'hero-engraved-tray',
    nameKey: 'binExamples.heroEngravedTray.name',
    descriptionKey: 'binExamples.heroEngravedTray.description',
    techniques: ['compartments', 'labelTab'],
    tier: 'showcase',
    tags: ['engraved', 'labeled', 'numbered', '1x4'],
    complexity: 3,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 1,
      depth: 4,
      height: 3,
      compartments: {
        ...DEFAULT_BIN_PARAMS.compartments,
        cols: 1,
        rows: 4,
        cells: [0, 1, 2, 3],
        compartmentTexts: ['1', '2', '3', '4'],
      },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true, alignment: 'center' },
      featureColors: coloredFeatures({ labelTab: PALETTE.amber, text: PALETTE.amber }),
    },
    metrics: { width: 1, depth: 4, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'hero-u-shape',
    nameKey: 'binExamples.heroUShape.name',
    descriptionKey: 'binExamples.heroUShape.description',
    techniques: ['customShape'],
    tier: 'showcase',
    tags: ['custom-shape', 'u-shape', '3x2'],
    complexity: 2,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 2,
      height: 4,
      cellMask: U_SHAPE_MASK,
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
      featureColors: coloredFeatures({ scoop: PALETTE.teal }),
    },
    metrics: { width: 3, depth: 2, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
