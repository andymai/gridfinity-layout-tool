/**
 * Feature flag definitions.
 *
 * This module defines all available feature flags in the application.
 * Feature flags enable gradual rollout and experimentation with new features.
 */

import type { FeatureFlag } from './types';

export const FEATURE_FLAGS = [
  {
    id: 'bin_designer',
    name: 'Bin Designer',
    description:
      'Design your own custom Gridfinity bins. Set dimensions, add compartments, magnets, and screw holes, then export ready-to-print STL or 3MF files.',
    status: 'graduated',
    risk: 'medium',
    addedAt: '2026-01',
    graduatedAt: '2026-02',
    requiresRefresh: false,
  },
  {
    id: 'collaborative_editing',
    name: 'Collaborative Editing',
    description:
      "Work on layouts together in real-time. Share a link and see each other's cursors as you design.",
    status: 'experimental',
    risk: 'medium',
    warning:
      'Real-time sync may occasionally have small delays when multiple people edit the same area.',
    addedAt: '2026-01',
    requiresRefresh: false,
    comingSoon: false,
  },
  {
    id: 'baseplate_generator',
    name: 'Baseplate Generator',
    description:
      'Create custom Gridfinity baseplates. Choose your grid size, add magnet holes or half-cell pegs, then export STL, STEP, or 3MF files for printing.',
    status: 'graduated',
    risk: 'low',
    addedAt: '2026-02',
    graduatedAt: '2026-02',
    requiresRefresh: false,
  },
  {
    id: 'brepkit_kernel',
    name: 'Alternative 3D Engine',
    description:
      'Try an alternative 3D engine for generating your bin models. Uses less memory and loads quicker than the default engine.',
    status: 'experimental',
    risk: 'high',
    warning:
      'This engine is still in development. Exported models may have geometry defects or look different than expected. Reload the page after toggling.',
    addedAt: '2026-03',
    requiresRefresh: true,
  },
  {
    id: 'occt_wasm_kernel',
    name: 'Updated OCCT 3D Engine',
    description:
      'A newer build of the same OCCT engine that powers the default. Cleaner TypeScript bindings, smaller WASM module (~16% smaller), and topology- and volume-equivalent output across the standard bin set. Surface-precise bounding boxes can differ from the default by up to ~0.05 mm.',
    status: 'experimental',
    risk: 'medium',
    warning:
      'Geometry parity with the default engine has been verified across the standard bin set. Cannot be combined with the alternative engine. Reload the page after toggling.',
    addedAt: '2026-05',
    requiresRefresh: true,
  },
  // cqrs_undo removed — undo capture middleware is now always active
  {
    id: 'handle_holes',
    name: 'Handle Holes',
    description:
      'Cut finger-grip holes through bin walls. Rounded rectangle cutouts make it easy to pull bins out of drawers.',
    status: 'graduated',
    risk: 'low',
    addedAt: '2026-03',
    graduatedAt: '2026-03',
    requiresRefresh: false,
  },
  {
    id: 'multi_color_export',
    name: 'Multi-Color 3MF Export',
    description:
      'Assign different filament colors to body, lip, and label tabs. Exports multi-color 3MF files for multi-material printers.',
    status: 'graduated',
    risk: 'low',
    addedAt: '2026-03',
    graduatedAt: '2026-05',
    requiresRefresh: false,
  },
  {
    id: 'cloud_sync',
    name: 'Cloud Sync (sign in)',
    description:
      'Sign in with Google or GitHub to sync your layouts and bin designs across devices. Your library follows you to any browser you sign in on.',
    status: 'experimental',
    risk: 'medium',
    warning:
      'Reload the page after toggling. You can sign out at any time and choose to keep the synced library on this device or wipe it.',
    addedAt: '2026-05',
    requiresRefresh: true,
  },
] as const satisfies readonly FeatureFlag[];

export type FeatureId = (typeof FEATURE_FLAGS)[number]['id'];

export function getFeature(id: string): FeatureFlag | undefined {
  return FEATURE_FLAGS.find((f) => f.id === id);
}

export function getActiveFeatures(): FeatureFlag[] {
  return (FEATURE_FLAGS as readonly FeatureFlag[]).filter((f) => f.status !== 'deprecated');
}

export function getGraduatedFeatures(): FeatureFlag[] {
  return (FEATURE_FLAGS as readonly FeatureFlag[]).filter((f) => f.status === 'graduated');
}

export function getToggleableFeatures(): FeatureFlag[] {
  return (FEATURE_FLAGS as readonly FeatureFlag[]).filter(
    (f) => f.status === 'experimental' || f.status === 'preview'
  );
}
