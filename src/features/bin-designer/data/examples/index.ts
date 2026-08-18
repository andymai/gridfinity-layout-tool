import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import type { ExampleTechnique } from '@/shared/types/exampleTechniques';
import { WALL_CUTOUT_EXAMPLES } from './cutouts';
import { SCOOP_EXAMPLES } from './scoops';
import { LID_EXAMPLES } from './lids';
import { STYLE_EXAMPLES } from './styles';
import { SHOWCASE_EXAMPLES } from './showcase';
import { HERO_EXAMPLES } from './heroes';
import { KNIFE_BLOCK_EXAMPLES } from './knifeBlock';

export const EXAMPLE_DESIGNS: readonly ExampleDesign[] = [
  ...WALL_CUTOUT_EXAMPLES,
  ...SCOOP_EXAMPLES,
  ...LID_EXAMPLES,
  ...STYLE_EXAMPLES,
  ...SHOWCASE_EXAMPLES,
  ...HERO_EXAMPLES,
  ...KNIFE_BLOCK_EXAMPLES,
];

export function getExamplesByTechnique(technique: ExampleTechnique): ExampleDesign[] {
  return EXAMPLE_DESIGNS.filter((e) => e.techniques.includes(technique));
}
