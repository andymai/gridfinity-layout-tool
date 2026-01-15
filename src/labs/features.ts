import type { FeatureFlag } from "./types"

export const FEATURE_FLAGS = [
  {
    id: "collaborative_editing",
    name: "Collaborative Editing",
    description:
      "Work on layouts together in real-time with other people. Share a link and see each other's cursors as you design.",
    status: "experimental",
    risk: "medium",
    warning: "This feature is experimental. Real-time sync may have delays or conflicts.",
    addedAt: "2026-01",
    requiresRefresh: false,
    comingSoon: false,
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

export type FeatureId = (typeof FEATURE_FLAGS)[number]["id"]

export function getFeature(id: string): FeatureFlag | undefined {
  return FEATURE_FLAGS.find((f) => f.id === id)
}

export function getActiveFeatures(): FeatureFlag[] {
  return (FEATURE_FLAGS as readonly FeatureFlag[]).filter(
    (f) => f.status !== "deprecated"
  )
}

export function getGraduatedFeatures(): FeatureFlag[] {
  return (FEATURE_FLAGS as readonly FeatureFlag[]).filter(
    (f) => f.status === "graduated"
  )
}

export function getToggleableFeatures(): FeatureFlag[] {
  return (FEATURE_FLAGS as readonly FeatureFlag[]).filter(
    (f) => f.status === "experimental" || f.status === "preview"
  )
}
