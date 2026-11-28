import type { SummaryEntry } from '../components/YearCardView/cardCopy';
import { mix } from '../look/color';
import { DISPLAY, DISPLAY_WIDE, TEXT, familyFor } from '../look/fonts';
import { BEAT, clamp01, easeOut, springContact, springX, squash } from '../look/motion';
import { PALETTES } from '../look/palettes';
import { DISPLAY_TRACKING, cssFont, fitSize, type FontSpec } from '../look/typeset';
import { roundRect } from './paint';
import {
  CONTENT_TOP,
  CONTENT_W,
  GAP_V,
  MARGIN,
  blockBottom,
  footer,
  textBlock,
  type Scene,
  type SceneInput,
} from './scene';

const PAD = 20;
const FRONT_H = 196;
const GAP = 16;
const OPEN = 44;
const LABEL_SIZE = 34;
const VALUE_SIZE = 88;

/** Each row wears the colours of the card it sums up. */
function rowColours(entry: SummaryEntry): { readonly face: string; readonly ink: string } {
  switch (entry.kind) {
    case 'drawers':
      return { face: PALETTES.drawers.bg, ink: PALETTES.drawers.ink };
    case 'bins':
      return { face: PALETTES.bins.bg, ink: PALETTES.bins.ink };
    case 'designs':
      return { face: PALETTES.designs.bg, ink: PALETTES.designs.ink };
    case 'printerTime':
      return { face: PALETTES.filament.bg, ink: PALETTES.filament.ink };
    case 'type':
      return { face: PALETTES.type.bg, ink: PALETTES.type.vis };
  }
}

/** The year filed in a cabinet, one drawer shutting each half beat. */
export function summaryScene(input: SceneInput, entries: readonly SummaryEntry[]): Scene {
  const P = PALETTES.summary;
  const yearFont: FontSpec = {
    tracking: DISPLAY_TRACKING,
    family: familyFor(DISPLAY_WIDE, input.locale),
    weight: 900,
    size: 240,
    lineHeight: 206,
  };
  const year = textBlock(input, {
    key: 'year',
    role: 'title',
    text: String(input.stats.year),
    y: CONTENT_TOP,
    color: P.ink,
    enter: 0,
    rise: 48,
    maxLines: 1,
    font: yearFont,
  });
  const top = blockBottom(year) + GAP_V;
  const height = 2 * PAD + entries.length * FRONT_H + (entries.length - 1) * GAP;
  const w = CONTENT_W - 2 * PAD;
  const labelFont: FontSpec = {
    family: familyFor(TEXT, input.locale),
    weight: 600,
    size: LABEL_SIZE,
    lineHeight: LABEL_SIZE * 1.2,
  };
  const valueBase: FontSpec = {
    family: familyFor(DISPLAY, input.locale),
    weight: 900,
    size: VALUE_SIZE,
    lineHeight: VALUE_SIZE,
  };
  const rows = entries.map((entry, index) => {
    const colours = rowColours(entry);
    const size = fitSize(entry.value, w - 26 - 100, valueBase, input.measure, VALUE_SIZE);
    const labelWidth = Math.min(w - 120, input.measure(entry.label, labelFont));
    return {
      entry,
      ...colours,
      y: top + PAD + index * (FRONT_H + GAP),
      contact: (1 + index * 0.5) * BEAT,
      valueFont: { ...valueBase, size },
      labelWidth,
    };
  });
  const SD = 0.55;
  const SB = 0.22;
  const { first } = springContact(SD, SB);
  const x = MARGIN + PAD;
  return {
    kind: 'summary',
    colours: P,
    texts: [year, footer(input, P.ink)],
    still: (1 + rows.length * 0.5) * BEAT + 1,
    draw: ({ ctx, t, reduced }) => {
      roundRect(ctx, MARGIN, top, CONTENT_W, height, 26, P.cab);
      for (const row of rows) {
        roundRect(ctx, x, row.y, w, FRONT_H, 12, P.slot);
        let open = 0;
        let sx = 1;
        let sy = 1;
        let alpha = 1;
        if (reduced) alpha = easeOut(clamp01((t - row.contact) / 0.3));
        else {
          const x2 = Math.abs(springX(t - (row.contact - first), SD, SB));
          const s = squash(t - row.contact, 0.03);
          open = OPEN * x2;
          sx = 1 + 0.03 * x2 + s * 0.4;
          sy = 1 + 0.03 * x2 - s;
        }
        if (alpha <= 0.001) continue;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(x + w / 2, row.y + FRONT_H + open);
        ctx.scale(sx, sy);
        ctx.translate(-(x + w / 2), -(row.y + FRONT_H));
        roundRect(ctx, x, row.y, w, FRONT_H, 12, row.face);
        roundRect(ctx, x, row.y, w, 10, [12, 12, 0, 0], mix(row.face, '#FFFFFF', 0.3));
        roundRect(
          ctx,
          x + w - 64,
          row.y + FRONT_H / 2 - 52,
          26,
          104,
          13,
          mix(row.face, '#000000', 0.4)
        );
        const holderW = row.labelWidth + 32;
        const holderH = LABEL_SIZE * 1.2 + 8;
        roundRect(ctx, x + 26, row.y + 24, holderW, holderH, 8, mix(row.face, '#000000', 0.3));
        roundRect(ctx, x + 30, row.y + 28, holderW - 8, holderH - 8, 5, '#FFFFFF');
        ctx.fillStyle = '#121A5C';
        ctx.font = cssFont(labelFont);
        ctx.textBaseline = 'middle';
        ctx.fillText(row.entry.label, x + 42, row.y + 24 + holderH / 2, row.labelWidth);
        ctx.fillStyle = row.ink;
        ctx.font = cssFont(row.valueFont);
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(row.entry.value, x + 26, row.y + 88 + VALUE_SIZE * 0.8);
        ctx.restore();
      }
    },
  };
}
