/**
 * Cross-boundary equality tests for the designer-validation mirrors.
 *
 * api/ cannot import from src/ at runtime, so every allowlist and bound below
 * is a hand-copied client constant. A value added on the client and not here
 * makes an honest design 400 on sync; one removed there and not here leaves the
 * server accepting geometry nothing builds. This is the node-env `unit` vitest
 * project, which also picks up `api/**\/*.test.ts`, so both sides are
 * importable from one run.
 */
import { describe, expect, it } from 'vitest';

import {
  DESIGN_TAG_MAX_COUNT,
  DESIGN_TAG_MAX_LENGTH,
  LIP_CORNERS as API_LIP_CORNERS,
  MAX_CUTOUT_CORNER_RADIUS as API_MAX_CUTOUT_CORNER_RADIUS,
  VALID_BIN_STYLES,
  VALID_CUTOUT_FILL_REFERENCES,
  VALID_CUTOUT_LABEL_MODES,
  VALID_FEET_MODES,
  VALID_FOOT_LATTICES,
  VALID_LABEL_SOCKET_STYLES,
  VALID_LID_ATTACHMENTS_TOP,
  VALID_LID_GRIP_MODES,
  VALID_LID_HINGE_CATCHES,
  VALID_LID_RAIL_SIDES,
  VALID_LID_SLIDE_PLACEMENTS,
  VALID_LID_SLIDE_PULLS,
  VALID_LIGHTWEIGHT_MODES,
  VALID_LIP_AXIS_COUNTS,
  VALID_PIN_DIAMETERS,
  VALID_TEXT_ANCHORS,
  VALID_TEXT_CASES,
  VALID_TEXT_CUT_PROFILES,
  VALID_TEXT_FONTS,
  VALID_WALL_TEXT_ALIGNS,
  VALID_WALL_TEXT_SIDES,
  validateDesignerShare,
} from './designerValidation.js';
import {
  CONSTRAINTS,
  SLIDE_CONSTRAINTS as API_SLIDE_CONSTRAINTS,
  VALID_LABEL_PLATE_WIDTHS,
  VALID_SLIDE_RAIL_MOUNTS,
} from './designerValidationConstants.js';

import {
  DESIGNER_CONSTRAINTS,
  minHeightUnits,
} from '../../src/features/bin-designer/constants/gridfinity.js';
import {
  BIN_STYLES,
  DETACHABLE_PIN_DIAMETERS_MM,
  FEET_MODES,
  FOOT_LATTICES,
  LIGHTWEIGHT_MODES,
} from '../../src/features/bin-designer/types/base.js';
import {
  CUTOUT_FILL_REFERENCES,
  CUTOUT_LABEL_MODES,
  MAX_ARRAY_INSTANCES,
  MAX_CUTOUT_GROUP_NAMES,
  MAX_CUTOUT_LEAN_DEG,
  MAX_GROUP_NAME_LENGTH,
  MAX_PARENT_GROUPS,
} from '../../src/features/bin-designer/types/cutout.js';
import {
  LIP_AXIS_COUNTS,
  LIP_CORNERS,
} from '../../src/features/bin-designer/types/featureColors.js';
import {
  LID_ATTACHMENTS,
  LID_GRIP_MODES,
  LID_HINGE_CATCHES,
  LID_RAIL_SIDES,
  LID_SLIDE_PLACEMENTS,
  LID_SLIDE_PULLS,
  MAX_LID_CUTOUTS,
} from '../../src/features/bin-designer/types/lid.js';
import {
  SLIDE_CONSTRAINTS,
  SLIDE_RAIL_MOUNTS,
} from '../../src/features/bin-designer/types/slide.js';
import {
  TEXT_ANCHORS,
  TEXT_CASES,
  TEXT_CUT_PROFILES,
  TEXT_FONT_FAMILIES,
  WALL_TEXT_ALIGNS,
  WALL_TEXT_SIDES,
} from '../../src/features/bin-designer/types/text.js';
import { MAX_TAGS, MAX_TAG_LENGTH } from '../../src/features/bin-designer/utils/tags.js';
import {
  LABEL_PLATE_FIT_OFFSET_MAX,
  LABEL_PLATE_FIT_OFFSET_MIN,
  LABEL_PLATE_WIDTHS_U,
  LABEL_SOCKET_STYLES,
  MIN_LABEL_SOCKET_TAB_DEPTH_MM,
} from '../../src/shared/constants/labelPlates.js';
import {
  MAX_MESH_ASSETS_PER_DESIGN,
  MAX_MESH_ASSET_DATA_LENGTH,
  MAX_MESH_ASSET_TRIANGLES,
  MAX_MESH_OUTLINE_POINTS,
} from '../../src/shared/generation/meshAsset.js';
import { GRIDFINITY_SPEC } from '../../src/shared/printSettings/gridfinityGeometry.js';
import { MAX_MASK_DIMENSION } from '../../src/shared/utils/cellMask.js';
import { MAX_CUTOUT_CORNER_RADIUS } from '../../src/shared/utils/wallCutoutPosition.js';

type Allowlist = readonly (string | number)[];

const ALLOWLIST_MIRRORS: readonly (readonly [string, Allowlist, Allowlist])[] = [
  ['VALID_BIN_STYLES / BIN_STYLES', VALID_BIN_STYLES, BIN_STYLES],
  ['VALID_FOOT_LATTICES / FOOT_LATTICES', VALID_FOOT_LATTICES, FOOT_LATTICES],
  ['VALID_LIGHTWEIGHT_MODES / LIGHTWEIGHT_MODES', VALID_LIGHTWEIGHT_MODES, LIGHTWEIGHT_MODES],
  ['VALID_FEET_MODES / FEET_MODES', VALID_FEET_MODES, FEET_MODES],
  [
    'VALID_PIN_DIAMETERS / DETACHABLE_PIN_DIAMETERS_MM',
    VALID_PIN_DIAMETERS,
    DETACHABLE_PIN_DIAMETERS_MM,
  ],
  [
    'VALID_LABEL_SOCKET_STYLES / LABEL_SOCKET_STYLES',
    VALID_LABEL_SOCKET_STYLES,
    LABEL_SOCKET_STYLES,
  ],
  [
    'VALID_LABEL_PLATE_WIDTHS / LABEL_PLATE_WIDTHS_U',
    VALID_LABEL_PLATE_WIDTHS,
    LABEL_PLATE_WIDTHS_U,
  ],
  ['VALID_LID_ATTACHMENTS_TOP / LID_ATTACHMENTS', VALID_LID_ATTACHMENTS_TOP, LID_ATTACHMENTS],
  [
    'VALID_LID_SLIDE_PLACEMENTS / LID_SLIDE_PLACEMENTS',
    VALID_LID_SLIDE_PLACEMENTS,
    LID_SLIDE_PLACEMENTS,
  ],
  ['VALID_LID_SLIDE_PULLS / LID_SLIDE_PULLS', VALID_LID_SLIDE_PULLS, LID_SLIDE_PULLS],
  ['VALID_LID_RAIL_SIDES / LID_RAIL_SIDES', VALID_LID_RAIL_SIDES, LID_RAIL_SIDES],
  ['VALID_LID_HINGE_CATCHES / LID_HINGE_CATCHES', VALID_LID_HINGE_CATCHES, LID_HINGE_CATCHES],
  ['VALID_LID_GRIP_MODES / LID_GRIP_MODES', VALID_LID_GRIP_MODES, LID_GRIP_MODES],
  ['VALID_SLIDE_RAIL_MOUNTS / SLIDE_RAIL_MOUNTS', VALID_SLIDE_RAIL_MOUNTS, SLIDE_RAIL_MOUNTS],
  ['VALID_TEXT_FONTS / TEXT_FONT_FAMILIES', VALID_TEXT_FONTS, TEXT_FONT_FAMILIES],
  ['VALID_TEXT_ANCHORS / TEXT_ANCHORS', VALID_TEXT_ANCHORS, TEXT_ANCHORS],
  ['VALID_TEXT_CASES / TEXT_CASES', VALID_TEXT_CASES, TEXT_CASES],
  ['VALID_TEXT_CUT_PROFILES / TEXT_CUT_PROFILES', VALID_TEXT_CUT_PROFILES, TEXT_CUT_PROFILES],
  ['VALID_WALL_TEXT_SIDES / WALL_TEXT_SIDES', VALID_WALL_TEXT_SIDES, WALL_TEXT_SIDES],
  ['VALID_WALL_TEXT_ALIGNS / WALL_TEXT_ALIGNS', VALID_WALL_TEXT_ALIGNS, WALL_TEXT_ALIGNS],
  [
    'VALID_CUTOUT_FILL_REFERENCES / CUTOUT_FILL_REFERENCES',
    VALID_CUTOUT_FILL_REFERENCES,
    CUTOUT_FILL_REFERENCES,
  ],
  ['VALID_CUTOUT_LABEL_MODES / CUTOUT_LABEL_MODES', VALID_CUTOUT_LABEL_MODES, CUTOUT_LABEL_MODES],
  ['LIP_CORNERS', API_LIP_CORNERS, LIP_CORNERS],
  ['VALID_LIP_AXIS_COUNTS / LIP_AXIS_COUNTS', [...VALID_LIP_AXIS_COUNTS], LIP_AXIS_COUNTS],
];

const BOUND_MIRRORS: readonly (readonly [string, number, number])[] = [
  ['MIN_DIMENSION', CONSTRAINTS.MIN_DIMENSION, DESIGNER_CONSTRAINTS.MIN_DIMENSION],
  ['MAX_DIMENSION', CONSTRAINTS.MAX_DIMENSION, DESIGNER_CONSTRAINTS.MAX_DIMENSION],
  ['MIN_HEIGHT', CONSTRAINTS.MIN_HEIGHT, DESIGNER_CONSTRAINTS.MIN_HEIGHT],
  ['MIN_SPACER_HEIGHT', CONSTRAINTS.MIN_SPACER_HEIGHT, DESIGNER_CONSTRAINTS.MIN_SPACER_HEIGHT],
  ['MIN_BODY_WALL_MM', CONSTRAINTS.MIN_BODY_WALL_MM, DESIGNER_CONSTRAINTS.MIN_BODY_WALL_MM],
  ['MAX_HEIGHT', CONSTRAINTS.MAX_HEIGHT, DESIGNER_CONSTRAINTS.MAX_HEIGHT],
  ['SOCKET_HEIGHT', CONSTRAINTS.SOCKET_HEIGHT, GRIDFINITY_SPEC.SOCKET_HEIGHT],
  ['DEFAULT_HEIGHT_UNIT_MM', CONSTRAINTS.DEFAULT_HEIGHT_UNIT_MM, GRIDFINITY_SPEC.HEIGHT_UNIT],
  [
    'MIN_COMPARTMENT_GRID',
    CONSTRAINTS.MIN_COMPARTMENT_GRID,
    DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_GRID,
  ],
  [
    'MAX_COMPARTMENT_GRID',
    CONSTRAINTS.MAX_COMPARTMENT_GRID,
    DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_GRID,
  ],
  [
    'MIN_COMPARTMENT_THICKNESS',
    CONSTRAINTS.MIN_COMPARTMENT_THICKNESS,
    DESIGNER_CONSTRAINTS.MIN_COMPARTMENT_THICKNESS,
  ],
  [
    'MAX_COMPARTMENT_THICKNESS',
    CONSTRAINTS.MAX_COMPARTMENT_THICKNESS,
    DESIGNER_CONSTRAINTS.MAX_COMPARTMENT_THICKNESS,
  ],
  ['MAX_STASH_ENTRIES', CONSTRAINTS.MAX_STASH_ENTRIES, DESIGNER_CONSTRAINTS.MAX_STASH_ENTRIES],
  [
    'MIN_DIVIDER_THICKNESS',
    CONSTRAINTS.MIN_DIVIDER_THICKNESS,
    DESIGNER_CONSTRAINTS.MIN_DIVIDER_THICKNESS,
  ],
  [
    'MAX_DIVIDER_THICKNESS',
    CONSTRAINTS.MAX_DIVIDER_THICKNESS,
    DESIGNER_CONSTRAINTS.MAX_DIVIDER_THICKNESS,
  ],
  [
    'MIN_LABEL_TAB_DEPTH',
    CONSTRAINTS.MIN_LABEL_TAB_DEPTH,
    DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_DEPTH,
  ],
  [
    'MAX_LABEL_TAB_DEPTH',
    CONSTRAINTS.MAX_LABEL_TAB_DEPTH,
    DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_DEPTH,
  ],
  [
    'MIN_LABEL_TAB_WIDTH',
    CONSTRAINTS.MIN_LABEL_TAB_WIDTH,
    DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_WIDTH,
  ],
  [
    'MAX_LABEL_TAB_WIDTH',
    CONSTRAINTS.MAX_LABEL_TAB_WIDTH,
    DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_WIDTH,
  ],
  [
    'MIN_LABEL_TAB_HEIGHT',
    CONSTRAINTS.MIN_LABEL_TAB_HEIGHT,
    DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_HEIGHT,
  ],
  [
    'MAX_LABEL_TAB_HEIGHT',
    CONSTRAINTS.MAX_LABEL_TAB_HEIGHT,
    DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_HEIGHT,
  ],
  [
    'MIN_LABEL_TAB_INSET',
    CONSTRAINTS.MIN_LABEL_TAB_INSET,
    DESIGNER_CONSTRAINTS.MIN_LABEL_TAB_INSET,
  ],
  [
    'MAX_LABEL_TAB_INSET',
    CONSTRAINTS.MAX_LABEL_TAB_INSET,
    DESIGNER_CONSTRAINTS.MAX_LABEL_TAB_INSET,
  ],
  [
    'MIN_EXTRA_WALL_HEIGHT',
    CONSTRAINTS.MIN_EXTRA_WALL_HEIGHT,
    DESIGNER_CONSTRAINTS.MIN_EXTRA_WALL_HEIGHT,
  ],
  [
    'MAX_EXTRA_WALL_HEIGHT',
    CONSTRAINTS.MAX_EXTRA_WALL_HEIGHT,
    DESIGNER_CONSTRAINTS.MAX_EXTRA_WALL_HEIGHT,
  ],
  [
    'MIN_LABEL_SOCKET_TAB_DEPTH',
    CONSTRAINTS.MIN_LABEL_SOCKET_TAB_DEPTH,
    MIN_LABEL_SOCKET_TAB_DEPTH_MM,
  ],
  [
    'LABEL_PLATE_FIT_OFFSET_MIN',
    CONSTRAINTS.LABEL_PLATE_FIT_OFFSET_MIN,
    LABEL_PLATE_FIT_OFFSET_MIN,
  ],
  [
    'LABEL_PLATE_FIT_OFFSET_MAX',
    CONSTRAINTS.LABEL_PLATE_FIT_OFFSET_MAX,
    LABEL_PLATE_FIT_OFFSET_MAX,
  ],
  ['MAX_CUTOUT_LEAN_DEG', CONSTRAINTS.MAX_CUTOUT_LEAN_DEG, MAX_CUTOUT_LEAN_DEG],
  ['MAX_ARRAY_INSTANCES', CONSTRAINTS.MAX_ARRAY_INSTANCES, MAX_ARRAY_INSTANCES],
  ['MAX_PARENT_GROUPS', CONSTRAINTS.MAX_PARENT_GROUPS, MAX_PARENT_GROUPS],
  ['MAX_GROUP_NAME_LENGTH', CONSTRAINTS.MAX_GROUP_NAME_LENGTH, MAX_GROUP_NAME_LENGTH],
  ['MAX_CUTOUT_GROUP_NAMES', CONSTRAINTS.MAX_CUTOUT_GROUP_NAMES, MAX_CUTOUT_GROUP_NAMES],
  ['MAX_LID_CUTOUTS', CONSTRAINTS.MAX_LID_CUTOUTS, MAX_LID_CUTOUTS],
  ['MAX_MESH_ASSETS', CONSTRAINTS.MAX_MESH_ASSETS, MAX_MESH_ASSETS_PER_DESIGN],
  ['MAX_MESH_ASSET_TRIANGLES', CONSTRAINTS.MAX_MESH_ASSET_TRIANGLES, MAX_MESH_ASSET_TRIANGLES],
  ['MAX_MESH_OUTLINE_POINTS', CONSTRAINTS.MAX_MESH_OUTLINE_POINTS, MAX_MESH_OUTLINE_POINTS],
  ['MAX_MESH_DATA_LENGTH', CONSTRAINTS.MAX_MESH_DATA_LENGTH, MAX_MESH_ASSET_DATA_LENGTH],
  ['MAX_MASK_DIMENSION', CONSTRAINTS.MAX_MASK_DIMENSION, MAX_MASK_DIMENSION],
  ['MAX_CUTOUT_CORNER_RADIUS', API_MAX_CUTOUT_CORNER_RADIUS, MAX_CUTOUT_CORNER_RADIUS],
  ['DESIGN_TAG_MAX_COUNT', DESIGN_TAG_MAX_COUNT, MAX_TAGS],
  ['DESIGN_TAG_MAX_LENGTH', DESIGN_TAG_MAX_LENGTH, MAX_TAG_LENGTH],
];

describe('designer allowlists (cross-boundary mirror)', () => {
  it.each(ALLOWLIST_MIRRORS)('%s admit the same values', (_label, server, client) => {
    expect(new Set(server)).toEqual(new Set(client));
  });
});

describe('designer bounds (cross-boundary mirror)', () => {
  it.each(BOUND_MIRRORS)('%s matches the client', (_label, server, client) => {
    expect(server).toBe(client);
  });

  it('SLIDE_CONSTRAINTS matches key for key', () => {
    expect({ ...API_SLIDE_CONSTRAINTS }).toEqual({ ...SLIDE_CONSTRAINTS });
  });
});

interface MinHeightCase {
  readonly label: string;
  readonly base: { readonly spacer: boolean; readonly tile?: boolean; readonly style: string };
  readonly heightUnitMm?: number;
}

const MIN_HEIGHT_CASES: readonly MinHeightCase[] = [
  { label: 'plain socketed bin', base: { style: 'standard', spacer: false } },
  { label: 'spacer at the default height unit', base: { style: 'standard', spacer: true } },
  {
    label: 'spacer at a 3mm height unit',
    base: { style: 'standard', spacer: true },
    heightUnitMm: 3,
  },
  {
    label: 'spacer at a 2mm height unit',
    base: { style: 'standard', spacer: true },
    heightUnitMm: 2,
  },
  { label: 'spacer on a flat base', base: { style: 'flat', spacer: true } },
  { label: 'spacer on a tray base', base: { style: 'lid', spacer: true } },
  { label: 'base-only bin', base: { style: 'standard', spacer: false, tile: true } },
  { label: 'base-only flat bin', base: { style: 'flat', spacer: false, tile: true } },
  { label: 'base-only spacer', base: { style: 'standard', spacer: true, tile: true } },
];

function sharePayload(testCase: MinHeightCase, height: number): Record<string, unknown> {
  const params: Record<string, unknown> = {
    width: 2,
    depth: 2,
    height,
    style: 'standard',
    base: {
      style: testCase.base.style,
      spacer: testCase.base.spacer,
      ...(testCase.base.tile === undefined ? {} : { tile: testCase.base.tile }),
      magnetDiameter: 6.2,
      magnetDepth: 2.4,
      screwDiameter: 3,
      stackingLip: true,
    },
    compartments: { cols: 1, rows: 1, thickness: 1.2, cells: [0] },
    label: { enabled: false, support: 'bracket', depth: 12, width: 100, alignment: 'center' },
    walls: { front: 0, back: 0, left: 0, right: 0 },
    inserts: [],
  };
  if (testCase.heightUnitMm !== undefined) params.heightUnitMm = testCase.heightUnitMm;
  return { type: 'designer', version: 1, params };
}

function validateAtHeight(
  testCase: MinHeightCase,
  height: number
): ReturnType<typeof validateDesignerShare> {
  const payload = sharePayload(testCase, height);
  return validateDesignerShare(payload, Buffer.byteLength(JSON.stringify(payload), 'utf8'));
}

describe('minimum bin height (cross-boundary mirror)', () => {
  it.each(MIN_HEIGHT_CASES.map((testCase) => [testCase.label, testCase] as const))(
    '%s: the share validator floors exactly where minHeightUnits does',
    (_label, testCase) => {
      const floor = minHeightUnits(testCase.base, testCase.heightUnitMm);
      expect(validateAtHeight(testCase, floor).valid).toBe(true);
      // The message is matched so a payload rejected for some unrelated reason
      // cannot stand in for the floor this case is probing.
      expect(validateAtHeight(testCase, floor - 1)).toMatchObject({
        valid: false,
        error: { message: `height must be ${floor}-${CONSTRAINTS.MAX_HEIGHT}` },
      });
    }
  );
});
