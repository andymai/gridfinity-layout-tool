import { describe, it, expect } from 'vitest';
import { validateEvent } from './validators.js';
import type { MLTelemetryEvent } from './types.js';

// ─────────────────────────────────────────────
// Shared valid field values
// ─────────────────────────────────────────────
const BIN_SIZE = '2x3x4'; // matches VALID_BIN_SIZE_REGEX
const DRAWER_SIZE = '6x8x6'; // matches VALID_DRAWER_SIZE_REGEX
const FILL_SIZE = '2x3'; // matches VALID_FILL_SIZE_REGEX (WxD, no height)
const LABEL_HASH = 'abcd1234'; // 8-char hex
const LAYOUT_HASH = '12345678'; // 8-char hex
const STRUCTURE_HASH = 'aabbccdd'; // 8-char hex
const POSITION = '3,5'; // matches VALID_POSITION_REGEX
const CATEGORY_ID = 'cat-01'; // matches VALID_CATEGORY_ID_REGEX
const NORMALIZED_LABEL = 'screws'; // matches VALID_NORMALIZED_LABEL_REGEX
const EMBEDDING_BUCKET = 'a1b2'; // 4-char hex

// ─────────────────────────────────────────────
// Structural guard
// ─────────────────────────────────────────────
describe('validateEvent — structural guard', () => {
  it('rejects null', () => {
    expect(validateEvent(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(validateEvent(undefined)).toBe(false);
  });

  it('rejects a string', () => {
    expect(validateEvent('bin_placed')).toBe(false);
  });

  it('rejects a number', () => {
    expect(validateEvent(42)).toBe(false);
  });

  it('rejects an empty object (no type)', () => {
    expect(validateEvent({})).toBe(false);
  });

  it('rejects an object with an unknown type', () => {
    expect(validateEvent({ type: 'unknown_event' })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// TypeScript narrowing
// ─────────────────────────────────────────────
describe('validateEvent — TypeScript narrowing', () => {
  it('narrows unknown to MLTelemetryEvent inside the guard', () => {
    const raw: unknown = {
      type: 'bin_rotated',
      old_size: BIN_SIZE,
      new_size: '3x2x4',
      batch_size: 1,
    };
    if (validateEvent(raw)) {
      // TypeScript accepts this assignment — the guard narrowed the type
      const typed: MLTelemetryEvent = raw;
      expect(typed.type).toBe('bin_rotated');
    } else {
      expect.fail('Expected validateEvent to return true');
    }
  });
});

// ─────────────────────────────────────────────
// bin_placed
// ─────────────────────────────────────────────
describe('validateEvent — bin_placed', () => {
  const valid = {
    type: 'bin_placed',
    bin_size: BIN_SIZE,
    prev_bin_size: null,
    drawer_size: DRAWER_SIZE,
    position: POSITION,
    layer_index: 0,
    largest_gap: FILL_SIZE,
    fill_pct: 50,
    gap_fit: 'exact',
    label_hash: null,
    label_normalized: null,
    label_domain: null,
    label_embedding_bucket: null,
    category_id: CATEGORY_ID,
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

  it('accepts a fully valid bin_placed event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts with prev_bin_size set', () => {
    expect(validateEvent({ ...valid, prev_bin_size: BIN_SIZE })).toBe(true);
  });

  it('accepts with optional label fields set', () => {
    expect(
      validateEvent({
        ...valid,
        label_hash: LABEL_HASH,
        label_normalized: NORMALIZED_LABEL,
        label_domain: 'tools',
        label_embedding_bucket: EMBEDDING_BUCKET,
      })
    ).toBe(true);
  });

  it('accepts time_since_last_ms as a valid number', () => {
    expect(validateEvent({ ...valid, time_since_last_ms: 5000 })).toBe(true);
  });

  it('rejects invalid bin_size format', () => {
    expect(validateEvent({ ...valid, bin_size: 'bad_size' })).toBe(false);
  });

  it('rejects invalid gap_fit value', () => {
    expect(validateEvent({ ...valid, gap_fit: 'perfect' })).toBe(false);
  });

  it('rejects invalid method value', () => {
    expect(validateEvent({ ...valid, method: 'teleport' })).toBe(false);
  });

  it('rejects invalid category_id with special chars', () => {
    expect(validateEvent({ ...valid, category_id: '../../etc' })).toBe(false);
  });

  it('rejects label_hash that is not 8-char hex', () => {
    expect(validateEvent({ ...valid, label_hash: 'tooshort' })).toBe(false);
  });

  it('rejects label_domain that is not in the allowed set', () => {
    expect(validateEvent({ ...valid, label_domain: 'malicious_domain' })).toBe(false);
  });

  it('rejects adjacent_label_hashes with more than 8 entries', () => {
    expect(
      validateEvent({
        ...valid,
        adjacent_label_hashes: Array.from({ length: 9 }, () => LABEL_HASH),
      })
    ).toBe(false);
  });

  it('rejects is_first_of_label that is not a boolean', () => {
    expect(validateEvent({ ...valid, is_first_of_label: 1 })).toBe(false);
  });

  it('rejects time_since_last_ms >= 86400000', () => {
    expect(validateEvent({ ...valid, time_since_last_ms: 86400000 })).toBe(false);
  });

  it('rejects negative session_index', () => {
    expect(validateEvent({ ...valid, session_index: -1 })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// bin_placed — documented validator leniency
//
// validateEvent() deliberately skips several BinPlacementEvent fields.
// The validator focuses on fields used as Redis keys (injection-sensitive)
// and routing fields. Numeric/positional fields that don't reach Redis keys
// are left unchecked. These tests document the CURRENT leniency so that any
// future tightening is a conscious, explicitly-reviewed change.
//
// Absence tests: each starts from `completeValid` and omits ONLY the field
// under test — genuinely isolating that specific field's absence.
//
// Content tests: each starts from `completeValid` and sets the field to a
// bogus value of the wrong type — documenting that the validator ignores
// the field's content entirely, not just its presence.
// ─────────────────────────────────────────────
describe('validateEvent — bin_placed (documented validator leniency)', () => {
  // All checked fields present, PLUS all five currently-unvalidated fields.
  const completeValid = {
    type: 'bin_placed',
    bin_size: BIN_SIZE,
    prev_bin_size: null,
    drawer_size: DRAWER_SIZE,
    gap_fit: 'exact',
    method: 'draw',
    session_index: 0,
    label_hash: null,
    label_normalized: null,
    label_domain: null,
    label_embedding_bucket: null,
    category_id: CATEGORY_ID,
    adjacent_label_hashes: [],
    adjacent_sizes: [],
    adjacent_count: 0,
    recent_sizes: [],
    time_since_last_ms: null,
    is_first_of_label: false,
    // The five currently-unvalidated fields:
    position: POSITION,
    layer_index: 0,
    largest_gap: FILL_SIZE,
    fill_pct: 50,
    vocab_version: 'v1',
  };

  it('passes when all five unvalidated fields are absent at once', () => {
    // Baseline: confirm that leaving out ALL five still satisfies the validator.
    const {
      position: _pos,
      layer_index: _li,
      largest_gap: _lg,
      fill_pct: _fp,
      vocab_version: _vv,
      ...withoutAll
    } = completeValid;
    expect(validateEvent(withoutAll)).toBe(true);
  });

  it('passes when only position is absent (field not validated)', () => {
    // position is stored on the event but never interpolated into a Redis key.
    const { position: _pos, ...rest } = completeValid;
    expect(validateEvent(rest)).toBe(true);
  });

  it('passes when only layer_index is absent (field not validated)', () => {
    const { layer_index: _li, ...rest } = completeValid;
    expect(validateEvent(rest)).toBe(true);
  });

  it('passes when only largest_gap is absent (field not validated)', () => {
    const { largest_gap: _lg, ...rest } = completeValid;
    expect(validateEvent(rest)).toBe(true);
  });

  it('passes when only fill_pct is absent (field not validated)', () => {
    const { fill_pct: _fp, ...rest } = completeValid;
    expect(validateEvent(rest)).toBe(true);
  });

  it('passes when only vocab_version is absent (field not validated)', () => {
    const { vocab_version: _vv, ...rest } = completeValid;
    expect(validateEvent(rest)).toBe(true);
  });

  it('ignores a bogus position value (field content not validated)', () => {
    expect(validateEvent({ ...completeValid, position: 'not-a-position' })).toBe(true);
  });

  it('ignores a bogus layer_index value (field content not validated)', () => {
    expect(validateEvent({ ...completeValid, layer_index: 'x' })).toBe(true);
  });

  it('ignores a bogus largest_gap value (field content not validated)', () => {
    expect(validateEvent({ ...completeValid, largest_gap: {} })).toBe(true);
  });

  it('ignores a bogus fill_pct value (field content not validated)', () => {
    expect(validateEvent({ ...completeValid, fill_pct: 'high' })).toBe(true);
  });

  it('ignores a bogus vocab_version value (field content not validated)', () => {
    expect(validateEvent({ ...completeValid, vocab_version: [] })).toBe(true);
  });
});

// ─────────────────────────────────────────────
// label_updated
// ─────────────────────────────────────────────
describe('validateEvent — label_updated', () => {
  const valid = {
    type: 'label_updated',
    bin_size: BIN_SIZE,
    old_label_hash: null,
    old_label_normalized: null,
    new_label_hash: null,
    new_label_normalized: null,
    new_label_domain: null,
    new_label_embedding_bucket: null,
    vocab_version: 'v1',
  };

  it('accepts a valid label_updated event with all nulls', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts with label fields set', () => {
    expect(
      validateEvent({
        ...valid,
        new_label_hash: LABEL_HASH,
        new_label_normalized: NORMALIZED_LABEL,
        new_label_domain: 'tools',
        new_label_embedding_bucket: EMBEDDING_BUCKET,
      })
    ).toBe(true);
  });

  it('rejects invalid bin_size', () => {
    expect(validateEvent({ ...valid, bin_size: '2x3' })).toBe(false);
  });

  it('rejects new_label_hash not matching hex pattern', () => {
    expect(validateEvent({ ...valid, new_label_hash: 'ABCDEFGH' })).toBe(false);
  });

  it('rejects new_label_domain not in allowed set', () => {
    expect(validateEvent({ ...valid, new_label_domain: 'weapons' })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// layout_snapshot
// ─────────────────────────────────────────────
describe('validateEvent — layout_snapshot', () => {
  const valid = {
    type: 'layout_snapshot',
    trigger: 'save',
    layout_hash: LAYOUT_HASH,
    snapshot_index: 0,
    drawer_size: DRAWER_SIZE,
    layer_count: 1,
    purpose: null,
    bin_count: 5,
    size_distribution: { [BIN_SIZE]: 3 },
    category_distribution: { [CATEGORY_ID]: 5 },
    domain_distribution: { tools: 3 },
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
    structure_hash: STRUCTURE_HASH,
    vocab_version: 'v1',
  };

  it('accepts a valid layout_snapshot event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts with optional label_size_pairs', () => {
    expect(
      validateEvent({
        ...valid,
        label_size_pairs: [{ hash: LABEL_HASH, size: BIN_SIZE }],
      })
    ).toBe(true);
  });

  it('accepts with purpose set to a known value', () => {
    expect(validateEvent({ ...valid, purpose: 'workshop' })).toBe(true);
  });

  it('accepts with a custom purpose matching the regex', () => {
    expect(validateEvent({ ...valid, purpose: 'my_custom_purpose' })).toBe(true);
  });

  it('rejects invalid trigger', () => {
    expect(validateEvent({ ...valid, trigger: 'random' })).toBe(false);
  });

  it('rejects invalid layout_hash format', () => {
    expect(validateEvent({ ...valid, layout_hash: 'not-a-hash' })).toBe(false);
  });

  it('rejects invalid archetype', () => {
    expect(validateEvent({ ...valid, archetype: 'chaotic' })).toBe(false);
  });

  it('rejects spatial_patterns with more than 10 entries', () => {
    expect(
      validateEvent({
        ...valid,
        spatial_patterns: Array.from({ length: 11 }, () => 'corner_start'),
      })
    ).toBe(false);
  });

  it('rejects invalid spatial_pattern value', () => {
    expect(validateEvent({ ...valid, spatial_patterns: ['diagonal_fill'] })).toBe(false);
  });

  it('rejects uniformity_score > 1', () => {
    expect(validateEvent({ ...valid, uniformity_score: 1.1 })).toBe(false);
  });

  it('rejects edge_usage with missing field', () => {
    expect(
      validateEvent({
        ...valid,
        edge_usage: { left: true, right: false, top: true },
      })
    ).toBe(false);
  });

  it('rejects hour_of_day > 23', () => {
    expect(validateEvent({ ...valid, hour_of_day: 24 })).toBe(false);
  });

  it('rejects day_of_week > 6', () => {
    expect(validateEvent({ ...valid, day_of_week: 7 })).toBe(false);
  });

  it('rejects structure_hash not matching 8-char hex', () => {
    expect(validateEvent({ ...valid, structure_hash: 'gggggggg' })).toBe(false);
  });

  it('rejects size_distribution with a negative value', () => {
    expect(validateEvent({ ...valid, size_distribution: { [BIN_SIZE]: -1 } })).toBe(false);
  });

  it('rejects label_size_pairs with more than 500 entries', () => {
    const pairs = Array.from({ length: 501 }, () => ({ hash: LABEL_HASH, size: BIN_SIZE }));
    expect(validateEvent({ ...valid, label_size_pairs: pairs })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// layout_quality
// ─────────────────────────────────────────────
describe('validateEvent — layout_quality', () => {
  const valid = {
    type: 'layout_quality',
    layout_hash: LAYOUT_HASH,
    signal: 'shared',
    days_since_creation: 3,
    abandonment_type: null,
    time_since_last_edit_ms: 5000,
  };

  it('accepts a valid layout_quality event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts with optional confidence_breakdown', () => {
    expect(
      validateEvent({
        ...valid,
        confidence_breakdown: {
          undo_score: 0.8,
          completion_score: 0.9,
          session_score: 0.7,
          correction_score: 1.0,
          combined: 0.85,
        },
      })
    ).toBe(true);
  });

  it('accepts with abandonment_type set', () => {
    expect(validateEvent({ ...valid, abandonment_type: 'incomplete' })).toBe(true);
  });

  it('rejects invalid signal', () => {
    expect(validateEvent({ ...valid, signal: 'liked' })).toBe(false);
  });

  it('rejects invalid abandonment_type', () => {
    expect(validateEvent({ ...valid, abandonment_type: 'maybe' })).toBe(false);
  });

  it('rejects confidence_breakdown with score > 1', () => {
    expect(
      validateEvent({
        ...valid,
        confidence_breakdown: {
          undo_score: 1.5,
          completion_score: 0.9,
          session_score: 0.7,
          correction_score: 1.0,
          combined: 0.85,
        },
      })
    ).toBe(false);
  });

  it('rejects confidence_breakdown with missing field', () => {
    expect(
      validateEvent({
        ...valid,
        confidence_breakdown: {
          undo_score: 0.8,
          completion_score: 0.9,
          session_score: 0.7,
          correction_score: 1.0,
          // missing combined
        },
      })
    ).toBe(false);
  });

  it('rejects time_since_last_edit_ms >= 86400000', () => {
    expect(validateEvent({ ...valid, time_since_last_edit_ms: 86400000 })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// drawer_purpose
// ─────────────────────────────────────────────
describe('validateEvent — drawer_purpose', () => {
  const valid = {
    type: 'drawer_purpose',
    layout_hash: LAYOUT_HASH,
    purpose: 'workshop',
    is_custom: false,
  };

  it('accepts a valid drawer_purpose event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts a custom purpose matching the regex', () => {
    expect(validateEvent({ ...valid, purpose: 'my_workshop_v2', is_custom: true })).toBe(true);
  });

  it('rejects purpose that is not in allowed set and not a valid custom string', () => {
    expect(validateEvent({ ...valid, purpose: 'WORKSHOP' })).toBe(false);
  });

  it('rejects invalid layout_hash', () => {
    expect(validateEvent({ ...valid, layout_hash: 'too-long-hash-value' })).toBe(false);
  });

  it('rejects non-boolean is_custom', () => {
    expect(validateEvent({ ...valid, is_custom: 'true' })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// category_changed
// ─────────────────────────────────────────────
describe('validateEvent — category_changed', () => {
  const valid = {
    type: 'category_changed',
    bin_size: BIN_SIZE,
    category_name_hash: LABEL_HASH,
    batch_size: 1,
    label_hash: null,
    label_domain: null,
    vocab_version: 'v1',
  };

  it('accepts a valid category_changed event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts with optional label_hash and domain', () => {
    expect(
      validateEvent({
        ...valid,
        label_hash: LABEL_HASH,
        label_domain: 'tools',
      })
    ).toBe(true);
  });

  it('rejects batch_size of 0', () => {
    expect(validateEvent({ ...valid, batch_size: 0 })).toBe(false);
  });

  it('rejects batch_size >= 1000', () => {
    expect(validateEvent({ ...valid, batch_size: 1000 })).toBe(false);
  });

  it('rejects category_name_hash not matching 8-char hex', () => {
    expect(validateEvent({ ...valid, category_name_hash: 'ABCD1234' })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// bin_resized
// ─────────────────────────────────────────────
describe('validateEvent — bin_resized', () => {
  const valid = {
    type: 'bin_resized',
    old_size: BIN_SIZE,
    new_size: '3x3x4',
    dimensions_changed: ['width'],
    batch_size: 1,
    fill_pct: 40,
    resize_direction: 'grow',
    area_delta: 3,
  };

  it('accepts a valid bin_resized event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts both dimensions changed', () => {
    expect(validateEvent({ ...valid, dimensions_changed: ['width', 'depth'] })).toBe(true);
  });

  it('rejects empty dimensions_changed array', () => {
    expect(validateEvent({ ...valid, dimensions_changed: [] })).toBe(false);
  });

  it('rejects invalid dimension value', () => {
    expect(validateEvent({ ...valid, dimensions_changed: ['height'] })).toBe(false);
  });

  it('rejects invalid resize_direction', () => {
    expect(validateEvent({ ...valid, resize_direction: 'sideways' })).toBe(false);
  });

  it('rejects area_delta >= 10000', () => {
    expect(validateEvent({ ...valid, area_delta: 10000 })).toBe(false);
  });

  it('rejects fill_pct > 100', () => {
    expect(validateEvent({ ...valid, fill_pct: 101 })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// bin_deleted
// ─────────────────────────────────────────────
describe('validateEvent — bin_deleted', () => {
  const valid = {
    type: 'bin_deleted',
    bin_size: BIN_SIZE,
    position: POSITION,
    layer_index: 0,
    had_label: false,
    label_domain: null,
    age_ms: null,
    batch_size: 1,
    fill_pct: 30,
    method: 'key',
  };

  it('accepts a valid bin_deleted event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts with optional age_ms set', () => {
    expect(validateEvent({ ...valid, age_ms: 5000 })).toBe(true);
  });

  it('rejects invalid method', () => {
    expect(validateEvent({ ...valid, method: 'swipe' })).toBe(false);
  });

  it('rejects invalid position format', () => {
    expect(validateEvent({ ...valid, position: '3-5' })).toBe(false);
  });

  it('rejects layer_index > 20', () => {
    expect(validateEvent({ ...valid, layer_index: 21 })).toBe(false);
  });

  it('rejects non-boolean had_label', () => {
    expect(validateEvent({ ...valid, had_label: 1 })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// bin_moved
// ─────────────────────────────────────────────
describe('validateEvent — bin_moved', () => {
  const valid = {
    type: 'bin_moved',
    bin_size: BIN_SIZE,
    old_position: POSITION,
    new_position: '5,7',
    distance: 4,
    layer_index: 0,
    batch_size: 1,
    method: 'drag',
  };

  it('accepts a valid bin_moved event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts nudge method', () => {
    expect(validateEvent({ ...valid, method: 'nudge' })).toBe(true);
  });

  it('rejects invalid move method', () => {
    expect(validateEvent({ ...valid, method: 'teleport' })).toBe(false);
  });

  it('rejects distance >= 1000', () => {
    expect(validateEvent({ ...valid, distance: 1000 })).toBe(false);
  });

  it('rejects invalid position format', () => {
    expect(validateEvent({ ...valid, old_position: 'x,y' })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// drawer_resized
// ─────────────────────────────────────────────
describe('validateEvent — drawer_resized', () => {
  const valid = {
    type: 'drawer_resized',
    old_size: DRAWER_SIZE,
    new_size: '8x10x6',
    dimensions_changed: ['width'],
    bins_staged: 0,
    fill_pct: 20,
  };

  it('accepts a valid drawer_resized event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts height as a changed dimension', () => {
    expect(validateEvent({ ...valid, dimensions_changed: ['height'] })).toBe(true);
  });

  it('rejects empty dimensions_changed', () => {
    expect(validateEvent({ ...valid, dimensions_changed: [] })).toBe(false);
  });

  it('rejects invalid dimension value', () => {
    expect(validateEvent({ ...valid, dimensions_changed: ['diagonal'] })).toBe(false);
  });

  it('rejects bins_staged < 0', () => {
    expect(validateEvent({ ...valid, bins_staged: -1 })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// fill_operation
// ─────────────────────────────────────────────
describe('validateEvent — fill_operation', () => {
  const valid = {
    type: 'fill_operation',
    method: 'uniform',
    fill_size: FILL_SIZE,
    bins_created: 5,
    layer_index: 0,
    fill_pct: 80,
    drawer_size: DRAWER_SIZE,
  };

  it('accepts a valid fill_operation event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts gaps method with null fill_size', () => {
    expect(validateEvent({ ...valid, method: 'gaps', fill_size: null })).toBe(true);
  });

  it('rejects bins_created = 0', () => {
    expect(validateEvent({ ...valid, bins_created: 0 })).toBe(false);
  });

  it('rejects invalid fill method', () => {
    expect(validateEvent({ ...valid, method: 'random' })).toBe(false);
  });

  it('rejects fill_size with wrong format (3D instead of 2D)', () => {
    expect(validateEvent({ ...valid, fill_size: BIN_SIZE })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// layer_move
// ─────────────────────────────────────────────
describe('validateEvent — layer_move', () => {
  const valid = {
    type: 'layer_move',
    bin_size: BIN_SIZE,
    from_layer_index: 0,
    to_layer_index: 1,
    batch_size: 1,
    method: 'drag',
  };

  it('accepts a valid layer_move event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts from_layer_index = -1 (staging)', () => {
    expect(validateEvent({ ...valid, from_layer_index: -1 })).toBe(true);
  });

  it('accepts to_layer_index = -1 (staging)', () => {
    expect(validateEvent({ ...valid, to_layer_index: -1 })).toBe(true);
  });

  it('rejects from_layer_index < -1', () => {
    expect(validateEvent({ ...valid, from_layer_index: -2 })).toBe(false);
  });

  it('rejects from_layer_index > 20', () => {
    expect(validateEvent({ ...valid, from_layer_index: 21 })).toBe(false);
  });

  it('rejects invalid method', () => {
    expect(validateEvent({ ...valid, method: 'slide' })).toBe(false);
  });

  it('accepts all valid layer move methods', () => {
    for (const method of ['inspector', 'drag', 'keyboard', 'context_menu']) {
      expect(validateEvent({ ...valid, method })).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────
// bin_rotated
// ─────────────────────────────────────────────
describe('validateEvent — bin_rotated', () => {
  const valid = {
    type: 'bin_rotated',
    old_size: BIN_SIZE,
    new_size: '3x2x4',
    batch_size: 1,
  };

  it('accepts a valid bin_rotated event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('rejects invalid old_size', () => {
    expect(validateEvent({ ...valid, old_size: '2x3' })).toBe(false);
  });

  it('rejects batch_size of 0', () => {
    expect(validateEvent({ ...valid, batch_size: 0 })).toBe(false);
  });

  it('rejects batch_size >= 1000', () => {
    expect(validateEvent({ ...valid, batch_size: 1000 })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// placement_rejected
// ─────────────────────────────────────────────
describe('validateEvent — placement_rejected', () => {
  const valid = {
    type: 'placement_rejected',
    rejection_reason: 'cancelled',
    intended_size: null,
    intended_position: null,
    layer_index: 0,
    drawer_size: DRAWER_SIZE,
    fill_pct: 50,
    mode: 'draw',
  };

  it('accepts a valid placement_rejected event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts with optional intended_size and intended_position', () => {
    expect(
      validateEvent({
        ...valid,
        intended_size: FILL_SIZE,
        intended_position: POSITION,
      })
    ).toBe(true);
  });

  it('rejects invalid rejection_reason', () => {
    expect(validateEvent({ ...valid, rejection_reason: 'nope' })).toBe(false);
  });

  it('rejects invalid mode', () => {
    expect(validateEvent({ ...valid, mode: 'sketch' })).toBe(false);
  });

  it('accepts all valid rejection reasons', () => {
    for (const reason of ['cancelled', 'second_touch', 'outside_bounds', 'too_small']) {
      expect(validateEvent({ ...valid, rejection_reason: reason })).toBe(true);
    }
  });

  it('rejects intended_size with 3D format', () => {
    // intended_size must be 2D (WxD), not 3D
    expect(validateEvent({ ...valid, intended_size: BIN_SIZE })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// undo
// ─────────────────────────────────────────────
describe('validateEvent — undo', () => {
  const valid = {
    type: 'undo',
    action_undone: 'placement',
    bins_affected: 1,
    time_since_action_ms: 1000,
    drawer_size: DRAWER_SIZE,
  };

  it('accepts a valid undo event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts all valid action_undone values', () => {
    const actions = [
      'placement',
      'deletion',
      'move',
      'resize',
      'fill',
      'layer_change',
      'drawer_resize',
      'other',
    ];
    for (const action of actions) {
      expect(validateEvent({ ...valid, action_undone: action })).toBe(true);
    }
  });

  it('rejects invalid action_undone', () => {
    expect(validateEvent({ ...valid, action_undone: 'redo' })).toBe(false);
  });

  it('rejects bins_affected < 0', () => {
    expect(validateEvent({ ...valid, bins_affected: -1 })).toBe(false);
  });

  it('rejects time_since_action_ms < 0', () => {
    expect(validateEvent({ ...valid, time_since_action_ms: -1 })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// quick_correction
// ─────────────────────────────────────────────
describe('validateEvent — quick_correction', () => {
  const valid = {
    type: 'quick_correction',
    correction_type: 'delete',
    original_size: BIN_SIZE,
    new_size: null,
    placement_method: 'draw',
    time_to_correction_ms: 2000,
    layer_index: 0,
  };

  it('accepts a valid quick_correction event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts with new_size set for resize correction', () => {
    expect(
      validateEvent({
        ...valid,
        correction_type: 'resize',
        new_size: '3x3x4',
      })
    ).toBe(true);
  });

  it('rejects invalid correction_type', () => {
    expect(validateEvent({ ...valid, correction_type: 'undo' })).toBe(false);
  });

  it('rejects invalid placement_method', () => {
    expect(validateEvent({ ...valid, placement_method: 'magical' })).toBe(false);
  });

  it('rejects time_to_correction_ms >= 600000', () => {
    expect(validateEvent({ ...valid, time_to_correction_ms: 600000 })).toBe(false);
  });

  it('accepts all valid correction types', () => {
    for (const correction_type of ['delete', 'resize', 'move']) {
      expect(validateEvent({ ...valid, correction_type })).toBe(true);
    }
  });
});

// ─────────────────────────────────────────────
// bin_abandoned
// ─────────────────────────────────────────────
describe('validateEvent — bin_abandoned', () => {
  const valid = {
    type: 'bin_abandoned',
    bin_size: BIN_SIZE,
    position: POSITION,
    layer_index: 0,
    lifetime_ms: 30000,
    creation_method: 'draw',
    fill_pct: 20,
    drawer_size: DRAWER_SIZE,
  };

  it('accepts a valid bin_abandoned event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('rejects lifetime_ms >= 86400000', () => {
    expect(validateEvent({ ...valid, lifetime_ms: 86400000 })).toBe(false);
  });

  it('rejects invalid creation_method', () => {
    expect(validateEvent({ ...valid, creation_method: 'wish' })).toBe(false);
  });

  it('accepts all valid creation methods', () => {
    for (const creation_method of ['draw', 'fill', 'duplicate', 'staging', 'paint']) {
      expect(validateEvent({ ...valid, creation_method })).toBe(true);
    }
  });

  it('rejects invalid position format', () => {
    expect(validateEvent({ ...valid, position: 'a,b' })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// session_summary
// ─────────────────────────────────────────────
describe('validateEvent — session_summary', () => {
  const valid = {
    type: 'session_summary',
    bins_placed: 5,
    bins_deleted: 1,
    edits_total: 8,
    time_to_first_bin_ms: 5000,
    session_duration_ms: 180000,
    size_sequence: [BIN_SIZE, '1x1x3'],
    edit_to_done_ratio: 0.4,
    undo_count: 1,
    confidence_score: 0.7,
    drawer_size: DRAWER_SIZE,
    final_fill_pct: 60,
  };

  it('accepts a valid session_summary event', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts with time_to_first_bin_ms null', () => {
    expect(validateEvent({ ...valid, time_to_first_bin_ms: null })).toBe(true);
  });

  it('accepts empty size_sequence', () => {
    expect(validateEvent({ ...valid, size_sequence: [] })).toBe(true);
  });

  it('rejects bins_placed < 0', () => {
    expect(validateEvent({ ...valid, bins_placed: -1 })).toBe(false);
  });

  it('rejects confidence_score > 1', () => {
    expect(validateEvent({ ...valid, confidence_score: 1.1 })).toBe(false);
  });

  it('rejects confidence_score < 0', () => {
    expect(validateEvent({ ...valid, confidence_score: -0.1 })).toBe(false);
  });

  it('rejects size_sequence with more than 100 entries', () => {
    const sizes = Array.from({ length: 101 }, () => BIN_SIZE);
    expect(validateEvent({ ...valid, size_sequence: sizes })).toBe(false);
  });

  it('rejects size_sequence with invalid bin size entry', () => {
    expect(validateEvent({ ...valid, size_sequence: ['bad'] })).toBe(false);
  });

  it('rejects edits_total >= 100000', () => {
    expect(validateEvent({ ...valid, edits_total: 100000 })).toBe(false);
  });
});

// ─────────────────────────────────────────────
// cross_layout_pattern
// ─────────────────────────────────────────────
describe('validateEvent — cross_layout_pattern', () => {
  const valid = {
    type: 'cross_layout_pattern',
    user_hash: 'anonymous',
    label_size_consistency: [],
    inferred_purpose: null,
    inferred_purpose_confidence: 0.5,
    drawer_size: DRAWER_SIZE,
  };

  it('accepts a valid cross_layout_pattern event with anonymous user', () => {
    expect(validateEvent(valid)).toBe(true);
  });

  it('accepts a UUID-format user_hash', () => {
    expect(
      validateEvent({
        ...valid,
        user_hash: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      })
    ).toBe(true);
  });

  it('accepts with inferred_purpose set to known value', () => {
    expect(validateEvent({ ...valid, inferred_purpose: 'workshop' })).toBe(true);
  });

  it('accepts with label_size_consistency entries', () => {
    expect(
      validateEvent({
        ...valid,
        label_size_consistency: [
          { label_hash: LABEL_HASH, sizes_used: [BIN_SIZE], is_consistent: true },
          { label_hash: 'bbbb2222', sizes_used: [BIN_SIZE, '1x1x3'], is_consistent: false },
        ],
      })
    ).toBe(true);
  });

  it('rejects invalid user_hash format', () => {
    expect(validateEvent({ ...valid, user_hash: 'sh' })).toBe(false);
  });

  it('rejects user_hash with uppercase letters', () => {
    // Uppercase is not in [a-z0-9-] and is not 'anonymous'
    expect(validateEvent({ ...valid, user_hash: 'ABCDEFGH' })).toBe(false);
  });

  it('rejects label_size_consistency with more than 20 entries', () => {
    const entries = Array.from({ length: 21 }, () => ({
      label_hash: LABEL_HASH,
      sizes_used: [BIN_SIZE],
      is_consistent: true,
    }));
    expect(validateEvent({ ...valid, label_size_consistency: entries })).toBe(false);
  });

  it('rejects label_size_consistency entry with empty sizes_used', () => {
    expect(
      validateEvent({
        ...valid,
        label_size_consistency: [{ label_hash: LABEL_HASH, sizes_used: [], is_consistent: true }],
      })
    ).toBe(false);
  });

  it('rejects label_size_consistency entry with invalid label_hash', () => {
    expect(
      validateEvent({
        ...valid,
        label_size_consistency: [
          { label_hash: 'ZZZZ9999', sizes_used: [BIN_SIZE], is_consistent: true },
        ],
      })
    ).toBe(false);
  });

  it('rejects inferred_purpose_confidence > 1', () => {
    expect(validateEvent({ ...valid, inferred_purpose_confidence: 1.5 })).toBe(false);
  });

  it('rejects inferred_purpose_confidence < 0', () => {
    expect(validateEvent({ ...valid, inferred_purpose_confidence: -0.1 })).toBe(false);
  });

  it('rejects non-null inferred_purpose that does not match allowed set or regex', () => {
    expect(validateEvent({ ...valid, inferred_purpose: 'INVALID PURPOSE!' })).toBe(false);
  });
});
