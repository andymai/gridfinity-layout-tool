/**
 * Labs Feature Registry
 *
 * This module contains the registry of all experimental features.
 * Add new features here to make them available in the Labs UI.
 */

import type { FeatureFlag } from "./types"

/**
 * Registry of all experimental features.
 * Add new features here to make them available in Labs.
 */
export const FEATURE_FLAGS = [
  {
    id: "collaborative_editing",
    name: "Collaborative Editing",
    description:
      "Work on layouts together in real-time with other people. Share a link and see each other's cursors as you design.",
    status: "experimental",
    risk: "medium",
    addedAt: "2026-01",
    requiresRefresh: false,
    comingSoon: true,
  },
  {
    id: "layout_to_print",
    name: "Layout-to-Print Export",
    description:
      "Generate STL files for all bins in your layout. Download a complete package with everything you need to 3D print your layout.",
    status: "experimental",
    risk: "low",
    addedAt: "2026-01",
    requiresRefresh: false,
    comingSoon: true,
  },
] as const satisfies readonly FeatureFlag[]

/**
 * Type-safe feature IDs derived from the registry.
 */
export type FeatureId = (typeof FEATURE_FLAGS)[number]["id"]

/**
 * Get a feature by ID with type safety.
 */
export function getFeature(id: string): FeatureFlag | undefined {
  return FEATURE_FLAGS.find((f) => f.id === id)
}

/**
 * Get all active (non-deprecated) features.
 */
export function getActiveFeatures(): FeatureFlag[] {
  // Cast to FeatureFlag[] to allow comparison with all status types
  return (FEATURE_FLAGS as readonly FeatureFlag[]).filter(
    (f) => f.status !== "deprecated"
  )
}

/**
 * Get graduated features (for "What's New" display).
 */
export function getGraduatedFeatures(): FeatureFlag[] {
  // Cast to FeatureFlag[] to allow comparison with all status types
  return (FEATURE_FLAGS as readonly FeatureFlag[]).filter(
    (f) => f.status === "graduated"
  )
}

/**
 * Get experimental and preview features (toggleable).
 */
export function getToggleableFeatures(): FeatureFlag[] {
  // Cast to FeatureFlag[] to allow comparison with all status types
  return (FEATURE_FLAGS as readonly FeatureFlag[]).filter(
    (f) => f.status === "experimental" || f.status === "preview"
  )
}
