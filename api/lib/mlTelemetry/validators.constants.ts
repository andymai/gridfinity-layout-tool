/**
 * Validation constants for ML telemetry events.
 *
 * Regex patterns and `ReadonlySet`s of allowed enum values used across
 * event-shape validators. Kept in a dedicated module so `validators.ts` stays
 * focused on the validation dispatch logic.
 *
 * Security note 1: the regex constants prefixed with `VALID_*_REGEX` are
 * deliberately strict because the matched values are interpolated into
 * Redis keys downstream — anything more permissive risks key injection.
 *
 * Security note 2: the allowed-value sets are exported as `ReadonlySet<string>`
 * to prevent importers from calling `.add()` / `.delete()` and silently
 * weakening these security-sensitive validators at runtime.
 */

export const VALID_BIN_SIZE_REGEX = /^\d+(\.\d+)?x\d+(\.\d+)?x\d+(\.\d+)?$/;
export const VALID_DRAWER_SIZE_REGEX = /^\d+(\.\d+)?x\d+(\.\d+)?x\d+(\.\d+)?$/;
export const VALID_GAP_FIT: ReadonlySet<string> = new Set(['exact', 'partial', 'none']);
export const VALID_METHODS: ReadonlySet<string> = new Set([
  'draw',
  'fill',
  'duplicate',
  'staging',
  'paint',
]);

// Security: Strict validation for fields used in Redis keys to prevent injection
export const VALID_LABEL_HASH_REGEX = /^[a-f0-9]{8}$/; // 8-char hex hash
export const VALID_LAYOUT_HASH_REGEX = /^[a-f0-9]{8}$/; // 8-char hex hash
export const VALID_NORMALIZED_LABEL_REGEX = /^[a-z][a-z0-9_]{0,31}$/; // lowercase, alphanumeric + underscore
export const VALID_CATEGORY_ID_REGEX = /^[a-zA-Z0-9_-]{1,36}$/; // UUID-like or simple ID
export const VALID_EMBEDDING_BUCKET_REGEX = /^[a-f0-9]{4}$/; // 4-char hex embedding bucket
export const VALID_DOMAINS: ReadonlySet<string> = new Set([
  'tools',
  'fasteners',
  'electronics',
  'office',
  'craft',
  'printing_3d',
  'cosmetics',
  'misc',
]);

// Layout snapshot validation
export const VALID_TRIGGERS: ReadonlySet<string> = new Set([
  'save',
  'export_json',
  'export_tsv',
  'share',
  'print',
  'session_end',
  'layout_switch',
  'idle',
  'print_preview',
]);
export const VALID_QUALITY_SIGNALS: ReadonlySet<string> = new Set([
  'shared',
  'exported',
  'duplicated',
  'deleted',
  'revisited_edited',
  'revisited_kept',
  'modified',
]);
export const VALID_ABANDONMENT_TYPES: ReadonlySet<string> = new Set([
  'incomplete',
  'deleted',
  'dormant',
  'superseded',
]);
export const VALID_PURPOSES: ReadonlySet<string> = new Set([
  'workshop',
  'electronics',
  'office',
  'craft',
  'kitchen',
  'bathroom',
  'garage',
  'other',
]);
export const VALID_PURPOSE_REGEX = /^[a-z][a-z0-9_-]{0,31}$/; // For custom purposes
export const VALID_QUALITY_TIERS: ReadonlySet<string> = new Set(['high', 'medium', 'low', 'skip']);
export const VALID_DELETE_METHODS: ReadonlySet<string> = new Set([
  'key',
  'context_menu',
  'bulk',
  'inspector',
]);
export const VALID_MOVE_METHODS: ReadonlySet<string> = new Set(['drag', 'nudge']);
export const VALID_POSITION_REGEX = /^\d+(\.\d+)?,\d+(\.\d+)?$/; // e.g., "3,5" or "3.5,2.5"
export const VALID_FILL_METHODS: ReadonlySet<string> = new Set(['uniform', 'gaps']);
export const VALID_LAYER_MOVE_METHODS: ReadonlySet<string> = new Set([
  'inspector',
  'drag',
  'keyboard',
  'context_menu',
]);
export const VALID_FILL_SIZE_REGEX = /^\d+(\.\d+)?x\d+(\.\d+)?$/; // WxD (no height)

// Negative signal validation
export const VALID_REJECTION_REASONS: ReadonlySet<string> = new Set([
  'cancelled',
  'second_touch',
  'outside_bounds',
  'too_small',
]);
export const VALID_DRAW_MODES: ReadonlySet<string> = new Set(['draw', 'paint']);
export const VALID_UNDO_ACTIONS: ReadonlySet<string> = new Set([
  'placement',
  'deletion',
  'move',
  'resize',
  'fill',
  'layer_change',
  'drawer_resize',
  'other',
]);
export const VALID_CORRECTION_TYPES: ReadonlySet<string> = new Set(['delete', 'resize', 'move']);
export const VALID_RESIZE_DIRECTIONS: ReadonlySet<string> = new Set(['grow', 'shrink', 'mixed']);

// Pattern detection validation
export const VALID_ARCHETYPES: ReadonlySet<string> = new Set([
  'uniform',
  'mixed',
  'border_fill',
  'compartmentalized',
  'layered',
]);
export const VALID_SPATIAL_PATTERNS: ReadonlySet<string> = new Set([
  'corner_start',
  'large_first',
  'category_grouped',
  'edge_aligned',
  'center_out',
]);
