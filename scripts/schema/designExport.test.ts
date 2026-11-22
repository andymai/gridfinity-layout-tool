/**
 * App export to schema parity: the drift guard for VALUE types.
 *
 * The other guards compare property names, so a schema can name every field
 * and still reject what the app writes (`"auto"` or `null` where it says
 * number, an object where it says string). This exports designs through the
 * app's own `exportDesignJSON` and validates each file against the schema.
 *
 * The guard only sees values some design carries. The auto/null fixture sets
 * the union branches the defaults and examples leave out, and its first test
 * proves `migrateParams` kept them, so it cannot quietly stop covering them.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BIN_PARAMS,
  DEFAULT_DIVIDER_PIECE_CONFIG,
  DEFAULT_FEATURE_COLOR_CONFIG,
  DEFAULT_HANDLE_CONFIG,
  DEFAULT_SLOT_CONFIG,
} from '@/features/bin-designer/constants/defaults';
import { migrateParams } from '@/features/bin-designer/constants/paramMigration';
import { EXAMPLE_DESIGNS } from '@/features/bin-designer/data/examples';
import { LIP_CELL_ZONES } from '@/features/bin-designer/types/featureColors';
import { DEFAULT_FLOOR_PATTERN_CONFIG } from '@/features/bin-designer/types/floor';
import { DEFAULT_LID_CONFIG } from '@/features/bin-designer/types/lid';
import { exportDesignJSON } from '@/features/bin-designer/utils/designJson';
import type { BinParams, Cutout } from '@/shared/types/bin';
import { createValidators, formatErrors } from './loadSchemas';

const { binDesign } = createValidators();

function schemaErrorsForExport(name: string, params: BinParams): string[] {
  const file: unknown = JSON.parse(exportDesignJSON(name, params));
  return binDesign(file) ? [] : formatErrors(binDesign.errors);
}

const CELL_COLOURS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6'];

const perCellLip = (corners: 1 | 2 | 4, bands: 1 | 2 | 4) => ({
  corners,
  bands,
  cells: Object.fromEntries(
    LIP_CELL_ZONES.map((id, i) => [id, CELL_COLOURS[i % CELL_COLOURS.length]])
  ),
});

const CUTOUTS: Cutout[] = [
  {
    id: 'socket-pocket',
    shape: 'rectangle',
    x: 4,
    y: 4,
    width: 24,
    depth: 16,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 2,
    label: 'M3',
    groupId: null,
    labelMode: 'socket',
    labelPlateWidthU: 2,
    labelIcon: 'screw',
  },
  {
    id: 'caption',
    shape: 'text',
    x: 40,
    y: 4,
    width: 20,
    depth: 6,
    cutDepth: 5,
    rotation: 0,
    cornerRadius: 0,
    label: 'Text',
    groupId: null,
    engraveLabel: true,
  },
];

/** Every union branch the defaults leave out, set the way the app sets it. */
const AUTO_AND_NULL_PARAMS: BinParams = migrateParams({
  ...DEFAULT_BIN_PARAMS,
  width: 3,
  depth: 2,
  height: 6,
  compartments: {
    cols: 2,
    rows: 1,
    thickness: 1.2,
    cells: [0, 1],
    dividerHeight: 'auto',
  },
  scoop: { enabled: true, radius: 'auto', style: 'curved', autoMaxHeight: 30 },
  handles: {
    ...DEFAULT_HANDLE_CONFIG,
    enabled: true,
    front: { enabled: true, width: null, height: null, cornerRadius: null },
    back: { enabled: true, width: 60, height: 12, cornerRadius: 2 },
  },
  slotConfig: {
    ...DEFAULT_SLOT_CONFIG,
    layout: 'custom',
    customGrid: { cols: 2, rows: 2, cells: [0, 0, 1, 2] },
  },
  dividerPieces: { ...DEFAULT_DIVIDER_PIECE_CONFIG, height: 'auto' },
  // The scale sliders run 0-100%, and 0 is the finest pattern.
  wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, enabled: true, scale: 0 },
  floorPattern: { ...DEFAULT_FLOOR_PATTERN_CONFIG, enabled: true, scale: 0 },
  cutouts: CUTOUTS,
  featureColors: {
    ...DEFAULT_FEATURE_COLOR_CONFIG,
    enabled: true,
    lip: perCellLip(4, 2),
    lidLip: perCellLip(2, 1),
  },
  lid: {
    ...DEFAULT_LID_CONFIG,
    enabled: true,
    retentionMagnet: { ...DEFAULT_LID_CONFIG.retentionMagnet, edgeMagnets: 2 },
    grip: { ...DEFAULT_LID_CONFIG.grip, mode: 'scallop', heightMm: null },
  },
});

describe('designs exported by the app validate against the schema', () => {
  it('the auto/null fixture survives migrateParams', () => {
    const p = AUTO_AND_NULL_PARAMS;
    expect(p.compartments.dividerHeight).toBe('auto');
    expect(p.scoop.radius).toBe('auto');
    expect(p.scoop.autoMaxHeight).toBe(30);
    expect(p.scoop.side).toBeUndefined();
    expect(p.handles.front.width).toBeNull();
    expect(p.slotConfig.customGrid?.cols).toBe(2);
    expect(p.dividerPieces.height).toBe('auto');
    expect(p.wallPattern.scale).toBe(0);
    expect(p.floorPattern?.scale).toBe(0);
    expect(p.cutouts.map((c) => [c.shape, c.groupId, c.labelPlateWidthU, c.labelIcon])).toEqual([
      ['rectangle', null, 2, 'screw'],
      ['text', null, undefined, undefined],
    ]);
    expect(p.featureColors.lip.corners).toBe(4);
    expect(p.featureColors.lidLip?.corners).toBe(2);
    expect(p.lid.retentionMagnet.edgeMagnets).toBe(2);
    expect(p.lid.grip.heightMm).toBeNull();
  });

  const designs: ReadonlyArray<readonly [string, BinParams]> = [
    ['DEFAULT_BIN_PARAMS', DEFAULT_BIN_PARAMS],
    ['the auto/null fixture', AUTO_AND_NULL_PARAMS],
    ...EXAMPLE_DESIGNS.map((e) => [`example ${e.id}`, e.params] as const),
  ];

  it.each(designs)('%s', (name, params) => {
    const errors = schemaErrorsForExport(name, params);
    expect(errors, `the exported file fails the schema:\n  ${errors.join('\n  ')}`).toEqual([]);
  });
});
