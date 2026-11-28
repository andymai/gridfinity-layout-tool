import type { LayoutPreview } from '@/core/types';
import type { TFunction } from '@/i18n';
import type { LengthUnit } from '@/shared/utils/lengthUnit';
import type { CardColours } from '../look/palettes';
import { roleFont, setText, type FontSpec, type Measure, type TextRole } from '../look/typeset';
import type { YearStats } from '../types';
import type { ComplicatedPick } from '../utils/complicatedPick';
import type { YearCard, YearCardKind } from '../utils/yearCards';

/** The card is laid out at 1080 × 1920 and scaled to the screen. */
export const CARD_W = 1080;
export const CARD_H = 1920;
export const MARGIN = 60;
export const CONTENT_W = 960;
/** The top 140 px stay clear for the player's controls; content starts here on every card. */
export const CONTENT_TOP = 196;
/** Between a visual and its text. */
export const GAP_V = 64;
/** Kicker to title. */
export const GAP_K = 12;
/** Title to line. */
export const GAP_T = 28;
export const FOOTER_Y = 1812;
/** Text below this would meet the footer. */
export const TEXT_FLOOR = 1772;
export const SITE_HOST = 'gridfinitylayouttool.com';

export interface TextBlock {
  readonly key: string;
  readonly lines: readonly string[];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly font: FontSpec;
  readonly color: string;
  /** Seconds into the card when it rises in; below zero, it is there from the start. */
  readonly enter: number;
  readonly reduceEnter: number;
  readonly rise: number;
  /** Sets each × smaller and raised, as a multiplication sign. */
  readonly times?: boolean;
}

export function blockHeight(block: TextBlock): number {
  return block.lines.length * block.font.lineHeight;
}

export function blockBottom(block: TextBlock): number {
  return block.y + blockHeight(block);
}

export interface DrawState {
  readonly ctx: CanvasRenderingContext2D;
  /** Seconds into the card. */
  readonly t: number;
  readonly reduced: boolean;
  /** Device pixels per card px, for layers drawn once and reused. */
  readonly resolution: number;
}

export interface ModelLook {
  readonly tint: string;
  readonly edge: string;
  readonly edgeOpacity: number;
  readonly sky: string;
  readonly ground: string;
  readonly rim: string;
  readonly fov: number;
  /** Degrees above the horizon. */
  readonly elevation: number;
  /** Bounding sphere to frame, below 1 to fill more of it. */
  readonly fit: number;
}

/** Where a card's real 3D bin stands, and how it arrives. */
export interface ModelSlot {
  readonly kind: 'print' | 'drop';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Transform origin of the drop, as CSS. */
  readonly origin: string;
  readonly look: ModelLook;
  /** The card's length in seconds, where the turn comes to its resting angle. */
  readonly end: number;
}

export interface Scene {
  readonly kind: YearCardKind;
  readonly colours: CardColours;
  readonly texts: readonly TextBlock[];
  readonly draw: (state: DrawState) => void;
  /** After this many seconds the drawing no longer changes. */
  readonly still: number;
  readonly model?: ModelSlot;
  /** The thank-you card's two buttons, top edge of the first. */
  readonly keys?: { readonly y: number; readonly enter: readonly [number, number] };
}

export interface SceneInput {
  readonly card: YearCard;
  readonly t: TFunction;
  readonly locale: string;
  readonly unit: LengthUnit;
  readonly stats: YearStats;
  readonly supporterCount: number;
  readonly complicated: ComplicatedPick | null;
  readonly drawerPreview: LayoutPreview | null;
  readonly measure: Measure;
}

interface BlockOptions {
  readonly key: string;
  readonly role: TextRole;
  readonly text: string;
  readonly y: number;
  readonly color: string;
  readonly enter: number;
  readonly reduceEnter?: number;
  readonly rise?: number;
  readonly maxLines?: number;
  readonly width?: number;
  readonly font?: FontSpec;
  readonly times?: boolean;
}

/** One paragraph, wrapped and balanced at the card's measure. */
export function textBlock(input: SceneInput, options: BlockOptions): TextBlock {
  const width = options.width ?? (options.role === 'small' ? 900 : CONTENT_W);
  const { lines, font } = setText(
    options.text,
    width,
    options.font ?? roleFont(options.role, input.locale),
    input.measure,
    input.locale,
    options.maxLines ?? 3
  );
  return {
    key: options.key,
    lines,
    x: MARGIN,
    y: options.y,
    width,
    font,
    color: options.color,
    enter: options.enter,
    reduceEnter: options.reduceEnter ?? options.enter,
    rise: options.rise ?? 36,
    times: options.times,
  };
}

/** Several sentences in one block, each starting a new line, all at one size. */
export function paragraphsBlock(
  input: SceneInput,
  options: BlockOptions & { readonly paragraphs: readonly string[] }
): TextBlock {
  const width = options.width ?? CONTENT_W;
  const set = (font: FontSpec) =>
    options.paragraphs.map((paragraph) =>
      setText(paragraph, width, font, input.measure, input.locale, 2)
    );
  const first = set(options.font ?? roleFont(options.role, input.locale));
  const font = first.reduce(
    (smallest, each) => (each.font.size < smallest.size ? each.font : smallest),
    first[0]?.font ?? roleFont(options.role, input.locale)
  );
  const lines = set(font).flatMap((each) => each.lines);
  return { ...textBlock(input, { ...options, text: '' }), lines, font, width };
}

/** The scale a visual band takes so the text under it still clears the footer. */
export function bandScale(top: number, height: number, below: number): number {
  const room = TEXT_FLOOR - top - below;
  return Math.max(0.55, Math.min(1, room / height));
}

/** Draws a band of the card scaled about its top centre. */
export function scaledBand(
  top: number,
  scale: number,
  paint: (state: DrawState) => void
): (state: DrawState) => void {
  if (scale >= 0.999) return paint;
  return (state) => {
    const { ctx } = state;
    ctx.save();
    ctx.translate(CARD_W / 2, top);
    ctx.scale(scale, scale);
    ctx.translate(-CARD_W / 2, -top);
    paint(state);
    ctx.restore();
  };
}

/** The total height of stacked blocks, with `gap` between each. */
export function stackHeight(blocks: readonly TextBlock[], gap = 0): number {
  return (
    blocks.reduce((sum, block) => sum + blockHeight(block), 0) +
    Math.max(0, blocks.length - 1) * gap
  );
}

/** The site's address, in the same place on every card. */
export function footer(input: SceneInput, ink: string): TextBlock {
  return {
    key: 'footer',
    lines: [SITE_HOST],
    x: MARGIN,
    y: FOOTER_Y,
    width: CONTENT_W,
    font: roleFont('label', input.locale),
    color: ink,
    enter: -1,
    reduceEnter: -1,
    rise: 0,
  };
}
