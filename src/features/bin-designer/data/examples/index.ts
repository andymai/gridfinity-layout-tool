import type { ExampleDesign, ExampleTechnique } from '@/features/bin-designer/types/exampleGallery';
import { COMPARTMENT_EXAMPLES } from './compartments';

export const EXAMPLE_DESIGNS: readonly ExampleDesign[] = [...COMPARTMENT_EXAMPLES];

export function getExamplesByTechnique(technique: ExampleTechnique): ExampleDesign[] {
  return EXAMPLE_DESIGNS.filter((e) => e.techniques.includes(technique));
}
