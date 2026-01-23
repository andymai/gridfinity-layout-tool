/**
 * Feature flag definitions.
 *
 * This module defines all available feature flags in the application.
 * Feature flags enable gradual rollout and experimentation with new features.
 */

import type { FeatureFlag } from './types';

export const FEATURE_FLAGS = [
  {
    id: 'collaborative_editing',
    name: 'Collaborative Editing',
    description:
      "Work on layouts together in real-time with other people. Share a link and see each other's cursors as you design.",
    status: 'experimental',
    risk: 'medium',
    warning: 'This feature is experimental. Real-time sync may have delays or conflicts.',
    addedAt: '2026-01',
    requiresRefresh: false,
    comingSoon: false,
  },
  {
    id: 'layout_to_print',
    name: 'Layout-to-Print Export',
    description:
      'Generate STL files for all bins in your layout. Download a complete package with everything you need to 3D print your layout.',
    status: 'experimental',
    risk: 'low',
    addedAt: '2026-01',
    requiresRefresh: false,
    comingSoon: true,
  },
  {
    id: 'bin_designer',
    name: 'Bin Designer',
    description:
      'Create custom parametric Gridfinity bins with a visual designer. Configure dimensions, dividers, scoops, labels, and export STL files for 3D printing.',
    status: 'experimental',
    risk: 'medium',
    warning:
      'This feature is experimental. The CAD engine runs in a Web Worker and may use significant memory.',
    addedAt: '2026-01',
    requiresRefresh: false,
    comingSoon: false,
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
