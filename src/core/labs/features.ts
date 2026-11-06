import type { FeatureFlag } from './types';

export const FEATURE_FLAGS = [
  {
    id: 'brepkit_kernel',
    name: 'Alternative 3D Engine',
    description:
      'Try an alternative 3D engine for generating your bin models. Uses less memory and loads quicker than the default engine.',
    risk: 'high',
    warning:
      'This engine is still in development. Exported models may have geometry defects or look different than expected. Reload the page after toggling.',
  },
  {
    id: 'show_generation_perf',
    name: 'Generation Performance Overlay',
    description:
      'Show a small overlay in the bin designer with per-stage timings, cache hit rates, hex-center counts, and recent generation history. Useful for diagnosing slow bins and validating optimizations.',
    risk: 'low',
  },
  {
    id: 'community_fits_gap',
    name: 'Find Bins That Fit',
    description:
      'Select a gap in your drawer layout and see which community designs fit it. Adds a toolbar button, plus a right-button drag on the grid as a desktop shortcut.',
    risk: 'low',
    warning:
      'While this is on, a right-button drag on the grid selects a gap instead of opening the browser menu.',
  },
  {
    id: 'sliding_tray',
    name: 'Sliding Tray',
    description:
      'Add a rail to a bin and a companion tray that slides along it, so small parts ride above the bin floor and pull aside to reach what is underneath.',
    risk: 'medium',
    warning:
      'Unfinished. The rail and tray geometry is still changing, the printed fit is unverified, and a design saved with a tray may not reopen the same way once this ships.',
  },
  {
    id: 'workshop',
    name: 'Workshop',
    description:
      'Build tool holders from parts. Place posts, fins, tubes, cradles and more on a Gridfinity base in 3D, stack and carve them, then export the result.',
    risk: 'medium',
    warning:
      'Early feature. Workshop builds auto-save to your library, sync when signed in, export to STL, 3MF and STEP, and can be placed in drawer layouts like any bin.',
  },
  {
    id: 'spacemouse',
    name: 'SpaceMouse Navigation',
    description:
      'Fly the 3D previews with a 3Dconnexion SpaceMouse. Push, tilt and twist the puck to pan, zoom and orbit, and map its buttons to fit, view presets and undo.',
    risk: 'low',
    warning:
      'Uses the 3Dconnexion driver when installed (any browser; speed and axis direction live in its control panel). Without the driver it falls back to WebHID, which needs a Chromium browser (Chrome, Edge or Opera) and a one-time Connect.',
  },
  {
    id: 'slant',
    name: 'Slanted Bins',
    description:
      'Lean a bin toward one side so pens, markers and tools too tall to stand fit a shallow drawer. The base stays flat on the grid, a row of slanted bins leans on itself, and the last bin can take an end support.',
    risk: 'low',
  },
  {
    id: 'places',
    name: 'Find What Your Bins Hold',
    description:
      'Say what each bin holds, then find it in any layout from the command palette (Ctrl/Cmd+K) or the layouts sheet on a phone, and jump straight to it. Folders become places, areas and storage units.',
    risk: 'low',
  },
] as const satisfies readonly FeatureFlag[];

export type FeatureId = (typeof FEATURE_FLAGS)[number]['id'];

export function getFeature(id: string): FeatureFlag | undefined {
  return FEATURE_FLAGS.find((f) => f.id === id);
}
