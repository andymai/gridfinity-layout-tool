/**
 * Where a paper label's text lands.
 *
 * The caption goes through the same `planTypeBlock` as a printed label plate,
 * so a tape label and a plate for one bin set type the same way. The name takes
 * the top band and an optional detail line (a part number, a size) the bottom
 * band in a monospaced face, where a misread character costs a wrong reorder.
 *
 * Frame: millimetres, origin at the label centre, +X along the label, +Y up.
 */

import { DEFAULT_TEXT_STYLE_DEFAULTS } from '@/shared/types/bin';
import type { TextFontFamily, TextStyleDefaults } from '@/shared/types/bin';
import { planToPathData, planTypeBlock } from '@/shared/utils/typePlan';
import type { TypeBlockPlan, TypeMeasurer } from '@/shared/utils/typePlan';

export const LABEL_NAME_FONT: TextFontFamily = 'atkinson-bold';
export const LABEL_DETAIL_FONT: TextFontFamily = 'jetbrains-mono';

/** Clear space at each end of the label, inside the printed image. */
const END_MARGIN_MM = 1.5;
/** Clear space above and below the text, as a share of the printable height. */
const EDGE_SHARE = 0.05;
/** The detail band's share of the text height, and the gap between bands. */
const DETAIL_SHARE = 0.36;
const GAP_SHARE = 0.06;
/**
 * Smallest em sizes that still read on a 180 dpi head: about 9 dots of cap
 * height for the name and 8 for the detail.
 */
const NAME_MIN_EM_MM = 1.9;
const DETAIL_MIN_EM_MM = 1.6;
/** The longest a fit-to-text tape label grows before its text shrinks. */
export const FIT_MAX_LENGTH_MM = 200;

export interface LabelText {
  readonly name: string;
  readonly detail: string;
}

/** The printable area. A null length grows the label to fit its text. */
export interface LabelBox {
  readonly heightMm: number;
  readonly lengthMm: number | null;
}

export type LabelLine = 'name' | 'detail';

export interface PlacedTypeBlock {
  readonly line: LabelLine;
  readonly plan: TypeBlockPlan;
  /** Offset of the block's frame from the label centre. */
  readonly x: number;
  readonly y: number;
}

export interface LabelPlan {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly blocks: readonly PlacedTypeBlock[];
  /** False when some text could not be set at a legible size. */
  readonly fits: boolean;
}

function labelStyle(font: TextFontFamily, minEm: number, maxEm: number): TextStyleDefaults {
  return {
    ...DEFAULT_TEXT_STYLE_DEFAULTS,
    font,
    margin: 0,
    minFontSize: minEm,
    maxFontSize: maxEm,
    lineGap: 0.15,
  };
}

function inkWidth(plan: TypeBlockPlan | null): number {
  return plan === null ? 0 : plan.maxX - plan.minX;
}

/** A name takes another line only when that sets it at least this much larger. */
const EXTRA_LINE_GAIN = 1.1;

/**
 * The name broken at word boundaries into one, two and three lines, each split
 * chosen so its widest line is as narrow as possible. `planTypeBlock` wraps
 * only once a single line no longer fits, which on a short label leaves a long
 * description on one line at the smallest legible size.
 *
 * Line widths are summed from per-word advances: the kerning lost at a word
 * boundary is far below what changes a break.
 */
function nameLineOptions(name: string, measurer: TypeMeasurer): string[] {
  const words = name.split(/\s+/);
  const advance = (text: string): number => measurer.run(text, LABEL_NAME_FONT)?.advance ?? 0;
  const wordWidths = words.map(advance);
  const space = advance('x x') - 2 * advance('x');
  const width = (from: number, to: number): number => {
    let sum = space * (to - from - 1);
    for (let i = from; i < to; i++) sum += wordWidths[i];
    return sum;
  };
  const join = (from: number, to: number): string => words.slice(from, to).join(' ');

  const options = [name];
  let best2: number[] | null = null;
  let best3: number[] | null = null;
  let widest2 = Infinity;
  let widest3 = Infinity;
  for (let i = 1; i < words.length; i++) {
    const two = Math.max(width(0, i), width(i, words.length));
    if (two < widest2) [best2, widest2] = [[i], two];
    for (let j = i + 1; j < words.length; j++) {
      const three = Math.max(width(0, i), width(i, j), width(j, words.length));
      if (three < widest3) [best3, widest3] = [[i, j], three];
    }
  }
  if (best2) options.push([join(0, best2[0]), join(best2[0], words.length)].join('\n'));
  if (best3) {
    const [i, j] = best3;
    options.push([join(0, i), join(i, j), join(j, words.length)].join('\n'));
  }
  return options;
}

export function planLabel(text: LabelText, box: LabelBox, measurer: TypeMeasurer): LabelPlan {
  const name = text.name.trim();
  const detail = text.detail.trim();
  const edge = box.heightMm * EDGE_SHARE;
  const inner = box.heightMm - 2 * edge;
  const hasDetail = detail !== '';
  const gap = hasDetail ? inner * GAP_SHARE : 0;
  const detailBand = hasDetail ? (inner - gap) * DETAIL_SHARE : 0;
  const nameBand = inner - gap - detailBand;

  const fitToText = box.lengthMm === null;
  const hostWidth = fitToText ? FIT_MAX_LENGTH_MM : box.lengthMm - 2 * END_MARGIN_MM;

  let namePlan: TypeBlockPlan | null = null;
  if (name !== '') {
    for (const option of fitToText ? [name] : nameLineOptions(name, measurer)) {
      const plan = planTypeBlock(
        {
          text: option,
          style: labelStyle(LABEL_NAME_FONT, NAME_MIN_EM_MM, nameBand * 2),
          host: { width: hostWidth, depth: nameBand },
          allowWrap: false,
        },
        measurer
      );
      if (plan && (namePlan === null || plan.fontSize > namePlan.fontSize * EXTRA_LINE_GAIN)) {
        namePlan = plan;
      }
    }
  }
  const detailPlan = hasDetail
    ? planTypeBlock(
        {
          text: detail,
          style: labelStyle(LABEL_DETAIL_FONT, DETAIL_MIN_EM_MM, detailBand * 2),
          host: { width: hostWidth, depth: detailBand },
          allowWrap: false,
        },
        measurer
      )
    : null;

  const widthMm = fitToText
    ? Math.max(box.heightMm, Math.max(inkWidth(namePlan), inkWidth(detailPlan)) + 2 * END_MARGIN_MM)
    : box.lengthMm;

  const blocks: PlacedTypeBlock[] = [];
  const top = box.heightMm / 2 - edge;
  // Centre each block on its ink rather than its advance, so a caption with
  // a wide trailing glyph or a part number sits optically centred.
  if (namePlan) {
    blocks.push({
      line: 'name',
      plan: namePlan,
      x: -(namePlan.minX + namePlan.maxX) / 2,
      y: top - nameBand / 2,
    });
  }
  if (detailPlan) {
    blocks.push({
      line: 'detail',
      plan: detailPlan,
      x: -(detailPlan.minX + detailPlan.maxX) / 2,
      y: -top + detailBand / 2,
    });
  }

  return {
    widthMm,
    heightMm: box.heightMm,
    blocks,
    fits: name !== '' && namePlan !== null && (!hasDetail || detailPlan !== null),
  };
}

export interface LabelPath {
  readonly line: LabelLine;
  readonly d: string;
  readonly x: number;
  readonly y: number;
}

/** Glyph outlines for each block, in the block's own frame (+Y up). */
export function labelPaths(plan: LabelPlan, measurer: TypeMeasurer): LabelPath[] {
  return plan.blocks.map((block) => ({
    line: block.line,
    d: planToPathData(block.plan, measurer),
    x: block.x,
    y: block.y,
  }));
}
