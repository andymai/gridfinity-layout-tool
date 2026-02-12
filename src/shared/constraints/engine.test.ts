/**
 * Constraint engine tests.
 *
 * Tests the core resolution algorithm, feature status queries,
 * and all known constraint rules using real BinParams.
 */

import { describe, it, expect } from 'vitest';
import type { BinParams } from '@/shared/types/bin';
import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { FeatureKey } from './types';
import { FEATURE_MANIFESTS } from './features';
import {
  resolveConstraints,
  getFeatureStatus,
  getAllFeatureStatuses,
  isFeatureActive,
} from './engine';
import { CONSTRAINT_RULES } from './rules';
import { validateConstraints } from './validation';

// =============================================================================
// Helpers
// =============================================================================

/** Create params with specific overrides for testing. */
function makeParams(overrides: Partial<BinParams> = {}): BinParams {
  return {
    ...DEFAULT_BIN_PARAMS,
    ...overrides,
    base: { ...DEFAULT_BIN_PARAMS.base, ...(overrides.base ?? {}) },
    compartments: { ...DEFAULT_BIN_PARAMS.compartments, ...(overrides.compartments ?? {}) },
    scoop: { ...DEFAULT_BIN_PARAMS.scoop, ...(overrides.scoop ?? {}) },
    label: { ...DEFAULT_BIN_PARAMS.label, ...(overrides.label ?? {}) },
    wallPattern: { ...DEFAULT_BIN_PARAMS.wallPattern, ...(overrides.wallPattern ?? {}) },
    slotConfig: {
      ...DEFAULT_BIN_PARAMS.slotConfig,
      ...(overrides.slotConfig ?? {}),
      x: {
        ...DEFAULT_BIN_PARAMS.slotConfig.x,
        ...(overrides.slotConfig?.x ?? {}),
      },
      y: {
        ...DEFAULT_BIN_PARAMS.slotConfig.y,
        ...(overrides.slotConfig?.y ?? {}),
      },
    },
  };
}

// =============================================================================
// Feature Manifests
// =============================================================================

describe('FEATURE_MANIFESTS', () => {
  it('covers all FeatureKey values', () => {
    const allKeys: FeatureKey[] = [
      'base.halfSockets',
      'base.magnet',
      'base.screw',
      'base.flat',
      'style.slotted',
      'style.solid',
      'compartments',
      'scoop',
      'label',
      'wallPattern',
      'inserts',
      'cutouts',
      'slotConfig',
    ];
    for (const key of allKeys) {
      expect(FEATURE_MANIFESTS[key]).toBeDefined();
      expect(FEATURE_MANIFESTS[key].key).toBe(key);
    }
  });

  it('isEnabled matches expected default state', () => {
    const params = makeParams();
    expect(FEATURE_MANIFESTS['base.halfSockets'].isEnabled(params)).toBe(false);
    expect(FEATURE_MANIFESTS['base.magnet'].isEnabled(params)).toBe(false);
    expect(FEATURE_MANIFESTS['base.screw'].isEnabled(params)).toBe(false);
    expect(FEATURE_MANIFESTS['base.flat'].isEnabled(params)).toBe(false);
    expect(FEATURE_MANIFESTS['style.slotted'].isEnabled(params)).toBe(false);
    expect(FEATURE_MANIFESTS['style.solid'].isEnabled(params)).toBe(false);
    expect(FEATURE_MANIFESTS.scoop.isEnabled(params)).toBe(false);
    expect(FEATURE_MANIFESTS.label.isEnabled(params)).toBe(false);
    expect(FEATURE_MANIFESTS.wallPattern.isEnabled(params)).toBe(false);
    expect(FEATURE_MANIFESTS.cutouts.isEnabled(params)).toBe(false);
    expect(FEATURE_MANIFESTS.inserts.isEnabled(params)).toBe(false);
    // Default slotConfig has x.enabled=true (vertical dividers default on)
    expect(FEATURE_MANIFESTS.slotConfig.isEnabled(params)).toBe(true);
  });

  it('apply toggles base.magnet correctly with screw interaction', () => {
    const base = makeParams();
    // Enable magnet
    const withMagnet = { ...base, ...FEATURE_MANIFESTS['base.magnet'].apply(base, true) };
    expect(withMagnet.base.style).toBe('magnet');

    // Enable screw while magnet is on
    const withBoth = {
      ...withMagnet,
      base: { ...withMagnet.base, ...FEATURE_MANIFESTS['base.screw'].apply(withMagnet, true).base },
    };
    expect(withBoth.base.style).toBe('magnet_and_screw');

    // Disable magnet, screw stays
    const screwOnly = {
      ...withBoth,
      base: { ...withBoth.base, ...FEATURE_MANIFESTS['base.magnet'].apply(withBoth, false).base },
    };
    expect(screwOnly.base.style).toBe('screw');
  });
});

// =============================================================================
// Constraint Resolution: Base Constraints
// =============================================================================

describe('resolveConstraints — base constraints', () => {
  it('enabling half sockets disables magnet holes', () => {
    const params = makeParams({ base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' } });
    const result = resolveConstraints(params, {
      feature: 'base.halfSockets',
      enabled: true,
    });

    expect(result.params.base.halfSockets).toBe(true);
    expect(result.params.base.style).not.toBe('magnet');
    expect(result.params.base.style).not.toBe('magnet_and_screw');
    expect(result.autoDisabled).toContain('base.magnet');
  });

  it('enabling half sockets disables magnet_and_screw', () => {
    const params = makeParams({
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw' },
    });
    const result = resolveConstraints(params, {
      feature: 'base.halfSockets',
      enabled: true,
    });

    expect(result.params.base.halfSockets).toBe(true);
    expect(result.params.base.style).toBe('standard');
    expect(result.autoDisabled).toContain('base.magnet');
    expect(result.autoDisabled).toContain('base.screw');
  });

  it('enabling magnet disables half sockets', () => {
    const params = makeParams({
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    });
    const result = resolveConstraints(params, {
      feature: 'base.magnet',
      enabled: true,
    });

    expect(result.params.base.style).toBe('magnet');
    expect(result.params.base.halfSockets).toBe(false);
    expect(result.autoDisabled).toContain('base.halfSockets');
  });

  it('enabling flat replaces magnet_and_screw style', () => {
    const params = makeParams({
      base: {
        ...DEFAULT_BIN_PARAMS.base,
        style: 'magnet_and_screw',
        halfSockets: false,
      },
    });
    const result = resolveConstraints(params, {
      feature: 'base.flat',
      enabled: true,
    });

    expect(result.params.base.style).toBe('flat');
    expect(result.params.base.halfSockets).toBe(false);
    // Magnet/screw are off because flat.apply() replaces the style directly,
    // not through constraint auto-disable. The params are correct either way.
    expect(FEATURE_MANIFESTS['base.magnet'].isEnabled(result.params)).toBe(false);
    expect(FEATURE_MANIFESTS['base.screw'].isEnabled(result.params)).toBe(false);
  });

  it('enabling magnet on flat base replaces flat style', () => {
    const params = makeParams({
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'flat' },
    });
    const result = resolveConstraints(params, {
      feature: 'base.magnet',
      enabled: true,
    });

    expect(result.params.base.style).toBe('magnet');
    // Flat is off because magnet.apply() replaces the style directly
    expect(FEATURE_MANIFESTS['base.flat'].isEnabled(result.params)).toBe(false);
  });

  it('enabling a one-way-blocked feature is a no-op', () => {
    // Scoop is blocked by slotted (one-way — enabling scoop can't disable slotted)
    const params = makeParams({ style: 'slotted' });
    const result = resolveConstraints(params, {
      feature: 'scoop',
      enabled: true,
    });

    // Should return original params unchanged
    expect(result.params.scoop.enabled).toBe(false);
    expect(result.params.style).toBe('slotted');
    expect(result.autoDisabled).toHaveLength(0);
  });

  it('disabling a feature does not cascade', () => {
    const params = makeParams({
      base: { ...DEFAULT_BIN_PARAMS.base, halfSockets: true },
    });
    const result = resolveConstraints(params, {
      feature: 'base.halfSockets',
      enabled: false,
    });

    expect(result.params.base.halfSockets).toBe(false);
    expect(result.autoDisabled).toHaveLength(0);
  });
});

// =============================================================================
// Constraint Resolution: Style Constraints
// =============================================================================

describe('resolveConstraints — style constraints', () => {
  it('setting slotted disables compartments, label, scoop', () => {
    const params = makeParams({
      scoop: { enabled: true, radius: 'auto' },
      label: { ...DEFAULT_BIN_PARAMS.label, enabled: true },
      compartments: { ...DEFAULT_BIN_PARAMS.compartments, cols: 2, rows: 2, cells: [0, 1, 2, 3] },
    });
    const result = resolveConstraints(params, {
      feature: 'style.slotted',
      enabled: true,
    });

    expect(result.params.style).toBe('slotted');
    expect(result.params.scoop.enabled).toBe(false);
    expect(result.params.label.enabled).toBe(false);
    expect(result.params.compartments.cols).toBe(1);
    expect(result.autoDisabled).toContain('scoop');
    expect(result.autoDisabled).toContain('label');
    expect(result.autoDisabled).toContain('compartments');
  });

  it('setting solid disables cavity features and forces base.solid', () => {
    const params = makeParams({
      scoop: { enabled: true, radius: 'auto' },
      wallPattern: { enabled: true, pattern: 'honeycomb' },
    });
    const result = resolveConstraints(params, {
      feature: 'style.solid',
      enabled: true,
    });

    expect(result.params.style).toBe('solid');
    expect(result.params.base.solid).toBe(true);
    expect(result.params.scoop.enabled).toBe(false);
    expect(result.params.wallPattern.enabled).toBe(false);
    expect(result.autoDisabled).toContain('scoop');
    expect(result.autoDisabled).toContain('wallPattern');
  });

  it('switching from solid to standard clears base.solid via implication', () => {
    const params = makeParams({
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    });
    const result = resolveConstraints(params, {
      feature: 'style.solid',
      enabled: false,
    });

    expect(result.params.style).toBe('standard');
    expect(result.params.base.solid).toBe(false);
  });

  it('slotted and solid are mutually exclusive', () => {
    const params = makeParams({ style: 'slotted' });
    const result = resolveConstraints(params, {
      feature: 'style.solid',
      enabled: true,
    });

    expect(result.params.style).toBe('solid');
    // Slotted is off because solid.apply() replaces the style directly
    expect(FEATURE_MANIFESTS['style.slotted'].isEnabled(result.params)).toBe(false);
  });
});

// =============================================================================
// Constraint Resolution: Dynamic Constraints
// =============================================================================

describe('resolveConstraints — dynamic constraints', () => {
  it('wall pattern disabled when all walls slotted', () => {
    const params = makeParams({
      style: 'slotted',
      wallPattern: { enabled: true, pattern: 'honeycomb' },
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 20 },
        y: { enabled: true, pitch: 20 },
      },
    });

    const status = getFeatureStatus(params, 'wallPattern');
    expect(status.available).toBe(false);
    expect(status.reason).toBe('binDesigner.walls.pattern.allSlotted');
  });

  it('wall pattern available when only some walls slotted', () => {
    const params = makeParams({
      style: 'slotted',
      slotConfig: {
        ...DEFAULT_BIN_PARAMS.slotConfig,
        x: { enabled: true, pitch: 20 },
        y: { enabled: false, pitch: 20 },
      },
    });

    const status = getFeatureStatus(params, 'wallPattern');
    // Still blocked by the solid/slotted constraint? No — slotted doesn't disable wallPattern
    // Only "all walls slotted" disables it, and style.solid disables it
    expect(status.available).toBe(true);
  });
});

// =============================================================================
// Feature Status Queries
// =============================================================================

describe('getFeatureStatus', () => {
  it('returns available=true for unconstrained features', () => {
    const params = makeParams();
    const status = getFeatureStatus(params, 'scoop');
    expect(status.available).toBe(true);
    expect(status.reason).toBeUndefined();
    expect(status.conflicts).toHaveLength(0);
  });

  it('returns available=false with reason for constrained features', () => {
    const params = makeParams({ style: 'slotted' });
    const status = getFeatureStatus(params, 'scoop');
    expect(status.available).toBe(false);
    expect(status.reason).toBe('binDesigner.fingerScoopUnavailableSlotted');
    expect(status.conflicts).toContain('style.slotted');
  });

  it('returns enabled=true for active features', () => {
    const params = makeParams({ scoop: { enabled: true, radius: 'auto' } });
    const status = getFeatureStatus(params, 'scoop');
    expect(status.enabled).toBe(true);
  });
});

describe('getAllFeatureStatuses', () => {
  it('returns statuses for all features', () => {
    const params = makeParams();
    const statuses = getAllFeatureStatuses(params);

    const allKeys = Object.keys(FEATURE_MANIFESTS) as FeatureKey[];
    expect(statuses.size).toBe(allKeys.length);
    for (const key of allKeys) {
      expect(statuses.has(key)).toBe(true);
    }
  });
});

describe('isFeatureActive', () => {
  it('returns false for disabled feature', () => {
    expect(isFeatureActive(makeParams(), 'scoop')).toBe(false);
  });

  it('returns true for enabled unconstrained feature', () => {
    const params = makeParams({ scoop: { enabled: true, radius: 'auto' } });
    expect(isFeatureActive(params, 'scoop')).toBe(true);
  });

  it('returns false for enabled but constrained feature', () => {
    // Scoop enabled but style is slotted — constrained
    const params = makeParams({
      style: 'slotted',
      scoop: { enabled: true, radius: 'auto' },
    });
    expect(isFeatureActive(params, 'scoop')).toBe(false);
  });
});

// =============================================================================
// Implication Rules
// =============================================================================

describe('implication rules', () => {
  it('solid style forces base.solid=true', () => {
    const params = makeParams();
    const result = resolveConstraints(params, {
      feature: 'style.solid',
      enabled: true,
    });
    expect(result.params.base.solid).toBe(true);
  });

  it('leaving solid style clears base.solid', () => {
    const params = makeParams({
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
    });
    const result = resolveConstraints(params, {
      feature: 'style.solid',
      enabled: false,
    });
    expect(result.params.base.solid).toBe(false);
  });
});

// =============================================================================
// Validation
// =============================================================================

describe('validateConstraints', () => {
  it('passes for default params', () => {
    const result = validateConstraints(makeParams());
    expect(result.ok).toBe(true);
  });

  it('passes for valid magnet configuration', () => {
    const params = makeParams({
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet' },
    });
    const result = validateConstraints(params);
    expect(result.ok).toBe(true);
  });

  it('fails for half sockets + magnet (invalid combo)', () => {
    // Force an invalid state that the UI would normally prevent
    const params = makeParams({
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet', halfSockets: true },
    });
    const result = validateConstraints(params);
    expect(result.ok).toBe(false);
  });
});

// =============================================================================
// Idempotency
// =============================================================================

describe('resolution idempotency', () => {
  it('resolving twice produces the same result', () => {
    const params = makeParams({
      base: { ...DEFAULT_BIN_PARAMS.base, style: 'magnet_and_screw' },
      scoop: { enabled: true, radius: 'auto' },
    });
    const first = resolveConstraints(params, {
      feature: 'style.solid',
      enabled: true,
    });
    const second = resolveConstraints(first.params, {
      feature: 'style.solid',
      enabled: true,
    });

    expect(JSON.stringify(first.params)).toBe(JSON.stringify(second.params));
  });
});

// =============================================================================
// Rule Coverage
// =============================================================================

describe('constraint rule coverage', () => {
  it('every rule has a non-empty description', () => {
    for (const rule of CONSTRAINT_RULES) {
      expect(rule.description.length).toBeGreaterThan(0);
    }
  });

  it('every rule has a valid source FeatureKey', () => {
    const validKeys = new Set(Object.keys(FEATURE_MANIFESTS));
    for (const rule of CONSTRAINT_RULES) {
      expect(validKeys.has(rule.source)).toBe(true);
    }
  });

  it('every rule disables only valid FeatureKeys', () => {
    const validKeys = new Set(Object.keys(FEATURE_MANIFESTS));
    for (const rule of CONSTRAINT_RULES) {
      for (const disabled of rule.disables) {
        expect(validKeys.has(disabled)).toBe(true);
      }
    }
  });

  it('no rule disables its own source', () => {
    for (const rule of CONSTRAINT_RULES) {
      expect(rule.disables).not.toContain(rule.source);
    }
  });
});
