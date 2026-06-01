import type { BinParams } from '@/shared/types/bin';

export type ExampleTechnique =
  | 'compartments'
  | 'wallCutouts'
  | 'floorCutouts'
  | 'scoop'
  | 'labelTab'
  | 'solid'
  | 'slotted'
  | 'halfBin'
  | 'lid'
  | 'handles'
  | 'customShape'
  | 'baseOptions';

export interface ExampleDesign {
  readonly id: string;
  readonly nameKey: string;
  readonly descriptionKey: string;
  readonly techniques: readonly ExampleTechnique[];
  readonly tier: 'technique' | 'showcase';
  readonly popular: boolean;
  readonly tags: readonly string[];
  readonly complexity: number;
  readonly params: BinParams;
  readonly thumbnail: string;
  readonly metrics: {
    readonly width: number;
    readonly depth: number;
    readonly height: number;
    readonly gridUnitMm: number;
  };
}

export const TECHNIQUE_CONFIG: Record<ExampleTechnique, { readonly labelKey: string }> = {
  compartments: { labelKey: 'binExamples.technique.compartments' },
  wallCutouts: { labelKey: 'binExamples.technique.wallCutouts' },
  floorCutouts: { labelKey: 'binExamples.technique.floorCutouts' },
  scoop: { labelKey: 'binExamples.technique.scoop' },
  labelTab: { labelKey: 'binExamples.technique.labelTab' },
  solid: { labelKey: 'binExamples.technique.solid' },
  slotted: { labelKey: 'binExamples.technique.slotted' },
  halfBin: { labelKey: 'binExamples.technique.halfBin' },
  lid: { labelKey: 'binExamples.technique.lid' },
  handles: { labelKey: 'binExamples.technique.handles' },
  customShape: { labelKey: 'binExamples.technique.customShape' },
  baseOptions: { labelKey: 'binExamples.technique.baseOptions' },
};
