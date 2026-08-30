/**
 * Whether a bin design carries any text the typography settings would govern.
 *
 * Text reaches the type system from more places than the type specimen tracks:
 * wall and lid text (`surfaceText`), per-compartment tab captions
 * (`compartmentTexts`), spanning-tab captions (`label.rowTexts`), and engraved
 * cutout labels on both the bin and the lid. A cutout's label only counts when
 * the cutout actually engraves it (a `text` cutout, or one with `engraveLabel`);
 * a plain cavity's label is editor metadata, not geometry. Used to hide the
 * Typography section when there is nothing for it to style.
 */

import type { BinParams, Cutout } from '../types';

const filled = (text: string | undefined): boolean => (text?.trim() ?? '') !== '';

function cutoutEngravesText(cutout: Cutout): boolean {
  if (cutout.shape !== 'text' && !cutout.engraveLabel) return false;
  return filled(cutout.label) || (cutout.array?.labels?.some(filled) ?? false);
}

export function binHasText(params: BinParams): boolean {
  const surface = params.surfaceText;
  if (surface) {
    if (filled(surface.lidText)) return true;
    if (surface.walls && Object.values(surface.walls).some(filled)) return true;
  }
  if (params.compartments.compartmentTexts?.some(filled)) return true;
  if (params.label.rowTexts?.some(filled)) return true;
  if (params.cutouts.some(cutoutEngravesText)) return true;
  if (params.lid.cutouts?.some(cutoutEngravesText)) return true;
  return false;
}
