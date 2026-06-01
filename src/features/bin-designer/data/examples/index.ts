import type { ExampleDesign, ExampleTechnique } from '@/features/bin-designer/types/exampleGallery';
import { COMPARTMENT_EXAMPLES } from './compartments';
import { WALL_CUTOUT_EXAMPLES, FLOOR_CUTOUT_EXAMPLES } from './cutouts';
import { SCOOP_EXAMPLES } from './scoops';
import { LABEL_EXAMPLES } from './labels';
import { LID_EXAMPLES } from './lids';
import { STYLE_EXAMPLES } from './styles';
import { HALF_BIN_EXAMPLES } from './halfBin';
import { SHOWCASE_EXAMPLES } from './showcase';
import { HERO_EXAMPLES } from './heroes';

export const EXAMPLE_DESIGNS: readonly ExampleDesign[] = [
  ...COMPARTMENT_EXAMPLES,
  ...WALL_CUTOUT_EXAMPLES,
  ...FLOOR_CUTOUT_EXAMPLES,
  ...SCOOP_EXAMPLES,
  ...LABEL_EXAMPLES,
  ...LID_EXAMPLES,
  ...STYLE_EXAMPLES,
  ...HALF_BIN_EXAMPLES,
  ...SHOWCASE_EXAMPLES,
  ...HERO_EXAMPLES,
];

export function getExamplesByTechnique(technique: ExampleTechnique): ExampleDesign[] {
  return EXAMPLE_DESIGNS.filter((e) => e.techniques.includes(technique));
}
