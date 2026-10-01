import { isPartialMask } from '@/shared/utils/cellMask';
import { hexContrast } from '@/shared/utils/color';
import type { BinParams, TextMode } from '../types';
import { WALL_TEXT_SIDES, resolveTextStyle } from '../types';
import {
  computeActiveZones,
  getZoneColor,
  hasCaption,
  lidTextHosts,
  normalizeHex,
} from '../types/featureColors';

/** The colour zones text can sit on. A swappable plate prints in the label-tab colour. */
export type TextSurface = 'labelTab' | 'body' | 'lid';

/** Below this two colours read as one on a print: #d4d8dc on #d0d4d8 is 1.03. */
const INDISTINCT_CONTRAST = 1.25;

/** A colour the design already uses reads as lettering from here, without a new filament. */
const READABLE_CONTRAST = 3;

const isFlat = (mode: TextMode): boolean => mode === 'flat';

/**
 * The surfaces carrying flat text, where colour is the only thing separating
 * the letters from what they sit on. Gated the way the worker builds each
 * host, so a caption that prints nothing never asks for a colour.
 */
export function flatTextSurfaces(p: BinParams): ReadonlySet<TextSurface> {
  const out = new Set<TextSurface>();
  const plateFlat = isFlat(p.textDefaults.mode);

  // Polygon bins build no label tabs, so their captions and plates print nothing.
  if (p.label.enabled && !isPartialMask(p.cellMask)) {
    const texts =
      (p.label.span === true ? p.label.rowTexts : p.compartments.compartmentTexts) ?? [];
    const words = texts.some((t) => t.trim() !== '');
    if ((p.label.mode ?? 'text') === 'socket') {
      const icons =
        p.label.span !== true && (p.compartments.labelIcons ?? []).some((icon) => icon !== null);
      if ((words || icons) && plateFlat) out.add('labelTab');
    } else if (words && isFlat(resolveTextStyle(p.textDefaults, p.label.textStyle).mode)) {
      out.add('labelTab');
    }
  }

  const walls = p.surfaceText?.walls;
  if (walls && !isPartialMask(p.cellMask)) {
    const flatWall = WALL_TEXT_SIDES.some(
      (side) =>
        (walls[side]?.trim() ?? '') !== '' &&
        isFlat(
          resolveTextStyle(p.textDefaults, p.surfaceText?.style, p.surfaceText?.wallStyles?.[side])
            .mode
        )
    );
    if (flatWall) out.add('body');
  }

  for (const c of p.cutouts) {
    if (!hasCaption(c)) continue;
    if (c.labelMode === 'socket' && c.shape !== 'text') {
      if (plateFlat) out.add('labelTab');
    } else if (isFlat(resolveTextStyle(p.textDefaults, c.textStyle).mode)) {
      out.add('body');
    }
  }

  if (p.lid.enabled && (p.base.stackingLip || p.lid.attachment === 'slide')) {
    const { caption, elements } = lidTextHosts(p);
    const captionFlat =
      caption &&
      isFlat(resolveTextStyle(p.textDefaults, p.surfaceText?.style, p.surfaceText?.lidStyle).mode);
    const elementFlat = p.lid.cutouts?.some(
      (c) => elements.includes(c) && isFlat(resolveTextStyle(p.textDefaults, c.textStyle).mode)
    );
    if (captionFlat || elementFlat === true) out.add('lid');
  }

  return out;
}

/**
 * Flat-text surfaces the Text colour is too close to, so their letters would
 * not show. `only` narrows the check to one host's surface.
 */
export function hiddenFlatTextSurfaces(p: BinParams, only?: readonly TextSurface[]): TextSurface[] {
  const text = p.featureColors.text;
  return [...flatTextSurfaces(p)].filter(
    (surface) =>
      (only === undefined || only.includes(surface)) &&
      hexContrast(text, getZoneColor(p.featureColors, surface)) < INDISTINCT_CONTRAST
  );
}

/**
 * A Text colour that reads on every given surface: the design colour that
 * stands out most from all of them, when it stands out enough, since reusing
 * one costs no extra filament; otherwise black or white, whichever contrasts
 * more.
 */
export function contrastingTextColor(p: BinParams, surfaces: readonly TextSurface[]): string {
  const backgrounds = surfaces.map((surface) => getZoneColor(p.featureColors, surface));
  const worstContrast = (hex: string): number =>
    Math.min(...backgrounds.map((bg) => hexContrast(hex, bg)));

  let best: string | null = null;
  let bestContrast = 0;
  for (const zone of computeActiveZones(p)) {
    if (zone === 'text') continue;
    const hex = normalizeHex(getZoneColor(p.featureColors, zone));
    const contrast = worstContrast(hex);
    if (contrast > bestContrast) {
      best = hex;
      bestContrast = contrast;
    }
  }
  if (best !== null && bestContrast >= READABLE_CONTRAST) return best;
  return worstContrast('#000000') >= worstContrast('#ffffff') ? '#000000' : '#ffffff';
}
