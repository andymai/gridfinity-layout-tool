import type { BinParams } from '@/shared/types/bin';
import type { ExampleTechnique } from '@/shared/types/exampleTechniques';

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
