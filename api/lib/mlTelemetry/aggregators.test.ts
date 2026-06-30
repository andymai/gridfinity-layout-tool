import { describe, it, expect } from 'vitest';
import type { Increments } from './aggregators.js';
import {
  aggregateBinAbandonment,
  aggregateBinDeletion,
  aggregateBinMove,
  aggregateBinPlacement,
  aggregateBinResize,
  aggregateBinRotation,
  aggregateCategoryChange,
  aggregateCrossLayoutPattern,
  aggregateDrawerPurpose,
  aggregateDrawerResize,
  aggregateFillOperation,
  aggregateLabelUpdate,
  aggregateLayerMove,
  aggregateLayoutSnapshot,
  aggregatePlacementRejection,
  aggregateQualitySignal,
  aggregateQuickCorrection,
  aggregateSessionSummary,
  aggregateUndo,
} from './aggregators.js';
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

function freshInc(): Increments {
  return {};
}

/**
 * Assert that running `call` twice on the same Increments object doubles the
 * value at inc[key][field]. Requires the counter to be > 0 after the first
 * call, so callers must pass an event that actually writes to that counter.
 */
function assertAdditive(call: (inc: Increments) => void, key: string, field: string): void {
  const inc = freshInc();
  call(inc);
  const once = inc[key]?.[field] ?? 0;
  expect(once).toBeGreaterThan(0);
  call(inc);
  expect(inc[key]?.[field]).toBe(once * 2);
}

// ─────────────────────────────────────────────
// aggregateBinPlacement
// ─────────────────────────────────────────────
describe('aggregateBinPlacement', () => {
  const baseEvent: BinPlacementEvent = {
    type: 'bin_placed',
    bin_size: '2x3x4',
    prev_bin_size: null,
    drawer_size: '6x8x6',
    position: '0,0',
    layer_index: 0,
    largest_gap: '4x5',
    fill_pct: 50,
    gap_fit: 'exact',
    label_hash: null,
    label_normalized: null,
    label_domain: null,
    label_embedding_bucket: null,
    category_id: 'cat-01',
    adjacent_label_hashes: [],
    adjacent_sizes: [],
    adjacent_count: 0,
    recent_sizes: [],
    time_since_last_ms: null,
    is_first_of_label: false,
    method: 'draw',
    session_index: 0,
    vocab_version: 'v1',
  };

  it('increments global size frequency', () => {
    const inc = freshInc();
    aggregateBinPlacement(baseEvent, inc);
    expect(inc['ml:sizes']?.['2x3x4']).toBe(1);
  });

  it('increments drawer correlation', () => {
    const inc = freshInc();
    aggregateBinPlacement(baseEvent, inc);
    expect(inc['ml:drawer:6x8x6']?.['2x3x4']).toBe(1);
  });

  it('increments gap_fit bucket', () => {
    const inc = freshInc();
    aggregateBinPlacement(baseEvent, inc);
    expect(inc['ml:gapfit:exact']?.['2x3x4']).toBe(1);
  });

  it('increments placement method', () => {
    const inc = freshInc();
    aggregateBinPlacement(baseEvent, inc);
    expect(inc['ml:method:draw']?.['2x3x4']).toBe(1);
  });

  it('does not add transition matrix entry when prev_bin_size is null', () => {
    const inc = freshInc();
    aggregateBinPlacement(baseEvent, inc);
    const transKeys = Object.keys(inc).filter((k) => k.startsWith('ml:trans:'));
    expect(transKeys).toHaveLength(0);
  });

  it('adds transition matrix entry when prev_bin_size is set', () => {
    const inc = freshInc();
    aggregateBinPlacement({ ...baseEvent, prev_bin_size: '1x1x1' }, inc);
    expect(inc['ml:trans:1x1x1']?.['2x3x4']).toBe(1);
  });

  it('tracks unknown hash when label_hash set but no label_normalized', () => {
    const inc = freshInc();
    aggregateBinPlacement({ ...baseEvent, label_hash: 'abcd1234', label_normalized: null }, inc);
    expect(inc['ml:unknown_hashes']?.['abcd1234']).toBe(1);
    expect(inc['ml:label_hash:abcd1234']?.['2x3x4']).toBe(1);
  });

  it('does not add unknown_hashes when label_hash and label_normalized are both set', () => {
    const inc = freshInc();
    aggregateBinPlacement(
      { ...baseEvent, label_hash: 'abcd1234', label_normalized: 'screws' },
      inc
    );
    expect(inc['ml:unknown_hashes']).toBeUndefined();
    expect(inc['ml:label_hash:abcd1234']?.['2x3x4']).toBe(1);
    expect(inc['ml:label:screws']?.['2x3x4']).toBe(1);
  });

  it('tracks label_domain when set', () => {
    const inc = freshInc();
    aggregateBinPlacement({ ...baseEvent, label_domain: 'tools' }, inc);
    expect(inc['ml:label_domain:tools']?.['2x3x4']).toBe(1);
  });

  it('tracks embedding bucket when set', () => {
    const inc = freshInc();
    aggregateBinPlacement({ ...baseEvent, label_embedding_bucket: 'a1b2' }, inc);
    expect(inc['ml:embed:a1b2']?.['2x3x4']).toBe(1);
  });

  it('increments adjacent_count bucket for count < 4', () => {
    const inc = freshInc();
    aggregateBinPlacement({ ...baseEvent, adjacent_count: 2 }, inc);
    expect(inc['ml:adjacent_counts']?.['2']).toBe(1);
  });

  it('uses "4+" bucket for adjacent_count >= 4', () => {
    const inc = freshInc();
    aggregateBinPlacement({ ...baseEvent, adjacent_count: 4 }, inc);
    expect(inc['ml:adjacent_counts']?.['4+']).toBe(1);
  });

  it('tracks co-occurrence for adjacent label hashes in lexicographic order', () => {
    const inc = freshInc();
    aggregateBinPlacement(
      {
        ...baseEvent,
        label_hash: 'abcd1234',
        adjacent_label_hashes: ['zzzz9999'],
      },
      inc
    );
    // lexicographic: 'abcd1234' < 'zzzz9999', so key is 'ml:cooccur:abcd1234' → 'zzzz9999'
    expect(inc['ml:cooccur:abcd1234']?.['zzzz9999']).toBe(1);
  });

  it('does not track co-occurrence when label_hash is null', () => {
    const inc = freshInc();
    aggregateBinPlacement(
      { ...baseEvent, label_hash: null, adjacent_label_hashes: ['abcd1234'] },
      inc
    );
    const coKeys = Object.keys(inc).filter((k) => k.startsWith('ml:cooccur:'));
    expect(coKeys).toHaveLength(0);
  });

  it('tracks first-of-label when is_first_of_label is true and label_hash set', () => {
    const inc = freshInc();
    aggregateBinPlacement({ ...baseEvent, is_first_of_label: true, label_hash: 'abcd1234' }, inc);
    expect(inc['ml:first_label:abcd1234']?.['2x3x4']).toBe(1);
  });

  it('does not track first_label when is_first_of_label is false', () => {
    const inc = freshInc();
    aggregateBinPlacement({ ...baseEvent, is_first_of_label: false, label_hash: 'abcd1234' }, inc);
    expect(inc['ml:first_label:abcd1234']).toBeUndefined();
  });

  it('tracks recent size sequence when non-empty', () => {
    const inc = freshInc();
    aggregateBinPlacement({ ...baseEvent, recent_sizes: ['1x1x1', '2x2x2'] }, inc);
    expect(inc['ml:sequences']?.['1x1x1>2x2x2']).toBe(1);
  });

  it('does not track sequences when recent_sizes is empty', () => {
    const inc = freshInc();
    aggregateBinPlacement({ ...baseEvent, recent_sizes: [] }, inc);
    expect(inc['ml:sequences']).toBeUndefined();
  });

  it('is additive — calling twice doubles ml:sizes counter', () => {
    const inc = freshInc();
    aggregateBinPlacement(baseEvent, inc);
    aggregateBinPlacement(baseEvent, inc);
    expect(inc['ml:sizes']?.['2x3x4']).toBe(2);
  });
});

// ─────────────────────────────────────────────
// aggregateLabelUpdate
// ─────────────────────────────────────────────
describe('aggregateLabelUpdate', () => {
  const baseEvent: LabelUpdateEvent = {
    type: 'label_updated',
    bin_size: '1x2x3',
    old_label_hash: null,
    old_label_normalized: null,
    new_label_hash: null,
    new_label_normalized: null,
    new_label_domain: null,
    new_label_embedding_bucket: null,
    vocab_version: 'v1',
  };

  it('does not throw or increment anything when all new fields are null', () => {
    const inc = freshInc();
    aggregateLabelUpdate(baseEvent, inc);
    expect(Object.keys(inc)).toHaveLength(0);
  });

  it('tracks new_label_hash and unknown_hashes when no normalized label', () => {
    const inc = freshInc();
    aggregateLabelUpdate({ ...baseEvent, new_label_hash: 'deadbeef' }, inc);
    expect(inc['ml:label_hash:deadbeef']?.['1x2x3']).toBe(1);
    expect(inc['ml:unknown_hashes']?.['deadbeef']).toBe(1);
  });

  it('tracks new_label_hash without unknown_hashes when normalized label is set', () => {
    const inc = freshInc();
    aggregateLabelUpdate(
      { ...baseEvent, new_label_hash: 'deadbeef', new_label_normalized: 'bolts' },
      inc
    );
    expect(inc['ml:label_hash:deadbeef']?.['1x2x3']).toBe(1);
    expect(inc['ml:unknown_hashes']).toBeUndefined();
  });

  it('tracks normalized label', () => {
    const inc = freshInc();
    aggregateLabelUpdate({ ...baseEvent, new_label_normalized: 'bolts' }, inc);
    expect(inc['ml:label:bolts']?.['1x2x3']).toBe(1);
  });

  it('tracks domain', () => {
    const inc = freshInc();
    aggregateLabelUpdate({ ...baseEvent, new_label_domain: 'fasteners' }, inc);
    expect(inc['ml:label_domain:fasteners']?.['1x2x3']).toBe(1);
  });

  it('tracks embedding bucket', () => {
    const inc = freshInc();
    aggregateLabelUpdate({ ...baseEvent, new_label_embedding_bucket: 'ff00' }, inc);
    expect(inc['ml:embed:ff00']?.['1x2x3']).toBe(1);
  });

  it('is additive — label_hash counter doubles on second call', () => {
    // Use a non-null field so the aggregator actually writes something
    assertAdditive(
      (inc) => aggregateLabelUpdate({ ...baseEvent, new_label_hash: 'deadbeef' }, inc),
      'ml:label_hash:deadbeef',
      '1x2x3'
    );
  });
});

// ─────────────────────────────────────────────
// aggregateLayoutSnapshot
// ─────────────────────────────────────────────
describe('aggregateLayoutSnapshot', () => {
  const baseEvent: LayoutSnapshotEvent = {
    type: 'layout_snapshot',
    trigger: 'save',
    layout_hash: 'aabbccdd',
    snapshot_index: 0,
    drawer_size: '6x8x6',
    layer_count: 1,
    purpose: null,
    bin_count: 5,
    size_distribution: { '2x2x3': 3, '1x1x1': 2 },
    category_distribution: { 'cat-01': 5 },
    domain_distribution: { tools: 3, misc: 2 },
    top_label_hashes: [],
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

  it('tracks size distribution entries with counts', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot(baseEvent, inc);
    expect(inc['ml:drawer_sizes:6x8x6']?.['2x2x3']).toBe(3);
    expect(inc['ml:drawer_sizes:6x8x6']?.['1x1x1']).toBe(2);
  });

  it('tracks domain distribution entries', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot(baseEvent, inc);
    expect(inc['ml:domains:6x8x6']?.['tools']).toBe(3);
    expect(inc['ml:domains:6x8x6']?.['misc']).toBe(2);
  });

  it('tracks snapshot trigger', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot(baseEvent, inc);
    expect(inc['ml:triggers']?.['save']).toBe(1);
  });

  it('does not increment purpose when purpose is null', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot(baseEvent, inc);
    expect(inc['ml:purpose']).toBeUndefined();
  });

  it('tracks purpose and purpose_sizes when purpose is set', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot({ ...baseEvent, purpose: 'workshop' }, inc);
    expect(inc['ml:purpose']?.['workshop']).toBe(1);
    expect(inc['ml:purpose_sizes:workshop']?.['2x2x3']).toBe(3);
  });

  it('places fill_percentage=0 in bucket 0', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot({ ...baseEvent, fill_percentage: 0 }, inc);
    expect(inc['ml:fill_bucket:0']?.['6x8x6']).toBe(1);
  });

  it('places fill_percentage=100 in bucket 3 (capped)', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot({ ...baseEvent, fill_percentage: 100 }, inc);
    expect(inc['ml:fill_bucket:3']?.['6x8x6']).toBe(1);
  });

  it('tracks quality_tier', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot(baseEvent, inc);
    expect(inc['ml:quality_tier']?.['medium']).toBe(1);
  });

  it('populates tier_sizes for medium quality', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot(baseEvent, inc);
    expect(inc['ml:tier_sizes:medium']?.['2x2x3']).toBe(3);
  });

  it('does not populate tier_sizes for low quality', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot({ ...baseEvent, quality_tier: 'low' }, inc);
    expect(inc['ml:tier_sizes:low']).toBeUndefined();
  });

  it('populates label_hash_high only for high quality with label_size_pairs', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot(
      {
        ...baseEvent,
        quality_tier: 'high',
        label_size_pairs: [{ hash: 'abcd1234', size: '2x2x3' }],
      },
      inc
    );
    expect(inc['ml:label_hash_high:abcd1234']?.['2x2x3']).toBe(1);
  });

  it('does not populate label_hash_high for medium quality', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot(
      {
        ...baseEvent,
        quality_tier: 'medium',
        label_size_pairs: [{ hash: 'abcd1234', size: '2x2x3' }],
      },
      inc
    );
    expect(inc['ml:label_hash_high:abcd1234']).toBeUndefined();
  });

  it('builds bidirectional co-occurrence matrix from top_label_hashes', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot(
      { ...baseEvent, top_label_hashes: ['aaaa1111', 'bbbb2222', 'cccc3333'] },
      inc
    );
    expect(inc['ml:cooccur:aaaa1111']?.['bbbb2222']).toBe(1);
    expect(inc['ml:cooccur:bbbb2222']?.['aaaa1111']).toBe(1);
    expect(inc['ml:cooccur:aaaa1111']?.['cccc3333']).toBe(1);
  });

  it('tracks archetype', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot(baseEvent, inc);
    expect(inc['ml:archetype']?.['mixed']).toBe(1);
    expect(inc['ml:archetype:6x8x6']?.['mixed']).toBe(1);
  });

  it('tracks spatial patterns', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot(baseEvent, inc);
    expect(inc['ml:patterns']?.['corner_start']).toBe(1);
    expect(inc['ml:patterns:mixed']?.['corner_start']).toBe(1);
  });

  it('tracks uniformity bucket from score', () => {
    const inc = freshInc();
    // uniformity_score=0.5 → Math.floor(0.5 * 4) = 2 → 'bucket_2'
    aggregateLayoutSnapshot({ ...baseEvent, uniformity_score: 0.5 }, inc);
    expect(inc['ml:uniformity']?.['bucket_2']).toBe(1);
  });

  it('tracks edge count from edge_usage', () => {
    const inc = freshInc();
    // left=true, right=false, top=true, bottom=false → 2 edges
    aggregateLayoutSnapshot(baseEvent, inc);
    expect(inc['ml:edge_count']?.['edges_2']).toBe(1);
    expect(inc['ml:edge_combo']?.['LT']).toBe(1);
  });

  it('uses "none" edge combo when no edges are active', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot(
      { ...baseEvent, edge_usage: { left: false, right: false, top: false, bottom: false } },
      inc
    );
    expect(inc['ml:edge_combo']?.['none']).toBe(1);
  });

  it('tracks hour and day of week', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot(baseEvent, inc);
    expect(inc['ml:temporal:hour:14']?.['count']).toBe(1);
    expect(inc['ml:temporal:day:3']?.['count']).toBe(1);
  });

  it('tracks weekday vs weekend', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot(baseEvent, inc);
    expect(inc['ml:temporal:weekday']?.['weekday']).toBe(1);

    const inc2 = freshInc();
    aggregateLayoutSnapshot({ ...baseEvent, is_weekend: true }, inc2);
    expect(inc2['ml:temporal:weekday']?.['weekend']).toBe(1);
  });

  it('tracks structure hash cluster distribution', () => {
    const inc = freshInc();
    aggregateLayoutSnapshot(baseEvent, inc);
    expect(inc['ml:cluster_distribution']?.['12345678']).toBe(1);
    expect(inc['ml:cluster_archetypes:12345678']?.['mixed']).toBe(1);
    expect(inc['ml:clusters:12345678']?.['2x2x3']).toBe(3);
  });

  it('is additive — trigger counter doubles on second call', () => {
    assertAdditive((inc) => aggregateLayoutSnapshot(baseEvent, inc), 'ml:triggers', 'save');
  });
});

// ─────────────────────────────────────────────
// aggregateQualitySignal
// ─────────────────────────────────────────────
describe('aggregateQualitySignal', () => {
  const baseEvent: LayoutQualityEvent = {
    type: 'layout_quality',
    layout_hash: 'aabbccdd',
    signal: 'shared',
    days_since_creation: 0,
    abandonment_type: null,
    time_since_last_edit_ms: 0,
  };

  it('tracks quality signal', () => {
    const inc = freshInc();
    aggregateQualitySignal(baseEvent, inc);
    expect(inc['ml:quality']?.['shared']).toBe(1);
  });

  it('places days_since_creation=0 in day1 bucket', () => {
    const inc = freshInc();
    aggregateQualitySignal(baseEvent, inc);
    expect(inc['ml:quality_age:shared']?.['day1']).toBe(1);
  });

  it('places days_since_creation=7 in week1 bucket', () => {
    const inc = freshInc();
    aggregateQualitySignal({ ...baseEvent, days_since_creation: 7 }, inc);
    expect(inc['ml:quality_age:shared']?.['week1']).toBe(1);
  });

  it('places days_since_creation=31 in older bucket', () => {
    const inc = freshInc();
    aggregateQualitySignal({ ...baseEvent, days_since_creation: 31 }, inc);
    expect(inc['ml:quality_age:shared']?.['older']).toBe(1);
  });

  it('skips confidence tracking when confidence_breakdown is absent', () => {
    const inc = freshInc();
    aggregateQualitySignal(baseEvent, inc);
    expect(inc['ml:quality_confidence']).toBeUndefined();
  });

  it('tracks confidence bucket from combined score', () => {
    const inc = freshInc();
    const breakdown = {
      undo_score: 0.8,
      completion_score: 0.8,
      session_score: 0.8,
      correction_score: 0.8,
      combined: 0.8,
    };
    aggregateQualitySignal({ ...baseEvent, confidence_breakdown: breakdown }, inc);
    expect(inc['ml:quality_confidence']?.['high']).toBe(1);
    expect(inc['ml:quality_conf_by_signal:shared']?.['high']).toBe(1);
  });

  it('maps combined=0.1 to very_low confidence', () => {
    const inc = freshInc();
    const breakdown = {
      undo_score: 0.1,
      completion_score: 0.1,
      session_score: 0.1,
      correction_score: 0.1,
      combined: 0.1,
    };
    aggregateQualitySignal({ ...baseEvent, confidence_breakdown: breakdown }, inc);
    expect(inc['ml:quality_confidence']?.['very_low']).toBe(1);
  });

  it('skips abandonment tracking when abandonment_type is null', () => {
    const inc = freshInc();
    aggregateQualitySignal(baseEvent, inc);
    expect(inc['ml:abandonment']).toBeUndefined();
  });

  it('tracks abandonment type when set', () => {
    const inc = freshInc();
    aggregateQualitySignal({ ...baseEvent, abandonment_type: 'incomplete' }, inc);
    expect(inc['ml:abandonment']?.['incomplete']).toBe(1);
  });

  it('classifies dormancy: active (<60s)', () => {
    const inc = freshInc();
    aggregateQualitySignal({ ...baseEvent, time_since_last_edit_ms: 30000 }, inc);
    expect(inc['ml:quality_dormancy']?.['active']).toBe(1);
  });

  it('classifies dormancy: dormant (>=30min)', () => {
    const inc = freshInc();
    aggregateQualitySignal({ ...baseEvent, time_since_last_edit_ms: 1_800_000 }, inc);
    expect(inc['ml:quality_dormancy']?.['dormant']).toBe(1);
  });

  it('is additive — quality signal counter doubles on second call', () => {
    assertAdditive((inc) => aggregateQualitySignal(baseEvent, inc), 'ml:quality', 'shared');
  });
});

// ─────────────────────────────────────────────
// aggregateDrawerPurpose
// ─────────────────────────────────────────────
describe('aggregateDrawerPurpose', () => {
  const baseEvent: DrawerPurposeEvent = {
    type: 'drawer_purpose',
    layout_hash: 'aabbccdd',
    purpose: 'workshop',
    is_custom: false,
  };

  it('tracks purpose frequency', () => {
    const inc = freshInc();
    aggregateDrawerPurpose(baseEvent, inc);
    expect(inc['ml:purpose']?.['workshop']).toBe(1);
  });

  it('marks predefined when is_custom is false', () => {
    const inc = freshInc();
    aggregateDrawerPurpose(baseEvent, inc);
    expect(inc['ml:purpose_type']?.['predefined']).toBe(1);
  });

  it('marks custom when is_custom is true', () => {
    const inc = freshInc();
    aggregateDrawerPurpose({ ...baseEvent, is_custom: true }, inc);
    expect(inc['ml:purpose_type']?.['custom']).toBe(1);
  });

  it('is additive', () => {
    const inc = freshInc();
    aggregateDrawerPurpose(baseEvent, inc);
    aggregateDrawerPurpose(baseEvent, inc);
    expect(inc['ml:purpose']?.['workshop']).toBe(2);
  });
});

// ─────────────────────────────────────────────
// aggregateCategoryChange
// ─────────────────────────────────────────────
describe('aggregateCategoryChange', () => {
  const baseEvent: CategoryChangeEvent = {
    type: 'category_changed',
    bin_size: '2x2x3',
    category_name_hash: 'abcd1234',
    batch_size: 1,
    label_hash: null,
    label_domain: null,
    vocab_version: 'v1',
  };

  it('tracks cat_sizes by category_name_hash', () => {
    const inc = freshInc();
    aggregateCategoryChange(baseEvent, inc);
    expect(inc['ml:cat_sizes:abcd1234']?.['2x2x3']).toBe(1);
  });

  it('tracks total category change events', () => {
    const inc = freshInc();
    aggregateCategoryChange(baseEvent, inc);
    expect(inc['ml:cat_changes']?.['total']).toBe(1);
  });

  it('skips label_cat when label_hash is null', () => {
    const inc = freshInc();
    aggregateCategoryChange(baseEvent, inc);
    expect(inc['ml:label_cat:abcd1234']).toBeUndefined();
  });

  it('tracks label_cat when label_hash is set', () => {
    const inc = freshInc();
    aggregateCategoryChange({ ...baseEvent, label_hash: 'deadbeef' }, inc);
    expect(inc['ml:label_cat:deadbeef']?.['abcd1234']).toBe(1);
  });

  it('tracks domain_cat when label_domain is set', () => {
    const inc = freshInc();
    aggregateCategoryChange({ ...baseEvent, label_domain: 'tools' }, inc);
    expect(inc['ml:domain_cat:tools']?.['abcd1234']).toBe(1);
  });

  it('is additive — total category change counter doubles on second call', () => {
    assertAdditive((inc) => aggregateCategoryChange(baseEvent, inc), 'ml:cat_changes', 'total');
  });
});

// ─────────────────────────────────────────────
// aggregateBinResize
// ─────────────────────────────────────────────
describe('aggregateBinResize', () => {
  const baseEvent: BinResizeEvent = {
    type: 'bin_resized',
    old_size: '1x1x3',
    new_size: '2x1x3',
    dimensions_changed: ['width'],
    batch_size: 1,
    fill_pct: 40,
    resize_direction: 'grow',
    area_delta: 1,
  };

  it('tracks resize transition', () => {
    const inc = freshInc();
    aggregateBinResize(baseEvent, inc);
    expect(inc['ml:resize:1x1x3']?.['2x1x3']).toBe(1);
  });

  it('tracks resize_results', () => {
    const inc = freshInc();
    aggregateBinResize(baseEvent, inc);
    expect(inc['ml:resize_results']?.['2x1x3']).toBe(1);
  });

  it('tracks each changed dimension', () => {
    const inc = freshInc();
    aggregateBinResize({ ...baseEvent, dimensions_changed: ['width', 'depth'] }, inc);
    expect(inc['ml:resize_dims']?.['width']).toBe(1);
    expect(inc['ml:resize_dims']?.['depth']).toBe(1);
  });

  it('tracks total resizes', () => {
    const inc = freshInc();
    aggregateBinResize(baseEvent, inc);
    expect(inc['ml:resizes']?.['total']).toBe(1);
  });

  it('tracks resize direction', () => {
    const inc = freshInc();
    aggregateBinResize(baseEvent, inc);
    expect(inc['ml:resize_direction']?.['grow']).toBe(1);
  });

  it('encodes positive area_delta with "+" prefix', () => {
    const inc = freshInc();
    // area_delta=1, abs=1, bucket='0-1', prefix='+'
    aggregateBinResize({ ...baseEvent, area_delta: 1 }, inc);
    expect(inc['ml:resize_delta']?.['+0-1']).toBe(1);
  });

  it('encodes negative area_delta with "-" prefix', () => {
    const inc = freshInc();
    // area_delta=-5, abs=5, bucket='4-9', prefix='-'
    aggregateBinResize({ ...baseEvent, area_delta: -5 }, inc);
    expect(inc['ml:resize_delta']?.['-4-9']).toBe(1);
  });

  it('encodes zero area_delta with no prefix', () => {
    const inc = freshInc();
    // area_delta=0, abs=0, bucket='0', prefix=''
    aggregateBinResize({ ...baseEvent, area_delta: 0 }, inc);
    expect(inc['ml:resize_delta']?.['0']).toBe(1);
  });

  it('places large area_delta in "9+" bucket', () => {
    const inc = freshInc();
    aggregateBinResize({ ...baseEvent, area_delta: 20 }, inc);
    expect(inc['ml:resize_delta']?.['+9+']).toBe(1);
  });

  it('is additive — total resize counter doubles on second call', () => {
    assertAdditive((inc) => aggregateBinResize(baseEvent, inc), 'ml:resizes', 'total');
  });
});

// ─────────────────────────────────────────────
// aggregateBinDeletion
// ─────────────────────────────────────────────
describe('aggregateBinDeletion', () => {
  const baseEvent: BinDeletedEvent = {
    type: 'bin_deleted',
    bin_size: '2x2x3',
    position: '1,2',
    layer_index: 0,
    had_label: false,
    label_domain: null,
    age_ms: null,
    batch_size: 1,
    fill_pct: 30,
    method: 'key',
  };

  it('tracks deleted size', () => {
    const inc = freshInc();
    aggregateBinDeletion(baseEvent, inc);
    expect(inc['ml:neg:deleted_sizes']?.['2x2x3']).toBe(1);
  });

  it('tracks delete method', () => {
    const inc = freshInc();
    aggregateBinDeletion(baseEvent, inc);
    expect(inc['ml:neg:delete_methods']?.['key']).toBe(1);
  });

  it('marks unlabeled when had_label is false', () => {
    const inc = freshInc();
    aggregateBinDeletion(baseEvent, inc);
    expect(inc['ml:neg:delete_labeled']?.['unlabeled']).toBe(1);
  });

  it('marks labeled when had_label is true', () => {
    const inc = freshInc();
    aggregateBinDeletion({ ...baseEvent, had_label: true }, inc);
    expect(inc['ml:neg:delete_labeled']?.['labeled']).toBe(1);
  });

  it('skips domain tracking when label_domain is null', () => {
    const inc = freshInc();
    aggregateBinDeletion(baseEvent, inc);
    const domainKeys = Object.keys(inc).filter((k) => k.startsWith('ml:neg:delete_domain:'));
    expect(domainKeys).toHaveLength(0);
  });

  it('tracks domain deletion when label_domain is set', () => {
    const inc = freshInc();
    aggregateBinDeletion({ ...baseEvent, label_domain: 'tools' }, inc);
    expect(inc['ml:neg:delete_domain:tools']?.['2x2x3']).toBe(1);
  });

  it('tracks total deletions', () => {
    const inc = freshInc();
    aggregateBinDeletion(baseEvent, inc);
    expect(inc['ml:neg:deletions']?.['total']).toBe(1);
  });

  it('is additive — total deletion counter doubles on second call', () => {
    assertAdditive((inc) => aggregateBinDeletion(baseEvent, inc), 'ml:neg:deletions', 'total');
  });
});

// ─────────────────────────────────────────────
// aggregateBinMove
// ─────────────────────────────────────────────
describe('aggregateBinMove', () => {
  const baseEvent: BinMovedEvent = {
    type: 'bin_moved',
    bin_size: '2x2x3',
    old_position: '0,0',
    new_position: '2,2',
    distance: 1,
    layer_index: 0,
    batch_size: 1,
    method: 'drag',
  };

  it('tracks moved size', () => {
    const inc = freshInc();
    aggregateBinMove(baseEvent, inc);
    expect(inc['ml:moved_sizes']?.['2x2x3']).toBe(1);
  });

  it('tracks move method', () => {
    const inc = freshInc();
    aggregateBinMove(baseEvent, inc);
    expect(inc['ml:move_methods']?.['drag']).toBe(1);
  });

  it('classifies distance=1 as micro', () => {
    const inc = freshInc();
    aggregateBinMove({ ...baseEvent, distance: 1 }, inc);
    expect(inc['ml:move_distances']?.['micro']).toBe(1);
  });

  it('classifies distance=2 as short', () => {
    const inc = freshInc();
    aggregateBinMove({ ...baseEvent, distance: 2 }, inc);
    expect(inc['ml:move_distances']?.['short']).toBe(1);
  });

  it('classifies distance=9 as medium', () => {
    const inc = freshInc();
    aggregateBinMove({ ...baseEvent, distance: 9 }, inc);
    expect(inc['ml:move_distances']?.['medium']).toBe(1);
  });

  it('classifies distance=10 as long', () => {
    const inc = freshInc();
    aggregateBinMove({ ...baseEvent, distance: 10 }, inc);
    expect(inc['ml:move_distances']?.['long']).toBe(1);
  });

  it('tracks total moves', () => {
    const inc = freshInc();
    aggregateBinMove(baseEvent, inc);
    expect(inc['ml:moves']?.['total']).toBe(1);
  });

  it('is additive — total move counter doubles on second call', () => {
    assertAdditive((inc) => aggregateBinMove(baseEvent, inc), 'ml:moves', 'total');
  });
});

// ─────────────────────────────────────────────
// aggregateDrawerResize
// ─────────────────────────────────────────────
describe('aggregateDrawerResize', () => {
  const baseEvent: DrawerResizedEvent = {
    type: 'drawer_resized',
    old_size: '4x4x6',
    new_size: '6x6x6',
    dimensions_changed: ['width', 'depth'],
    bins_staged: 0,
    fill_pct: 20,
  };

  it('tracks drawer resize transition', () => {
    const inc = freshInc();
    aggregateDrawerResize(baseEvent, inc);
    expect(inc['ml:drawer_resize:4x4x6']?.['6x6x6']).toBe(1);
  });

  it('tracks changed dimensions', () => {
    const inc = freshInc();
    aggregateDrawerResize(baseEvent, inc);
    expect(inc['ml:drawer_resize_dims']?.['width']).toBe(1);
    expect(inc['ml:drawer_resize_dims']?.['depth']).toBe(1);
  });

  it('marks no_bins when bins_staged is 0', () => {
    const inc = freshInc();
    aggregateDrawerResize(baseEvent, inc);
    expect(inc['ml:drawer_resize_staged']?.['no_bins']).toBe(1);
  });

  it('marks with_bins when bins_staged > 0', () => {
    const inc = freshInc();
    aggregateDrawerResize({ ...baseEvent, bins_staged: 3 }, inc);
    expect(inc['ml:drawer_resize_staged']?.['with_bins']).toBe(1);
  });

  it('tracks total drawer resizes', () => {
    const inc = freshInc();
    aggregateDrawerResize(baseEvent, inc);
    expect(inc['ml:drawer_resizes']?.['total']).toBe(1);
  });

  it('tracks resulting drawer size', () => {
    const inc = freshInc();
    aggregateDrawerResize(baseEvent, inc);
    expect(inc['ml:drawer_resize_results']?.['6x6x6']).toBe(1);
  });

  it('is additive — total drawer resize counter doubles on second call', () => {
    assertAdditive((inc) => aggregateDrawerResize(baseEvent, inc), 'ml:drawer_resizes', 'total');
  });
});

// ─────────────────────────────────────────────
// aggregateFillOperation
// ─────────────────────────────────────────────
describe('aggregateFillOperation', () => {
  const baseEvent: FillOperationEvent = {
    type: 'fill_operation',
    method: 'uniform',
    fill_size: '2x2',
    bins_created: 5,
    layer_index: 0,
    fill_pct: 80,
    drawer_size: '6x8x6',
  };

  it('tracks fill method', () => {
    const inc = freshInc();
    aggregateFillOperation(baseEvent, inc);
    expect(inc['ml:fill_methods']?.['uniform']).toBe(1);
  });

  it('tracks fill_size and fill_by_drawer when fill_size is set', () => {
    const inc = freshInc();
    aggregateFillOperation(baseEvent, inc);
    expect(inc['ml:fill_sizes']?.['2x2']).toBe(1);
    expect(inc['ml:fill_by_drawer:6x8x6']?.['2x2']).toBe(1);
  });

  it('skips fill_sizes when fill_size is null', () => {
    const inc = freshInc();
    aggregateFillOperation({ ...baseEvent, fill_size: null }, inc);
    expect(inc['ml:fill_sizes']).toBeUndefined();
  });

  it('classifies bins_created <= 10 as small', () => {
    const inc = freshInc();
    aggregateFillOperation({ ...baseEvent, bins_created: 5 }, inc);
    expect(inc['ml:fill_bins']?.['small']).toBe(1);
  });

  it('classifies bins_created <= 50 as medium', () => {
    const inc = freshInc();
    aggregateFillOperation({ ...baseEvent, bins_created: 25 }, inc);
    expect(inc['ml:fill_bins']?.['medium']).toBe(1);
  });

  it('classifies bins_created <= 100 as large', () => {
    const inc = freshInc();
    aggregateFillOperation({ ...baseEvent, bins_created: 75 }, inc);
    expect(inc['ml:fill_bins']?.['large']).toBe(1);
  });

  it('classifies bins_created > 100 as xlarge', () => {
    const inc = freshInc();
    aggregateFillOperation({ ...baseEvent, bins_created: 200 }, inc);
    expect(inc['ml:fill_bins']?.['xlarge']).toBe(1);
  });

  it('tracks total fills', () => {
    const inc = freshInc();
    aggregateFillOperation(baseEvent, inc);
    expect(inc['ml:fills']?.['total']).toBe(1);
  });

  it('is additive — total fill counter doubles on second call', () => {
    assertAdditive((inc) => aggregateFillOperation(baseEvent, inc), 'ml:fills', 'total');
  });
});

// ─────────────────────────────────────────────
// aggregateLayerMove
// ─────────────────────────────────────────────
describe('aggregateLayerMove', () => {
  const baseEvent: LayerMoveEvent = {
    type: 'layer_move',
    bin_size: '1x2x3',
    from_layer_index: 0,
    to_layer_index: 1,
    batch_size: 1,
    method: 'drag',
  };

  it('tracks layer transition from->to', () => {
    const inc = freshInc();
    aggregateLayerMove(baseEvent, inc);
    expect(inc['ml:layer_trans:layer0']?.['layer1']).toBe(1);
  });

  it('tracks layer_moved_sizes', () => {
    const inc = freshInc();
    aggregateLayerMove(baseEvent, inc);
    expect(inc['ml:layer_moved_sizes']?.['1x2x3']).toBe(1);
  });

  it('tracks layer move method', () => {
    const inc = freshInc();
    aggregateLayerMove(baseEvent, inc);
    expect(inc['ml:layer_move_methods']?.['drag']).toBe(1);
  });

  it('uses "staging" key for from_layer_index=-1 and tracks staging_out', () => {
    const inc = freshInc();
    aggregateLayerMove({ ...baseEvent, from_layer_index: -1 }, inc);
    expect(inc['ml:layer_trans:staging']?.['layer1']).toBe(1);
    expect(inc['ml:staging_out']?.['layer1']).toBe(1);
  });

  it('uses "staging" key for to_layer_index=-1 and tracks staging_in', () => {
    const inc = freshInc();
    aggregateLayerMove({ ...baseEvent, to_layer_index: -1 }, inc);
    expect(inc['ml:layer_trans:layer0']?.['staging']).toBe(1);
    expect(inc['ml:staging_in']?.['layer0']).toBe(1);
  });

  it('does not set staging_out for normal layer moves', () => {
    const inc = freshInc();
    aggregateLayerMove(baseEvent, inc);
    expect(inc['ml:staging_out']).toBeUndefined();
  });

  it('tracks total layer moves', () => {
    const inc = freshInc();
    aggregateLayerMove(baseEvent, inc);
    expect(inc['ml:layer_moves']?.['total']).toBe(1);
  });

  it('is additive — total layer move counter doubles on second call', () => {
    assertAdditive((inc) => aggregateLayerMove(baseEvent, inc), 'ml:layer_moves', 'total');
  });
});

// ─────────────────────────────────────────────
// aggregateBinRotation
// ─────────────────────────────────────────────
describe('aggregateBinRotation', () => {
  const baseEvent: BinRotatedEvent = {
    type: 'bin_rotated',
    old_size: '1x3x4',
    new_size: '3x1x4',
    batch_size: 1,
  };

  it('tracks rotation transition', () => {
    const inc = freshInc();
    aggregateBinRotation(baseEvent, inc);
    expect(inc['ml:rotate:1x3x4']?.['3x1x4']).toBe(1);
  });

  it('tracks total rotations', () => {
    const inc = freshInc();
    aggregateBinRotation(baseEvent, inc);
    expect(inc['ml:rotations']?.['total']).toBe(1);
  });

  it('tracks rotated_sizes by old_size', () => {
    const inc = freshInc();
    aggregateBinRotation(baseEvent, inc);
    expect(inc['ml:rotated_sizes']?.['1x3x4']).toBe(1);
  });

  it('is additive', () => {
    const inc = freshInc();
    aggregateBinRotation(baseEvent, inc);
    aggregateBinRotation(baseEvent, inc);
    expect(inc['ml:rotations']?.['total']).toBe(2);
  });
});

// ─────────────────────────────────────────────
// aggregatePlacementRejection
// ─────────────────────────────────────────────
describe('aggregatePlacementRejection', () => {
  const baseEvent: PlacementRejectedEvent = {
    type: 'placement_rejected',
    rejection_reason: 'cancelled',
    intended_size: null,
    intended_position: null,
    layer_index: 0,
    drawer_size: '6x8x6',
    fill_pct: 50,
    mode: 'draw',
  };

  it('tracks rejection reason in ml:rejections', () => {
    const inc = freshInc();
    aggregatePlacementRejection(baseEvent, inc);
    expect(inc['ml:rejections']?.['cancelled']).toBe(1);
  });

  it('increments ml:rejections total on every call', () => {
    const inc = freshInc();
    aggregatePlacementRejection(baseEvent, inc);
    expect(inc['ml:rejections']?.['total']).toBe(1);
  });

  it('tracks reject mode', () => {
    const inc = freshInc();
    aggregatePlacementRejection(baseEvent, inc);
    expect(inc['ml:reject_modes']?.['draw']).toBe(1);
  });

  it('skips reject_sizes when intended_size is null', () => {
    const inc = freshInc();
    aggregatePlacementRejection(baseEvent, inc);
    expect(inc['ml:reject_sizes']).toBeUndefined();
  });

  it('tracks reject_sizes and neg:reject_by_drawer when intended_size is set', () => {
    const inc = freshInc();
    aggregatePlacementRejection({ ...baseEvent, intended_size: '2x3' }, inc);
    expect(inc['ml:reject_sizes']?.['2x3']).toBe(1);
    expect(inc['ml:neg:reject_by_drawer:6x8x6']?.['2x3']).toBe(1);
  });

  it('is additive — total rejection counter doubles on second call', () => {
    assertAdditive((inc) => aggregatePlacementRejection(baseEvent, inc), 'ml:rejections', 'total');
  });
});

// ─────────────────────────────────────────────
// aggregateUndo
// ─────────────────────────────────────────────
describe('aggregateUndo', () => {
  const baseEvent: UndoEvent = {
    type: 'undo',
    action_undone: 'placement',
    bins_affected: 1,
    time_since_action_ms: 500,
    drawer_size: '6x8x6',
  };

  it('tracks the undone action', () => {
    const inc = freshInc();
    aggregateUndo(baseEvent, inc);
    expect(inc['ml:neg:undos']?.['placement']).toBe(1);
  });

  it('tracks total undos', () => {
    const inc = freshInc();
    aggregateUndo(baseEvent, inc);
    expect(inc['ml:neg:undos']?.['total']).toBe(1);
  });

  it('classifies time < 2000ms as immediate', () => {
    const inc = freshInc();
    aggregateUndo({ ...baseEvent, time_since_action_ms: 1500 }, inc);
    expect(inc['ml:neg:undo_timing']?.['immediate']).toBe(1);
    expect(inc['ml:neg:undo_action_timing']?.['placement_immediate']).toBe(1);
  });

  it('classifies time between 2000ms and 9999ms as quick', () => {
    const inc = freshInc();
    aggregateUndo({ ...baseEvent, time_since_action_ms: 5000 }, inc);
    expect(inc['ml:neg:undo_timing']?.['quick']).toBe(1);
  });

  it('classifies time >= 10000ms as delayed', () => {
    const inc = freshInc();
    aggregateUndo({ ...baseEvent, time_since_action_ms: 15000 }, inc);
    expect(inc['ml:neg:undo_timing']?.['delayed']).toBe(1);
  });

  it('classifies bins_affected=1 as single', () => {
    const inc = freshInc();
    aggregateUndo({ ...baseEvent, bins_affected: 1 }, inc);
    expect(inc['ml:neg:undo_scale']?.['single']).toBe(1);
  });

  it('classifies bins_affected=5 as few', () => {
    const inc = freshInc();
    aggregateUndo({ ...baseEvent, bins_affected: 5 }, inc);
    expect(inc['ml:neg:undo_scale']?.['few']).toBe(1);
  });

  it('classifies bins_affected=21 as bulk', () => {
    const inc = freshInc();
    aggregateUndo({ ...baseEvent, bins_affected: 21 }, inc);
    expect(inc['ml:neg:undo_scale']?.['bulk']).toBe(1);
  });

  it('is additive — total undo counter doubles on second call', () => {
    assertAdditive((inc) => aggregateUndo(baseEvent, inc), 'ml:neg:undos', 'total');
  });
});

// ─────────────────────────────────────────────
// aggregateQuickCorrection
// ─────────────────────────────────────────────
describe('aggregateQuickCorrection', () => {
  const baseEvent: QuickCorrectionEvent = {
    type: 'quick_correction',
    correction_type: 'delete',
    original_size: '2x2x3',
    new_size: null,
    placement_method: 'draw',
    time_to_correction_ms: 2000,
    layer_index: 0,
  };

  it('tracks correction type', () => {
    const inc = freshInc();
    aggregateQuickCorrection(baseEvent, inc);
    expect(inc['ml:neg:quick_corrections']?.['delete']).toBe(1);
  });

  it('tracks corrected size as negative signal', () => {
    const inc = freshInc();
    aggregateQuickCorrection(baseEvent, inc);
    expect(inc['ml:neg:corrected_sizes']?.['2x2x3']).toBe(1);
  });

  it('tracks correct_by_method', () => {
    const inc = freshInc();
    aggregateQuickCorrection(baseEvent, inc);
    expect(inc['ml:neg:correct_by_method:draw']?.['delete']).toBe(1);
  });

  it('classifies time < 5000ms as very_quick', () => {
    const inc = freshInc();
    aggregateQuickCorrection({ ...baseEvent, time_to_correction_ms: 2000 }, inc);
    expect(inc['ml:neg:correction_timing']?.['very_quick']).toBe(1);
  });

  it('classifies time between 5000ms and 14999ms as quick', () => {
    const inc = freshInc();
    aggregateQuickCorrection({ ...baseEvent, time_to_correction_ms: 10000 }, inc);
    expect(inc['ml:neg:correction_timing']?.['quick']).toBe(1);
  });

  it('classifies time >= 15000ms as considered', () => {
    const inc = freshInc();
    aggregateQuickCorrection({ ...baseEvent, time_to_correction_ms: 20000 }, inc);
    expect(inc['ml:neg:correction_timing']?.['considered']).toBe(1);
  });

  it('tracks resize_correct transition when correction_type=resize and new_size set', () => {
    const inc = freshInc();
    aggregateQuickCorrection({ ...baseEvent, correction_type: 'resize', new_size: '3x3x3' }, inc);
    expect(inc['ml:neg:resize_correct:2x2x3']?.['3x3x3']).toBe(1);
  });

  it('does not track resize_correct for delete correction', () => {
    const inc = freshInc();
    aggregateQuickCorrection(baseEvent, inc);
    expect(inc['ml:neg:resize_correct:2x2x3']).toBeUndefined();
  });

  it('tracks total quick corrections', () => {
    const inc = freshInc();
    aggregateQuickCorrection(baseEvent, inc);
    expect(inc['ml:neg:quick_corrections']?.['total']).toBe(1);
  });

  it('is additive — total quick correction counter doubles on second call', () => {
    assertAdditive(
      (inc) => aggregateQuickCorrection(baseEvent, inc),
      'ml:neg:quick_corrections',
      'total'
    );
  });
});

// ─────────────────────────────────────────────
// aggregateBinAbandonment
// ─────────────────────────────────────────────
describe('aggregateBinAbandonment', () => {
  const baseEvent: AbandonedBinEvent = {
    type: 'bin_abandoned',
    bin_size: '1x1x3',
    position: '3,4',
    layer_index: 0,
    lifetime_ms: 30000,
    creation_method: 'draw',
    fill_pct: 20,
    drawer_size: '6x8x6',
  };

  it('tracks abandoned size as negative signal', () => {
    const inc = freshInc();
    aggregateBinAbandonment(baseEvent, inc);
    expect(inc['ml:neg:abandoned_sizes']?.['1x1x3']).toBe(1);
  });

  it('tracks abandoned_by_method', () => {
    const inc = freshInc();
    aggregateBinAbandonment(baseEvent, inc);
    expect(inc['ml:neg:abandoned_by_method:draw']?.['1x1x3']).toBe(1);
  });

  it('classifies lifetime < 60000ms as <1min', () => {
    const inc = freshInc();
    aggregateBinAbandonment({ ...baseEvent, lifetime_ms: 30000 }, inc);
    expect(inc['ml:neg:abandon_lifetime']?.['<1min']).toBe(1);
  });

  it('classifies lifetime between 60000ms and 299999ms as 1-5min', () => {
    const inc = freshInc();
    aggregateBinAbandonment({ ...baseEvent, lifetime_ms: 120000 }, inc);
    expect(inc['ml:neg:abandon_lifetime']?.['1-5min']).toBe(1);
  });

  it('classifies lifetime between 300000ms and 1799999ms as 5-30min', () => {
    const inc = freshInc();
    aggregateBinAbandonment({ ...baseEvent, lifetime_ms: 600000 }, inc);
    expect(inc['ml:neg:abandon_lifetime']?.['5-30min']).toBe(1);
  });

  it('classifies lifetime >= 1800000ms as >30min', () => {
    const inc = freshInc();
    aggregateBinAbandonment({ ...baseEvent, lifetime_ms: 1800000 }, inc);
    expect(inc['ml:neg:abandon_lifetime']?.['>30min']).toBe(1);
  });

  it('tracks abandoned_by_drawer', () => {
    const inc = freshInc();
    aggregateBinAbandonment(baseEvent, inc);
    expect(inc['ml:neg:abandoned_by_drawer:6x8x6']?.['1x1x3']).toBe(1);
  });

  it('tracks abandonment_total', () => {
    const inc = freshInc();
    aggregateBinAbandonment(baseEvent, inc);
    expect(inc['ml:neg:abandonment_total']?.['total']).toBe(1);
  });

  it('is additive — total abandonment counter doubles on second call', () => {
    assertAdditive(
      (inc) => aggregateBinAbandonment(baseEvent, inc),
      'ml:neg:abandonment_total',
      'total'
    );
  });
});

// ─────────────────────────────────────────────
// aggregateCrossLayoutPattern
// ─────────────────────────────────────────────
describe('aggregateCrossLayoutPattern', () => {
  const baseEvent: CrossLayoutPatternEvent = {
    type: 'cross_layout_pattern',
    user_hash: 'anonymous',
    label_size_consistency: [],
    inferred_purpose: null,
    inferred_purpose_confidence: 0.5,
    drawer_size: '6x8x6',
  };

  it('does not add inferred_purpose key when inferred_purpose is null', () => {
    const inc = freshInc();
    aggregateCrossLayoutPattern(baseEvent, inc);
    expect(inc['ml:inferred_purpose:6x8x6']).toBeUndefined();
  });

  it('tracks inferred_purpose by drawer_size when set', () => {
    const inc = freshInc();
    aggregateCrossLayoutPattern({ ...baseEvent, inferred_purpose: 'workshop' }, inc);
    expect(inc['ml:inferred_purpose:6x8x6']?.['workshop']).toBe(1);
  });

  it('classifies confidence < 0.4 as low', () => {
    const inc = freshInc();
    aggregateCrossLayoutPattern({ ...baseEvent, inferred_purpose_confidence: 0.3 }, inc);
    expect(inc['ml:purpose_confidence']?.['low']).toBe(1);
  });

  it('classifies confidence 0.5 as medium', () => {
    const inc = freshInc();
    aggregateCrossLayoutPattern(baseEvent, inc);
    expect(inc['ml:purpose_confidence']?.['medium']).toBe(1);
  });

  it('classifies confidence >= 0.7 as high', () => {
    const inc = freshInc();
    aggregateCrossLayoutPattern({ ...baseEvent, inferred_purpose_confidence: 0.9 }, inc);
    expect(inc['ml:purpose_confidence']?.['high']).toBe(1);
  });

  it('counts consistent and inconsistent labels', () => {
    const inc = freshInc();
    aggregateCrossLayoutPattern(
      {
        ...baseEvent,
        label_size_consistency: [
          { label_hash: 'aaaa1111', sizes_used: ['1x1x3'], is_consistent: true },
          { label_hash: 'bbbb2222', sizes_used: ['2x2x3', '1x1x3'], is_consistent: false },
        ],
      },
      inc
    );
    expect(inc['ml:label_consistency']?.['consistent']).toBe(1);
    expect(inc['ml:label_consistency']?.['inconsistent']).toBe(1);
  });

  it('tracks sizes_used for inconsistent labels', () => {
    const inc = freshInc();
    aggregateCrossLayoutPattern(
      {
        ...baseEvent,
        label_size_consistency: [
          { label_hash: 'bbbb2222', sizes_used: ['2x2x3', '1x1x3'], is_consistent: false },
        ],
      },
      inc
    );
    expect(inc['ml:inconsistent_sizes']?.['2x2x3']).toBe(1);
    expect(inc['ml:inconsistent_sizes']?.['1x1x3']).toBe(1);
  });

  it('does not track inconsistent_sizes for consistent labels', () => {
    const inc = freshInc();
    aggregateCrossLayoutPattern(
      {
        ...baseEvent,
        label_size_consistency: [
          { label_hash: 'aaaa1111', sizes_used: ['1x1x3'], is_consistent: true },
        ],
      },
      inc
    );
    expect(inc['ml:inconsistent_sizes']).toBeUndefined();
  });

  it('increments cross_layout_total', () => {
    const inc = freshInc();
    aggregateCrossLayoutPattern(baseEvent, inc);
    expect(inc['ml:cross_layout_total']?.['total']).toBe(1);
  });

  it('is additive for cross_layout_total', () => {
    const inc = freshInc();
    aggregateCrossLayoutPattern(baseEvent, inc);
    aggregateCrossLayoutPattern(baseEvent, inc);
    expect(inc['ml:cross_layout_total']?.['total']).toBe(2);
  });
});

// ─────────────────────────────────────────────
// aggregateSessionSummary
// ─────────────────────────────────────────────
describe('aggregateSessionSummary', () => {
  const baseEvent: SessionSummaryEvent = {
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

  it('tracks bins_placed in correct bucket', () => {
    const inc = freshInc();
    aggregateSessionSummary(baseEvent, inc);
    expect(inc['ml:session:bins_placed']?.['1-5']).toBe(1);
  });

  it('bins_placed=0 goes in "0" bucket', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, bins_placed: 0 }, inc);
    expect(inc['ml:session:bins_placed']?.['0']).toBe(1);
  });

  it('bins_placed=51 goes in "51+" bucket', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, bins_placed: 51 }, inc);
    expect(inc['ml:session:bins_placed']?.['51+']).toBe(1);
  });

  it('tracks edit_to_done_ratio=0 in "zero" bucket', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, edit_to_done_ratio: 0 }, inc);
    expect(inc['ml:session:edit_ratio']?.['zero']).toBe(1);
  });

  it('tracks edit_to_done_ratio=0.4 in "medium" bucket', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, edit_to_done_ratio: 0.4 }, inc);
    expect(inc['ml:session:edit_ratio']?.['medium']).toBe(1);
  });

  it('tracks edit_to_done_ratio=0.7 in "high" bucket', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, edit_to_done_ratio: 0.7 }, inc);
    expect(inc['ml:session:edit_ratio']?.['high']).toBe(1);
  });

  it('classifies time_to_first_bin_ms=5000 as quick', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, time_to_first_bin_ms: 5000 }, inc);
    expect(inc['ml:session:time_to_first']?.['quick']).toBe(1);
  });

  it('classifies time_to_first_bin_ms=60000 as slow', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, time_to_first_bin_ms: 60000 }, inc);
    expect(inc['ml:session:time_to_first']?.['slow']).toBe(1);
  });

  it('skips time_to_first tracking when time_to_first_bin_ms is null', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, time_to_first_bin_ms: null }, inc);
    expect(inc['ml:session:time_to_first']).toBeUndefined();
  });

  it('classifies confidence_score=0.7 as high', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, confidence_score: 0.7 }, inc);
    expect(inc['ml:session:confidence']?.['high']).toBe(1);
  });

  it('classifies confidence_score=0.1 as very_low', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, confidence_score: 0.1 }, inc);
    expect(inc['ml:session:confidence']?.['very_low']).toBe(1);
  });

  it('classifies confidence_score=0.9 as very_high', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, confidence_score: 0.9 }, inc);
    expect(inc['ml:session:confidence']?.['very_high']).toBe(1);
  });

  it('classifies session_duration_ms < 60s as <1min', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, session_duration_ms: 30000 }, inc);
    expect(inc['ml:session:duration']?.['<1min']).toBe(1);
  });

  it('classifies session_duration_ms >= 1800s as 30min+', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, session_duration_ms: 1_800_000 }, inc);
    expect(inc['ml:session:duration']?.['30min+']).toBe(1);
  });

  it('tracks size sequence when >= 2 sizes', () => {
    const inc = freshInc();
    aggregateSessionSummary(baseEvent, inc);
    expect(inc['ml:size_seq:6x8x6']?.['1x1x3>2x2x3>1x1x3']).toBe(1);
  });

  it('skips size sequence when < 2 sizes', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, size_sequence: ['1x1x3'] }, inc);
    expect(inc['ml:size_seq:6x8x6']).toBeUndefined();
  });

  it('limits sequence to first 5 sizes', () => {
    const inc = freshInc();
    aggregateSessionSummary(
      {
        ...baseEvent,
        size_sequence: ['1x1x3', '2x2x3', '3x3x3', '4x4x3', '5x5x3', '6x6x3'],
      },
      inc
    );
    // Only first 5 are used
    expect(inc['ml:size_seq:6x8x6']?.['1x1x3>2x2x3>3x3x3>4x4x3>5x5x3']).toBe(1);
  });

  it('classifies undo_count=0 in "0" bucket', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, undo_count: 0 }, inc);
    expect(inc['ml:session:undo_count']?.['0']).toBe(1);
  });

  it('classifies undo_count=6 in "6+" bucket', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, undo_count: 6 }, inc);
    expect(inc['ml:session:undo_count']?.['6+']).toBe(1);
  });

  it('tracks confidence by drawer', () => {
    const inc = freshInc();
    aggregateSessionSummary({ ...baseEvent, confidence_score: 0.7 }, inc);
    expect(inc['ml:session:conf_by_drawer:6x8x6']?.['high']).toBe(1);
  });

  it('tracks total sessions', () => {
    const inc = freshInc();
    aggregateSessionSummary(baseEvent, inc);
    expect(inc['ml:session:totals']?.['total']).toBe(1);
  });

  it('is additive for total sessions', () => {
    const inc = freshInc();
    aggregateSessionSummary(baseEvent, inc);
    aggregateSessionSummary(baseEvent, inc);
    expect(inc['ml:session:totals']?.['total']).toBe(2);
  });
});
