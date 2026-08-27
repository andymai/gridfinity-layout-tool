import { DEFAULT_BIN_PARAMS } from '@/features/bin-designer/constants/defaults';
import type { ExampleDesign } from '@/features/bin-designer/types/exampleGallery';
import type { Cutout, KnifeSpec } from '@/features/bin-designer/types';
import { KNIFE_SLOT_DEFAULT_CHAMFER, knifeSlotDimensions } from '@/features/bin-designer/types';
import { KNIFE_SLOT_PRESETS } from '../../components/panel/CutoutsSection/knifeSlotPresets';

function preset(id: string): KnifeSpec {
  const found = KNIFE_SLOT_PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`unknown knife preset: ${id}`);
  return found.knife;
}

/**
 * Slots share the right-hand exit wall, so each starts where its blade ends:
 * the bolster of every knife lands at the block face and the handles line up
 * over the companion rest.
 */
function slot(id: string, presetId: string, xEnd: number, y: number): Cutout {
  const knife = preset(presetId);
  const dims = knifeSlotDimensions(knife);
  return {
    id,
    shape: 'knifeSlot',
    x: xEnd - dims.widthMm,
    y,
    width: dims.widthMm,
    depth: dims.depthMm,
    cutDepth: dims.cutDepthMm,
    rotation: 0,
    cornerRadius: 0,
    label: '',
    groupId: null,
    chamferWidth: KNIFE_SLOT_DEFAULT_CHAMFER,
    knife,
  };
}

/** Interior right edge of the 6u block, minus a hair so the slot never clamps. */
const X_END = 246;

export const KNIFE_BLOCK_EXAMPLES: ExampleDesign[] = [
  {
    id: 'knife-block-chef-trio',
    nameKey: 'binExamples.knifeBlockChefTrio.name',
    descriptionKey: 'binExamples.knifeBlockChefTrio.description',
    techniques: ['knifeSlots'],
    tier: 'showcase',
    tags: ['kitchen', 'knife-block', 'drawer', '6x2'],
    complexity: 2,
    params: {
      ...DEFAULT_BIN_PARAMS,
      width: 6,
      depth: 2,
      height: 8,
      style: 'solid',
      base: { ...DEFAULT_BIN_PARAMS.base, solid: true },
      // 27mm pitch: the widest of these handles is ~26mm, so anything tighter
      // and the knives themselves cannot lie side by side — and the rest's
      // saddle cradles would merge into one indistinct scallop.
      cutouts: [
        slot('knife-chef', 'chef8', X_END, 11.65),
        slot('knife-santoku', 'santoku7', X_END, 38.8),
        slot('knife-paring', 'paring', X_END, 65.9),
      ],
      knifeRest: { enabled: true },
    },
    metrics: { width: 6, depth: 2, height: 8, gridUnitMm: DEFAULT_BIN_PARAMS.gridUnitMm },
  },
];
