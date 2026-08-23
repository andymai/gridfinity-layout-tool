/**
 * Bin-designer technique tags. Used to categorize curated examples
 * (`src/features/bin-designer/types/exampleGallery.ts`) and, via
 * `deriveTechniques` in `src/shared/utils/communityTechniques.ts`, to
 * auto-tag community-published designs. Lives in shared/ (rather than
 * bin-designer/) so features/community can reference the same union
 * without a cross-feature import.
 */

export type ExampleTechnique =
  | 'compartments'
  | 'wallCutouts'
  | 'scoop'
  | 'labelTab'
  | 'slotted'
  | 'lid'
  | 'handles'
  | 'customShape'
  | 'wallPattern'
  | 'knifeSlots'
  | 'workshop';

export const TECHNIQUE_CONFIG: Record<ExampleTechnique, { readonly labelKey: string }> = {
  compartments: { labelKey: 'binExamples.technique.compartments' },
  wallCutouts: { labelKey: 'binExamples.technique.wallCutouts' },
  scoop: { labelKey: 'binExamples.technique.scoop' },
  labelTab: { labelKey: 'binExamples.technique.labelTab' },
  slotted: { labelKey: 'binExamples.technique.slotted' },
  lid: { labelKey: 'binExamples.technique.lid' },
  handles: { labelKey: 'binExamples.technique.handles' },
  customShape: { labelKey: 'binExamples.technique.customShape' },
  wallPattern: { labelKey: 'binExamples.technique.wallPattern' },
  knifeSlots: { labelKey: 'binExamples.technique.knifeSlots' },
  workshop: { labelKey: 'binExamples.technique.workshop' },
};
