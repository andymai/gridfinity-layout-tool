/**
 * Feature flag definitions.
 *
 * This module defines all available feature flags in the application.
 * Feature flags enable gradual rollout and experimentation with new features.
 */

import type { FeatureFlag } from './types';

export const FEATURE_FLAGS = [
  {
    id: 'drawer_shapes',
    name: 'Custom Drawer Shapes',
    description:
      'Design non-rectangular drawers — L-shapes, notches, and cut corners. Paint the drawer shape cell by cell or trace it from your bin layout, and the baseplate follows it exactly.',
    status: 'graduated',
    risk: 'medium',
    addedAt: '2026-07',
    graduatedAt: '2026-07',
    requiresRefresh: false,
  },
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
  // cqrs_undo removed — undo capture middleware is now always active
  // occt_wasm_kernel removed — occt-wasm is now the default geometry engine
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
    status: 'graduated',
    risk: 'medium',
    addedAt: '2026-05',
    graduatedAt: '2026-05',
    requiresRefresh: false,
  },
  {
    id: 'embedded_text',
    name: 'Engraved Text',
    description:
      'Engrave, emboss, or cut text directly into label tabs and beside cutouts. Type a label per compartment or per cutout and it prints into the model.',
    status: 'graduated',
    risk: 'medium',
    addedAt: '2026-05',
    graduatedAt: '2026-06',
    requiresRefresh: false,
  },
  {
    id: 'show_generation_perf',
    name: 'Generation Performance Overlay',
    description:
      'Show a small overlay in the bin designer with per-stage timings, cache hit rates, hex-center counts, and recent generation history. Useful for diagnosing slow bins and validating optimizations.',
    status: 'experimental',
    risk: 'low',
    addedAt: '2026-05',
    requiresRefresh: false,
  },
  {
    id: 'manifold_preview',
    name: 'Faster Live Preview',
    description:
      'Draft the 3D preview with a faster engine while you edit, then sharpen to the exact model when you pause. Speeds up the bin designer on complex bins; exports always use the exact engine.',
    status: 'graduated',
    risk: 'low',
    addedAt: '2026-06',
    graduatedAt: '2026-06',
    requiresRefresh: false,
  },
  {
    id: 'scan_with_phone',
    name: 'Scan a Tool with Your Phone',
    description:
      "Scan a real tool with your phone's camera and turn its outline into a cutout. Lay the tool next to a bank card and the cutout is sized to scale automatically.",
    status: 'graduated',
    risk: 'medium',
    addedAt: '2026-06',
    graduatedAt: '2026-06',
    requiresRefresh: false,
  },
  {
    id: 'item_kinds',
    name: 'Non-bin items',
    description:
      'Design things beyond bins that sit on a Gridfinity baseplate — like an angled tool rack for pliers and tweezers. More item types coming.',
    status: 'experimental',
    risk: 'medium',
    warning:
      'Early feature. Tool racks export from their own panel but are not auto-saved, shareable, or placeable in drawer layouts yet.',
    addedAt: '2026-06',
    requiresRefresh: false,
  },
  {
    id: 'bin_recommender',
    name: 'Suggested Bin Sizes',
    description:
      'When you label a bin, suggest the size other people most often use for that label. One tap applies it — nothing changes unless you accept.',
    status: 'experimental',
    risk: 'low',
    addedAt: '2026-07',
    requiresRefresh: false,
  },
  {
    id: 'layout_overhang',
    name: 'Extend Bins into Drawer Margin',
    description:
      'When a baseplate adds padding to fit your drawer, an edge bin can extend its walls into that margin so no space is wasted. Toggle it per bin in the inspector; the extension shows in the layout and 3D preview and is included on export.',
    status: 'graduated',
    risk: 'medium',
    addedAt: '2026-07',
    graduatedAt: '2026-07',
    requiresRefresh: false,
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
