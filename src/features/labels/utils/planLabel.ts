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
import type { TextFontFamily } from '@/shared/types/bin';
import { planToPathData, planTypeBlock } from '@/shared/utils/typePlan';
import type { TypeBlockPlan, TypeHostBox, TypeMeasurer } from '@/shared/utils/typePlan';

export const LABEL_NAME_FONT: TextFontFamily = 'atkinson-bold';
export const LABEL_DETAIL_FONT: TextFontFamily = 'jetbrains-mono';

const END_MARGIN_MM = 1.5;
const EDGE_SHARE = 0.05;
const DETAIL_SHARE = 0.36;
const GAP_SHARE = 0.06;
/**
 * Smallest em sizes that still read on a 180 dpi head: about 9 dots of cap
 * height for the name and 8 for the detail.
 */
const NAME_MIN_EM_MM = 1.9;
const DETAIL_MIN_EM_MM = 1.6;
const EXTRA_LINE_GAIN = 1.1;
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
  /** Height of the block's frame above the label centre. */
  readonly y: number;
}

/** Why a label is left out of the download. */
export type LabelProblem = 'empty' | 'tooLong' | 'unsupportedText';

export interface LabelPlan {
  readonly widthMm: number;
  readonly heightMm: number;
  readonly blocks: readonly PlacedTypeBlock[];
  readonly problem: LabelProblem | null;
}

function planBlock(
  text: string,
  font: TextFontFamily,
  minEm: number,
  host: TypeHostBox,
  measurer: TypeMeasurer
): TypeBlockPlan | null {
  return planTypeBlock(
    {
      text,
      style: {
        ...DEFAULT_TEXT_STYLE_DEFAULTS,
        font,
        margin: 0,
        minFontSize: minEm,
        maxFontSize: host.depth * 2,
        // Clears Atkinson Bold's 0.2em descender by a dot or more at the smallest size.
        lineGap: 0.25,
      },
      host,
      allowWrap: false,
    },
    measurer
  );
}

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
  const lines = (edges: readonly number[]): string =>
    edges
      .slice(1)
      .map((to, k) => words.slice(edges[k], to).join(' '))
      .join('\n');

  const end = words.length;
  let best2: readonly number[] | null = null;
  let best3: readonly number[] | null = null;
  let widest2 = Infinity;
  let widest3 = Infinity;
  for (let i = 1; i < end; i++) {
    const two = Math.max(width(0, i), width(i, end));
    if (two < widest2) {
      best2 = [0, i, end];
      widest2 = two;
    }
    for (let j = i + 1; j < end; j++) {
      const three = Math.max(width(0, i), width(i, j), width(j, end));
      if (three < widest3) {
        best3 = [0, i, j, end];
        widest3 = three;
      }
    }
  }
  const options = [name];
  for (const edges of [best2, best3]) if (edges) options.push(lines(edges));
  return options;
}

function planName(
  text: string,
  host: TypeHostBox,
  fitToText: boolean,
  measurer: TypeMeasurer
): TypeBlockPlan | null {
  let best: TypeBlockPlan | null = null;
  for (const option of fitToText ? [text] : nameLineOptions(text, measurer)) {
    const plan = planBlock(option, LABEL_NAME_FONT, NAME_MIN_EM_MM, host, measurer);
    if (plan && (best === null || plan.fontSize > best.fontSize * EXTRA_LINE_GAIN)) best = plan;
  }
  return best;
}

function placeBlocks(
  name: string,
  detail: string,
  box: LabelBox,
  measurer: TypeMeasurer
): PlacedTypeBlock[] {
  const edge = box.heightMm * EDGE_SHARE;
  const inner = box.heightMm - 2 * edge;
  const fitToText = box.lengthMm === null;
  const width = fitToText ? FIT_MAX_LENGTH_MM : box.lengthMm - 2 * END_MARGIN_MM;

  if (detail !== '') {
    const top = box.heightMm / 2 - edge;
    const gap = inner * GAP_SHARE;
    const detailBand = (inner - gap) * DETAIL_SHARE;
    const nameBand = inner - gap - detailBand;
    const namePlan = planName(name, { width, depth: nameBand }, fitToText, measurer);
    const detailPlan = planBlock(
      detail,
      LABEL_DETAIL_FONT,
      DETAIL_MIN_EM_MM,
      { width, depth: detailBand },
      measurer
    );
    if (namePlan && detailPlan) {
      return [
        { line: 'name', plan: namePlan, y: top - nameBand / 2 },
        { line: 'detail', plan: detailPlan, y: -top + detailBand / 2 },
      ];
    }
    // Only a band too short for the detail face at any width (6mm tape) earns
    // the one-block fallback; a detail that is merely too wide is too long.
    const detailBandTooShort =
      planBlock(
        detail,
        LABEL_DETAIL_FONT,
        DETAIL_MIN_EM_MM,
        { width: FIT_MAX_LENGTH_MM, depth: detailBand },
        measurer
      ) === null;
    if (!detailBandTooShort) return [];
  }

  const singleText = detail === '' ? name : `${name} · ${detail}`;
  const single = planName(singleText, { width, depth: inner }, fitToText, measurer);
  return single ? [{ line: 'name', plan: single, y: 0 }] : [];
}

function labelProblem(
  name: string,
  blocks: readonly PlacedTypeBlock[],
  measurer: TypeMeasurer
): LabelProblem | null {
  if (name === '') return 'empty';
  if (blocks.length === 0) return 'tooLong';
  // Checked per drawn line, in the face that draws it: the one-block fallback
  // sets the detail in the name face.
  const covered = blocks.every(({ plan }) =>
    plan.lines.every((line) => measurer.covers(line.text, plan.font))
  );
  return covered ? null : 'unsupportedText';
}

export function planLabel(text: LabelText, box: LabelBox, measurer: TypeMeasurer): LabelPlan {
  const name = text.name.trim();
  const detail = text.detail.trim();
  const blocks = name === '' ? [] : placeBlocks(name, detail, box, measurer);
  const inkLength = (block: PlacedTypeBlock): number =>
    block.plan.maxX - block.plan.minX + 2 * END_MARGIN_MM;
  return {
    widthMm: box.lengthMm ?? Math.max(box.heightMm, ...blocks.map(inkLength)),
    heightMm: box.heightMm,
    blocks,
    problem: labelProblem(name, blocks, measurer),
  };
}

export interface LabelPath {
  readonly line: LabelLine;
  readonly d: string;
  readonly y: number;
}

/** Glyph outlines for each block, in the block's own frame (+Y up). */
export function labelPaths(plan: LabelPlan, measurer: TypeMeasurer): LabelPath[] {
  return plan.blocks.map((block) => ({
    line: block.line,
    d: planToPathData(block.plan, measurer),
    y: block.y,
  }));
}
