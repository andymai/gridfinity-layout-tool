import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import type { Cutout } from '@/features/bin-designer/types';
import type { CellMask } from '@/shared/utils/cellMask';
import { PALETTE, coloredFeatures } from './palette';

/** 3×3 bin (6×6 half-cells): wide top band + centered stem → T-shape. */
const T_SHAPE_MASK: CellMask = {
  cols: 6,
  rows: 6,
  cells: [
    0,
    0,
    1,
    1,
    0,
    0, // row 0 (bottom) — stem
    0,
    0,
    1,
    1,
    0,
    0, // row 1 — stem
    0,
    0,
    1,
    1,
    0,
    0, // row 2 — stem
    0,
    0,
    1,
    1,
    0,
    0, // row 3 — stem
    1,
    1,
    1,
    1,
    1,
    1, // row 4 — top band
    1,
    1,
    1,
    1,
    1,
    1, // row 5 (top) — top band
  ],
};

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

/** 3×3 bin (6×6 half-cells): filled ring with a hollow 2×2 center → O-frame. */
const O_FRAME_MASK: CellMask = {
  cols: 6,
  rows: 6,
  cells: [
    1,
    1,
    1,
    1,
    1,
    1, // row 0 (bottom)
    1,
    1,
    1,
    1,
    1,
    1, // row 1
    1,
    1,
    0,
    0,
    1,
    1, // row 2 — hollow center
    1,
    1,
    0,
    0,
    1,
    1, // row 3 — hollow center
    1,
    1,
    1,
    1,
    1,
    1, // row 4
    1,
    1,
    1,
    1,
    1,
    1, // row 5 (top)
  ],
};

/** A 4×4 grid of small circular cutouts across a 2×2 solid bin top. */
function bitHolderCutouts(): Cutout[] {
  const cuts: Cutout[] = [];
  const start = 16;
  const pitch = 17;
  const diameter = 9;
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      cuts.push({
        id: `bit-${row}-${col}`,
        shape: 'circle',
        x: start + col * pitch,
        y: start + row * pitch,
        width: diameter,
        depth: diameter,
        cutDepth: 20,
        rotation: 0,
        cornerRadius: 0,
        label: '',
        groupId: null,
      });
    }
  }
  return cuts;
}

/** A row of graduated-diameter circular cutouts across a 2×3 solid bin top. */
function socketCaddyCutouts(): Cutout[] {
  const diameters = [12, 16, 20, 24];
  const xs = [20, 44, 72, 104];
  return diameters.map((d, i) => ({
    id: `socket-${i}`,
    shape: 'circle',
    x: xs[i],
    y: 38,
    width: d,
    depth: d,
    cutDepth: 22,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
  }));
}

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
  {
    id: 'hero-lidded-parts-box',
    nameKey: 'binExamples.heroLiddedPartsBox.name',
    descriptionKey: 'binExamples.heroLiddedPartsBox.description',
    techniques: ['compartments', 'lid'],
    tier: 'showcase',
    popular: true,
    tags: ['lid', 'divided', 'enclosed', '2x2'],
    complexity: 3,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 4,
      compartments: {
        ...DEFAULT_BIN_PARAMS.compartments,
        cols: 2,
        rows: 2,
        cells: [0, 1, 2, 3],
      },
      base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true },
      lid: { ...DEFAULT_BIN_PARAMS.lid, enabled: true },
      featureColors: coloredFeatures({ lid: PALETTE.coral, dividers: PALETTE.teal }),
    },
    metrics: { width: 2, depth: 2, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'hero-handled-tote',
    nameKey: 'binExamples.heroHandledTote.name',
    descriptionKey: 'binExamples.heroHandledTote.description',
    techniques: ['handles'],
    tier: 'showcase',
    popular: false,
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
    popular: false,
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
    id: 'hero-t-shape',
    nameKey: 'binExamples.heroTShape.name',
    descriptionKey: 'binExamples.heroTShape.description',
    techniques: ['customShape'],
    tier: 'showcase',
    popular: false,
    tags: ['custom-shape', 't-shape', '3x3'],
    complexity: 2,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 3,
      height: 4,
      cellMask: T_SHAPE_MASK,
      featureColors: coloredFeatures({ body: PALETTE.teal }),
    },
    metrics: { width: 3, depth: 3, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'hero-u-shape',
    nameKey: 'binExamples.heroUShape.name',
    descriptionKey: 'binExamples.heroUShape.description',
    techniques: ['customShape'],
    tier: 'showcase',
    popular: false,
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
  {
    id: 'hero-o-frame',
    nameKey: 'binExamples.heroOFrame.name',
    descriptionKey: 'binExamples.heroOFrame.description',
    techniques: ['customShape'],
    tier: 'showcase',
    popular: false,
    tags: ['custom-shape', 'o-frame', 'hollow', '3x3'],
    complexity: 2,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 3,
      height: 4,
      cellMask: O_FRAME_MASK,
      featureColors: coloredFeatures({ body: PALETTE.coral }),
    },
    metrics: { width: 3, depth: 3, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'hero-hex-bit-holder',
    nameKey: 'binExamples.heroHexBitHolder.name',
    descriptionKey: 'binExamples.heroHexBitHolder.description',
    techniques: ['floorCutouts'],
    tier: 'showcase',
    popular: false,
    tags: ['bit-holder', 'pockets', 'solid', '2x2'],
    complexity: 2,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 4,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: bitHolderCutouts(),
      cutoutConfig: { ...DEFAULT_BIN_PARAMS.cutoutConfig },
      featureColors: coloredFeatures({ body: PALETTE.body }),
    },
    metrics: { width: 2, depth: 2, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'hero-socket-caddy',
    nameKey: 'binExamples.heroSocketCaddy.name',
    descriptionKey: 'binExamples.heroSocketCaddy.description',
    techniques: ['floorCutouts'],
    tier: 'showcase',
    popular: false,
    tags: ['socket', 'graduated', 'solid', '2x3'],
    complexity: 2,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 3,
      depth: 2,
      height: 4,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      cutouts: socketCaddyCutouts(),
      cutoutConfig: { ...DEFAULT_BIN_PARAMS.cutoutConfig },
      featureColors: coloredFeatures({ body: PALETTE.body }),
    },
    metrics: { width: 3, depth: 2, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'hero-half-pitch-sorter',
    nameKey: 'binExamples.heroHalfPitchSorter.name',
    descriptionKey: 'binExamples.heroHalfPitchSorter.description',
    techniques: ['compartments', 'baseOptions'],
    tier: 'showcase',
    popular: false,
    tags: ['half-sockets', 'fine-grid', 'sorter', '2x2'],
    complexity: 3,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 2,
      height: 3,
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
      compartments: {
        ...DEFAULT_BIN_PARAMS.compartments,
        cols: 4,
        rows: 4,
        cells: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      },
      featureColors: coloredFeatures({ dividers: PALETTE.teal }),
    },
    metrics: { width: 2, depth: 2, height: 3, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
  {
    id: 'hero-divided-scooped',
    nameKey: 'binExamples.heroDividedScooped.name',
    descriptionKey: 'binExamples.heroDividedScooped.description',
    techniques: ['compartments', 'scoop'],
    tier: 'showcase',
    popular: false,
    tags: ['divided', 'scoop', 'organizer', '2x3'],
    complexity: 3,
    colored: true,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 2,
      depth: 3,
      height: 4,
      compartments: {
        ...DEFAULT_BIN_PARAMS.compartments,
        cols: 2,
        rows: 3,
        cells: [0, 1, 2, 3, 4, 5],
      },
      scoop: { ...DEFAULT_BIN_PARAMS.scoop, enabled: true },
      featureColors: coloredFeatures({ scoop: PALETTE.coral, dividers: PALETTE.teal }),
    },
    metrics: { width: 2, depth: 3, height: 4, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
