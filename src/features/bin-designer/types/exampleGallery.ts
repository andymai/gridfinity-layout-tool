import type { BinParams } from '@/shared/types/bin';

export type ExampleTechnique =
  | 'compartments'
  | 'wallCutouts'
  | 'scoop'
  | 'labelTab'
  | 'slotted'
  | 'lid'
  | 'handles'
  | 'customShape'
  | 'wallPattern';

export interface ExampleDesign {
  readonly id: string;
  readonly nameKey: string;
  readonly descriptionKey: string;
  readonly techniques: readonly ExampleTechnique[];
  readonly tier: 'technique' | 'showcase';
  readonly tags: readonly string[];
  readonly complexity: number;
  readonly params: BinParams;
  readonly metrics: {
    readonly width: number;
    readonly depth: number;
    readonly height: number;
    readonly gridUnitMm: number;
  };
  /** Whether this example uses multi-color feature colors (selective color). */
  readonly colored?: boolean;
}

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
};
