/**
 * Retention coverage for the aggregators.
 *
 * #3008 fixed a leak where the ingest path expired 4 of ~32 key shapes and the
 * other 28 accumulated forever. The `EXPIRE` is now unconditional, so that
 * exact bug cannot recur — but a new aggregator writing a key the retention
 * policy does not recognise (a missing `ml:` prefix, or a collision with a
 * never-expired running total) would reintroduce the same class of leak
 * without any test noticing.
 *
 * Two checks, because neither alone is sufficient: driving the aggregators
 * only reaches the branches a fixture happens to trigger, while reading the
 * source reaches every key shape but cannot prove the functions behave.
 */

import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import type { Increments } from './aggregators.js';
import * as aggregators from './aggregators.js';
import { ML_LIFETIME_KEYS, isExpiringAggregate } from './retention.js';
import type {
  AbandonedBinEvent,
  BinDeletedEvent,
  BinMovedEvent,
  BinPlacementEvent,
  BinResizeEvent,
  BinRotatedEvent,
  CategoryChangeEvent,
  CrossLayoutPatternEvent,
  DrawerPurposeEvent,
  DrawerResizedEvent,
  FillOperationEvent,
  LabelUpdateEvent,
  LayerMoveEvent,
  LayoutQualityEvent,
  LayoutSnapshotEvent,
  PlacementRejectedEvent,
  QuickCorrectionEvent,
  SessionSummaryEvent,
  UndoEvent,
} from './types.js';

const binPlacement: BinPlacementEvent = {
  type: 'bin_placed',
  bin_size: '2x3x4',
  prev_bin_size: '1x1x1',
  drawer_size: '6x8x6',
  position: '0,0',
  layer_index: 0,
  largest_gap: '4x5',
  fill_pct: 50,
  gap_fit: 'exact',
  label_hash: 'a1b2c3d4',
  label_normalized: 'screws',
  label_domain: 'hardware',
  label_embedding_bucket: 'a075',
  category_id: 'cat-01',
  adjacent_label_hashes: ['b2c3d4e5'],
  adjacent_sizes: ['1x1x1'],
  adjacent_count: 1,
  recent_sizes: ['1x1x1'],
  time_since_last_ms: 1000,
  is_first_of_label: true,
  method: 'draw',
  session_index: 0,
  vocab_version: 'v1',
};

const labelUpdate: LabelUpdateEvent = {
  type: 'label_updated',
  bin_size: '1x2x3',
  old_label_hash: 'c3d4e5f6',
  old_label_normalized: 'bolts',
  new_label_hash: 'd4e5f6a7',
  new_label_normalized: 'nuts',
  new_label_domain: 'hardware',
  new_label_embedding_bucket: 'b086',
  vocab_version: 'v1',
};

const layoutSnapshot: LayoutSnapshotEvent = {
  type: 'layout_snapshot',
  trigger: 'save',
  layout_hash: 'aabbccdd',
  snapshot_index: 0,
  drawer_size: '6x8x6',
  layer_count: 1,
  purpose: 'workshop',
  bin_count: 5,
  size_distribution: { '2x2x3': 3, '1x1x1': 2 },
  category_distribution: { 'cat-01': 5 },
  domain_distribution: { tools: 3, misc: 2 },
  top_label_hashes: ['a1b2c3d4', 'b2c3d4e5'],
  fill_percentage: 50,
  labeled_percentage: 60,
  session_duration_ms: 120000,
  edit_count: 10,
  quality_tier: 'medium',
  archetype: 'mixed',
  spatial_patterns: ['corner_start'],
  uniformity_score: 0.5,
  edge_usage: { left: true, right: false, top: true, bottom: false },
  hour_of_day: 14,
  day_of_week: 3,
  is_weekend: false,
  structure_hash: '12345678',
  vocab_version: 'v1',
};

const layoutQuality: LayoutQualityEvent = {
  type: 'layout_quality',
  layout_hash: 'aabbccdd',
  signal: 'shared',
  days_since_creation: 0,
  abandonment_type: 'dormant',
  time_since_last_edit_ms: 0,
};

const drawerPurpose: DrawerPurposeEvent = {
  type: 'drawer_purpose',
  layout_hash: 'aabbccdd',
  purpose: 'workshop',
  is_custom: false,
};

const categoryChange: CategoryChangeEvent = {
  type: 'category_changed',
  bin_size: '2x2x3',
  category_name_hash: 'abcd1234',
  batch_size: 1,
  label_hash: 'a1b2c3d4',
  label_domain: 'hardware',
  vocab_version: 'v1',
};

const binResize: BinResizeEvent = {
  type: 'bin_resized',
  old_size: '1x1x3',
  new_size: '2x1x3',
  dimensions_changed: ['width'],
  batch_size: 1,
  fill_pct: 40,
  resize_direction: 'grow',
  area_delta: 1,
};

const binDeleted: BinDeletedEvent = {
  type: 'bin_deleted',
  bin_size: '2x2x3',
  position: '1,2',
  layer_index: 0,
  had_label: true,
  label_domain: 'hardware',
  age_ms: 5000,
  batch_size: 1,
  fill_pct: 30,
  method: 'key',
};

const binMoved: BinMovedEvent = {
  type: 'bin_moved',
  bin_size: '2x2x3',
  old_position: '0,0',
  new_position: '2,2',
  distance: 1,
  layer_index: 0,
  batch_size: 1,
  method: 'drag',
};

const drawerResized: DrawerResizedEvent = {
  type: 'drawer_resized',
  old_size: '4x4x6',
  new_size: '6x6x6',
  dimensions_changed: ['width', 'depth'],
  bins_staged: 0,
  fill_pct: 20,
};

const fillOperation: FillOperationEvent = {
  type: 'fill_operation',
  method: 'uniform',
  fill_size: '2x2',
  bins_created: 5,
  layer_index: 0,
  fill_pct: 80,
  drawer_size: '6x8x6',
};

const layerMove: LayerMoveEvent = {
  type: 'layer_move',
  bin_size: '1x2x3',
  from_layer_index: 0,
  to_layer_index: 1,
  batch_size: 1,
  method: 'drag',
};

const binRotated: BinRotatedEvent = {
  type: 'bin_rotated',
  old_size: '1x3x4',
  new_size: '3x1x4',
  batch_size: 1,
};

const placementRejected: PlacementRejectedEvent = {
  type: 'placement_rejected',
  rejection_reason: 'cancelled',
  intended_size: '2x2x3',
  intended_position: '1,1',
  layer_index: 0,
  drawer_size: '6x8x6',
  fill_pct: 50,
  mode: 'draw',
};

const undo: UndoEvent = {
  type: 'undo',
  action_undone: 'placement',
  bins_affected: 1,
  time_since_action_ms: 500,
  drawer_size: '6x8x6',
};

const quickCorrection: QuickCorrectionEvent = {
  type: 'quick_correction',
  correction_type: 'delete',
  original_size: '2x2x3',
  new_size: '1x1x1',
  placement_method: 'draw',
  time_to_correction_ms: 2000,
  layer_index: 0,
};

const abandonedBin: AbandonedBinEvent = {
  type: 'bin_abandoned',
  bin_size: '1x1x3',
  position: '3,4',
  layer_index: 0,
  lifetime_ms: 30000,
  creation_method: 'draw',
  fill_pct: 20,
  drawer_size: '6x8x6',
};

const crossLayoutPattern: CrossLayoutPatternEvent = {
  type: 'cross_layout_pattern',
  user_hash: 'anonymous',
  // One consistent and one inconsistent entry: the inconsistent branch is the
  // only path that writes ml:inconsistent_sizes.
  label_size_consistency: [
    { label_hash: 'a1b2c3d4', sizes_used: ['2x2x3'], is_consistent: true },
    { label_hash: 'b2c3d4e5', sizes_used: ['1x1x1', '3x3x3'], is_consistent: false },
  ],
  inferred_purpose: 'workshop',
  inferred_purpose_confidence: 0.5,
  drawer_size: '6x8x6',
};

const sessionSummary: SessionSummaryEvent = {
  type: 'session_summary',
  bins_placed: 5,
  bins_deleted: 1,
  edits_total: 8,
  time_to_first_bin_ms: 5000,
  session_duration_ms: 180000,
  size_sequence: ['1x1x3', '2x2x3', '1x1x3'],
  edit_to_done_ratio: 0.4,
  undo_count: 1,
  confidence_score: 0.7,
  drawer_size: '6x8x6',
  final_fill_pct: 60,
};

const DRIVERS: ReadonlyArray<readonly [string, (inc: Increments) => void]> = [
  ['aggregateBinPlacement', (i) => aggregators.aggregateBinPlacement(binPlacement, i)],
  ['aggregateLabelUpdate', (i) => aggregators.aggregateLabelUpdate(labelUpdate, i)],
  ['aggregateLayoutSnapshot', (i) => aggregators.aggregateLayoutSnapshot(layoutSnapshot, i)],
  ['aggregateQualitySignal', (i) => aggregators.aggregateQualitySignal(layoutQuality, i)],
  ['aggregateDrawerPurpose', (i) => aggregators.aggregateDrawerPurpose(drawerPurpose, i)],
  ['aggregateCategoryChange', (i) => aggregators.aggregateCategoryChange(categoryChange, i)],
  ['aggregateBinResize', (i) => aggregators.aggregateBinResize(binResize, i)],
  ['aggregateBinDeletion', (i) => aggregators.aggregateBinDeletion(binDeleted, i)],
  ['aggregateBinMove', (i) => aggregators.aggregateBinMove(binMoved, i)],
  ['aggregateDrawerResize', (i) => aggregators.aggregateDrawerResize(drawerResized, i)],
  ['aggregateFillOperation', (i) => aggregators.aggregateFillOperation(fillOperation, i)],
  ['aggregateLayerMove', (i) => aggregators.aggregateLayerMove(layerMove, i)],
  ['aggregateBinRotation', (i) => aggregators.aggregateBinRotation(binRotated, i)],
  [
    'aggregatePlacementRejection',
    (i) => aggregators.aggregatePlacementRejection(placementRejected, i),
  ],
  ['aggregateUndo', (i) => aggregators.aggregateUndo(undo, i)],
  ['aggregateQuickCorrection', (i) => aggregators.aggregateQuickCorrection(quickCorrection, i)],
  ['aggregateBinAbandonment', (i) => aggregators.aggregateBinAbandonment(abandonedBin, i)],
  [
    'aggregateCrossLayoutPattern',
    (i) => aggregators.aggregateCrossLayoutPattern(crossLayoutPattern, i),
  ],
  ['aggregateSessionSummary', (i) => aggregators.aggregateSessionSummary(sessionSummary, i)],
];

describe('aggregator retention coverage', () => {
  // Without this, adding an aggregator and forgetting a fixture leaves it
  // silently unexercised and the suite still passes.
  it('drives every exported aggregator', () => {
    const exported = Object.keys(aggregators)
      .filter((name) => name.startsWith('aggregate'))
      .sort();
    const driven = DRIVERS.map(([name]) => name).sort();

    expect(driven).toEqual(exported);
  });

  it.each(DRIVERS)('%s writes only expirable keys', (_name, drive) => {
    const inc: Increments = {};
    drive(inc);

    const keys = Object.keys(inc);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.filter((key) => !isExpiringAggregate(key))).toEqual([]);
  });

  it('writes no key that collides with a never-expired running total', () => {
    const inc: Increments = {};
    for (const [, drive] of DRIVERS) drive(inc);

    const collisions = Object.keys(inc).filter((key) => ML_LIFETIME_KEYS.has(key));
    expect(collisions).toEqual([]);
  });

  // Fixtures only reach the branches they happen to trigger, so the source is
  // read as well to cover key shapes behind conditions no fixture satisfies.
  //
  // Three write styles exist and all three must be matched. Most keys go
  // through `incr()`; eleven assign `inc['ml:...']` directly; three more
  // subscript a variable (`inc[purposeKey]`), which is resolved back to its
  // declaration below. A scan that knew only about `incr()` would pass
  // silently over the other fourteen.
  const readSource = () => readFileSync(new URL('./aggregators.ts', import.meta.url), 'utf8');
  const literalKeys = (source: string) => ({
    viaHelper: [...source.matchAll(/incr\(\s*inc\s*,\s*(['"`])([^'"`]*)/g)].map((m) => m[2]),
    viaSubscript: [...source.matchAll(/\binc\[\s*(['"`])([^'"`]*)/g)].map((m) => m[2]),
  });

  it('writes only ml:-prefixed literal keys', () => {
    const { viaHelper, viaSubscript } = literalKeys(readSource());
    const written = [...viaHelper, ...viaSubscript];

    // Anchored on known keys rather than counts, which drift on any refactor.
    expect(viaHelper).toContain('ml:sizes');
    expect(viaSubscript).toContain('ml:session:totals');
    expect(written.filter((key) => !key.startsWith('ml:'))).toEqual([]);
    expect(written.filter((key) => ML_LIFETIME_KEYS.has(key))).toEqual([]);
  });

  // The literal scan cannot see `inc[someKey]`. Rather than leave that as an
  // unstated gap, resolve each computed subscript to its `const` declaration
  // and assert the template it is built from. `key` is the parameter of the
  // `incr()` helper itself, whose call sites the literal scan already covers —
  // any *other* unresolved name means a new computed key slipped past both.
  it('writes only ml:-prefixed computed keys', () => {
    const source = readSource();
    const names = new Set(
      [...source.matchAll(/\binc\[\s*([A-Za-z_$][\w$]*)\s*\]/g)].map((m) => m[1])
    );

    const unresolved: string[] = [];
    const resolved: string[] = [];
    for (const name of names) {
      const decl = source.match(
        new RegExp(`\\bconst ${name}\\s*(?::[^=]+)?=\\s*(['"\`])([^'"\`]*)`)
      );
      if (decl) resolved.push(decl[2]);
      else unresolved.push(name);
    }

    expect(unresolved).toEqual(['key']);
    expect(resolved.length).toBeGreaterThan(0);
    expect(resolved.filter((key) => !key.startsWith('ml:'))).toEqual([]);
    expect(resolved.filter((key) => ML_LIFETIME_KEYS.has(key))).toEqual([]);
  });
});
