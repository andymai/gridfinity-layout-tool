/**
 * Feature manifest declarations.
 *
 * Each constrainable feature registers how to check if it's enabled
 * and how to produce a partial BinParams that enables/disables it.
 * This is the foundation for the constraint engine's resolution logic.
 */

import type { FeatureKey, FeatureManifest } from './types';

/**
 * Complete registry of feature manifests.
 *
 * The compile-time exhaustiveness check below ensures every FeatureKey
 * has an entry. When adding a new FeatureKey, TypeScript will error
 * here until a manifest is provided.
 */
export const FEATURE_MANIFESTS: Record<FeatureKey, FeatureManifest> = {
  'base.halfSockets': {
    key: 'base.halfSockets',
    label: 'Half Sockets',
    isEnabled: (p) => p.base.halfSockets,
    apply: (p, enabled) => ({ base: { ...p.base, halfSockets: enabled } }),
  },

  'base.magnet': {
    key: 'base.magnet',
    label: 'Magnet Holes',
    isEnabled: (p) => p.base.style === 'magnet' || p.base.style === 'magnet_and_screw',
    apply: (p, enabled) => {
      const hasScrew = p.base.style === 'screw' || p.base.style === 'magnet_and_screw';
      const style = enabled
        ? hasScrew
          ? 'magnet_and_screw'
          : 'magnet'
        : hasScrew
          ? 'screw'
          : 'standard';
      return { base: { ...p.base, style } };
    },
  },

  'base.screw': {
    key: 'base.screw',
    label: 'Screw Holes',
    isEnabled: (p) => p.base.style === 'screw' || p.base.style === 'magnet_and_screw',
    apply: (p, enabled) => {
      const hasMagnet = p.base.style === 'magnet' || p.base.style === 'magnet_and_screw';
      const style = enabled
        ? hasMagnet
          ? 'magnet_and_screw'
          : 'screw'
        : hasMagnet
          ? 'magnet'
          : 'standard';
      return { base: { ...p.base, style } };
    },
  },

  'base.flat': {
    key: 'base.flat',
    label: 'Flat Base',
    isEnabled: (p) => p.base.style === 'flat',
    apply: (p, enabled) => ({
      base: { ...p.base, style: enabled ? 'flat' : 'standard' },
    }),
  },

  'style.slotted': {
    key: 'style.slotted',
    label: 'Slotted Style',
    isEnabled: (p) => p.style === 'slotted',
    apply: (_p, enabled) => ({ style: enabled ? 'slotted' : 'standard' }),
  },

  'style.solid': {
    key: 'style.solid',
    label: 'Solid Style',
    isEnabled: (p) => p.style === 'solid',
    apply: (_p, enabled) => ({ style: enabled ? 'solid' : 'standard' }),
  },

  compartments: {
    key: 'compartments',
    label: 'Compartments',
    isEnabled: (p) => p.compartments.cols > 1 || p.compartments.rows > 1,
    apply: (p, enabled) =>
      enabled
        ? {} // Enabling requires explicit grid size — no-op
        : { compartments: { ...p.compartments, cols: 1, rows: 1, cells: [0] } },
  },

  scoop: {
    key: 'scoop',
    label: 'Finger Scoop',
    isEnabled: (p) => p.scoop.enabled,
    apply: (p, enabled) => ({ scoop: { ...p.scoop, enabled } }),
  },

  label: {
    key: 'label',
    label: 'Label Tabs',
    isEnabled: (p) => p.label.enabled,
    apply: (p, enabled) => ({ label: { ...p.label, enabled } }),
  },

  wallPattern: {
    key: 'wallPattern',
    label: 'Wall Patterns',
    isEnabled: (p) => p.wallPattern.enabled,
    apply: (p, enabled) => ({ wallPattern: { ...p.wallPattern, enabled } }),
  },

  inserts: {
    key: 'inserts',
    label: 'Floor Inserts',
    isEnabled: (p) => p.inserts.length > 0,
    apply: (_p, enabled) => (enabled ? {} : { inserts: [] }),
  },

  cutouts: {
    key: 'cutouts',
    label: 'Top Cutouts',
    isEnabled: (p) => p.cutouts.length > 0,
    apply: (_p, enabled) => (enabled ? {} : { cutouts: [] }),
  },

  slotConfig: {
    key: 'slotConfig',
    label: 'Divider Slots',
    isEnabled: (p) => p.slotConfig.x.enabled || p.slotConfig.y.enabled,
    apply: (p, enabled) =>
      enabled
        ? {} // Enabling requires axis selection — no-op
        : {
            slotConfig: {
              ...p.slotConfig,
              x: { ...p.slotConfig.x, enabled: false },
              y: { ...p.slotConfig.y, enabled: false },
            },
          },
  },
};

// Compile-time exhaustiveness: ensures every FeatureKey has a manifest entry.
// If a new FeatureKey is added without a manifest, TypeScript errors here.
type _ExhaustiveCheck = keyof typeof FEATURE_MANIFESTS extends FeatureKey
  ? FeatureKey extends keyof typeof FEATURE_MANIFESTS
    ? true
    : never
  : never;
const _exhaustive: _ExhaustiveCheck = true;
void _exhaustive;
