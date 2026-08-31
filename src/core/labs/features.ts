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
    status: 'graduated',
    risk: 'medium',
    addedAt: '2026-01',
    graduatedAt: '2026-07',
    requiresRefresh: false,
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
  // item_kinds removed — tool racks migrated into Workshop assemblies (workshop flag)
  {
    id: 'stl_bin_import',
    name: 'Import STL as Bin',
    description:
      'Import a downloaded Gridfinity bin STL as a design in your library — footprint auto-detected, linkable to layout bins, re-exportable as STL or 3MF. Imported bins are view-only (no compartments or cutouts), stay on this device, and cannot export STEP.',
    status: 'graduated',
    risk: 'medium',
    addedAt: '2026-07',
    graduatedAt: '2026-07',
    requiresRefresh: false,
  },
  {
    id: 'bin_recommender',
    name: 'Suggested Bin Sizes',
    description:
      'When you label a bin, suggest the size other people most often use for that label. One tap applies it — nothing changes unless you accept.',
    status: 'graduated',
    risk: 'low',
    addedAt: '2026-07',
    graduatedAt: '2026-07',
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
  {
    id: 'community_fits_gap',
    name: 'Find Bins That Fit',
    description:
      'Select a gap in your drawer layout and see which community designs fit it. Adds a toolbar button, plus a right-button drag on the grid as a desktop shortcut.',
    status: 'experimental',
    risk: 'low',
    warning:
      'While this is on, a right-button drag on the grid selects a gap instead of opening the browser menu.',
    addedAt: '2026-08',
    requiresRefresh: false,
  },
  {
    id: 'sliding_tray',
    name: 'Sliding Tray',
    description:
      'Add a rail to a bin and a companion tray that slides along it, so small parts ride above the bin floor and pull aside to reach what is underneath.',
    status: 'experimental',
    risk: 'medium',
    warning:
      'Unfinished. The rail and tray geometry is still changing, the printed fit is unverified, and a design saved with a tray may not reopen the same way once this ships.',
    addedAt: '2026-08',
    requiresRefresh: false,
  },
  {
    id: 'community_showcase',
    name: 'Community Showcase',
    description:
      'Publish your bin designs to a shared community showcase and remix designs from others. Publishing needs a free sign-in; anything you publish is public under CC BY 4.0.',
    status: 'preview',
    risk: 'medium',
    warning:
      'Publishing is public and permanent enough to matter: designs appear in search engines and anyone can remix them. Switch this off to hide the Community tool and the Publish action.',
    addedAt: '2026-08',
    defaultEnabled: true,
    requiresRefresh: false,
  },
  {
    id: 'designer_settings_search',
    name: 'Designer settings search',
    description:
      'Search every bin-designer control by name or synonym from a bar at the top of the panel, then jump straight to it. An empty field lists every control for browsing.',
    status: 'preview',
    risk: 'low',
    addedAt: '2026-08',
    defaultEnabled: true,
    requiresRefresh: false,
  },
  {
    id: 'baseplate_screw_holes',
    name: 'Screw a Baseplate Down',
    description:
      'Add vertical holes through a baseplate so you can screw it to a drawer bottom, bench or wall. Four holes go into every printed piece, recessed so the head finishes flush and a bin still seats over it.',
    status: 'graduated',
    risk: 'medium',
    addedAt: '2026-08',
    graduatedAt: '2026-08',
    requiresRefresh: false,
  },
  {
    // Id kept from the feature's first name: it is the key your opt-in is
    // stored under, so renaming it would switch the feature back off for
    // everyone who had already turned it on.
    id: 'merge_bins_to_design',
    name: 'Bento Designer',
    description:
      'Design divided trays. Drag on the bin interior in the Bento workspace to draw a compartment any size you want, move and resize it, and set spares aside in the stash — or select two or more layout bins and merge them into one tray with walls where the bin edges were and your labels carried across.',
    status: 'graduated',
    risk: 'low',
    addedAt: '2026-08',
    graduatedAt: '2026-08',
    requiresRefresh: false,
  },
  {
    id: 'workshop',
    name: 'Workshop',
    description:
      'Build tool holders from parts. Place posts, fins, tubes, cradles and more on a Gridfinity base in 3D, stack and carve them, then export the result.',
    status: 'experimental',
    risk: 'medium',
    warning:
      'Early feature. Workshop builds auto-save to your library, sync when signed in, export to STL, 3MF and STEP, and can be placed in drawer layouts like any bin.',
    addedAt: '2026-08',
    requiresRefresh: false,
  },
  {
    id: 'spacemouse',
    name: 'SpaceMouse Navigation',
    description:
      'Fly the 3D previews with a 3Dconnexion SpaceMouse. Push, tilt and twist the puck to pan, zoom and orbit, and map its buttons to fit, view presets and undo. Tune speed and axis direction below.',
    status: 'experimental',
    risk: 'low',
    warning:
      'Needs a Chromium browser (Chrome, Edge or Opera) with WebHID. After turning this on, click Connect and pick your device once.',
    addedAt: '2026-08',
    requiresRefresh: false,
  },
] as const satisfies readonly FeatureFlag[];

export type FeatureId = (typeof FEATURE_FLAGS)[number]['id'];

export function getFeature(id: string): FeatureFlag | undefined {
  return FEATURE_FLAGS.find((f) => f.id === id);
}

export function getGraduatedFeatures(): FeatureFlag[] {
  return (FEATURE_FLAGS as readonly FeatureFlag[]).filter((f) => f.status === 'graduated');
}

export function getToggleableFeatures(): FeatureFlag[] {
  return (FEATURE_FLAGS as readonly FeatureFlag[]).filter(
    (f) => f.status === 'experimental' || f.status === 'preview'
  );
}
