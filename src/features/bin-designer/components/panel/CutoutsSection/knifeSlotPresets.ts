import type { KnifeSpec } from '@/features/bin-designer/types';

/**
 * Curated knife presets for `knifeSlot` cutouts. Values are nominal knife
 * measurements (what a spec sheet or a caliper says); the slot dimensions a
 * preset produces come from `knifeSlotDimensions` (types/knifeBlock.ts), which
 * bakes the fit clearance in so the numbers the user sees in the inspector are
 * the real cut sizes.
 *
 * Names are i18n keys (unlike the hardware-size presets, knife names are
 * words, not numbers).
 */
export interface KnifeSlotPreset {
  /** Stable option id, also stored as {@link KnifeSpec.presetId}. */
  readonly id: string;
  /** i18n key for the display name, e.g. `binDesigner.cutouts.knifePreset.chef8`. */
  readonly labelKey: string;
  readonly knife: KnifeSpec;
}

export const KNIFE_SLOT_PRESETS: readonly KnifeSlotPreset[] = [
  {
    id: 'chef8',
    labelKey: 'binDesigner.cutouts.knifePreset.chef8',
    knife: {
      presetId: 'chef8',
      bladeLengthMm: 205,
      heelHeightMm: 47,
      spineThicknessMm: 2.3,
      handleWidthMm: 26,
      handleHeightMm: 22,
      openEnd: 'end',
    },
  },
  {
    id: 'chefWood',
    labelKey: 'binDesigner.cutouts.knifePreset.chefWood',
    knife: {
      presetId: 'chefWood',
      bladeLengthMm: 205,
      heelHeightMm: 47,
      spineThicknessMm: 2.5,
      // A riveted or wa-style wooden handle is chunkier than a moulded one in
      // both directions — the whole reason width and height are separate.
      handleWidthMm: 34,
      handleHeightMm: 26,
      openEnd: 'end',
    },
  },
  {
    id: 'santoku7',
    labelKey: 'binDesigner.cutouts.knifePreset.santoku7',
    knife: {
      presetId: 'santoku7',
      bladeLengthMm: 180,
      heelHeightMm: 46,
      spineThicknessMm: 2,
      handleWidthMm: 24,
      handleHeightMm: 21,
      openEnd: 'end',
    },
  },
  {
    id: 'bread9',
    labelKey: 'binDesigner.cutouts.knifePreset.bread9',
    knife: {
      presetId: 'bread9',
      bladeLengthMm: 230,
      heelHeightMm: 33,
      spineThicknessMm: 2.2,
      handleWidthMm: 24,
      handleHeightMm: 20,
      openEnd: 'end',
    },
  },
  {
    id: 'utility',
    labelKey: 'binDesigner.cutouts.knifePreset.utility',
    knife: {
      presetId: 'utility',
      bladeLengthMm: 140,
      heelHeightMm: 26,
      spineThicknessMm: 1.8,
      handleWidthMm: 22,
      handleHeightMm: 18,
      openEnd: 'end',
    },
  },
  {
    id: 'paring',
    labelKey: 'binDesigner.cutouts.knifePreset.paring',
    knife: {
      presetId: 'paring',
      bladeLengthMm: 90,
      heelHeightMm: 20,
      spineThicknessMm: 1.8,
      handleWidthMm: 20,
      handleHeightMm: 17,
      openEnd: 'end',
    },
  },
  {
    id: 'steak',
    labelKey: 'binDesigner.cutouts.knifePreset.steak',
    knife: {
      presetId: 'steak',
      bladeLengthMm: 115,
      heelHeightMm: 19,
      spineThicknessMm: 1.5,
      handleWidthMm: 20,
      handleHeightMm: 17,
      openEnd: 'end',
    },
  },
];

export function knifeSlotPresetById(id: string | undefined): KnifeSlotPreset | undefined {
  return KNIFE_SLOT_PRESETS.find((preset) => preset.id === id);
}

/** What a freshly placed knife slot is sized for: the 8" chef knife. */
export const DEFAULT_KNIFE_PRESET: KnifeSlotPreset = KNIFE_SLOT_PRESETS[0];
