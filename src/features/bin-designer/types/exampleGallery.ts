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
  | 'baseOptions'
  | 'wallPattern';

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
  readonly metrics: {
    readonly width: number;
    readonly depth: number;
    readonly height: number;
    readonly gridUnitMm: number;
  };
  /**
   * Optional presentation overrides for the pre-rendered thumbnail + initial
   * 3D pose. Azimuth/elevation in degrees; zoom is a multiplier on the framed
   * distance (>1 = further). Omitted = the default isometric framing.
   */
  readonly camera?: {
    readonly azimuth?: number;
    readonly elevation?: number;
    readonly zoom?: number;
  };
  /** Lid/explode amount (0..1) applied when rendering. Omitted = 0. */
  readonly explode?: number;
  /** Whether this example uses multi-color feature colors (selective color). */
  readonly colored?: boolean;
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
  wallPattern: { labelKey: 'binExamples.technique.wallPattern' },
};
