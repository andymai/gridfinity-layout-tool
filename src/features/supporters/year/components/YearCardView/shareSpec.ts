import type { LayoutPreview } from '@/core/types';
import type { YearMesh } from '../../hooks/useYearMeshes';
import type { YearCard } from '../../utils/yearCards';
import {
  formatArea,
  formatCount,
  formatFootprint,
  formatSize,
  formatWeight,
} from '../../utils/yearFormat';
import { cardCopy, summaryRows, type CopyInput } from './cardCopy';
import { typeName } from './typeCopy';
import { canSpin } from '../SpinningBin/assembly';

export type ShareVisual =
  | { readonly kind: 'big'; readonly text: string; readonly pixel?: boolean }
  | { readonly kind: 'image'; readonly src: string }
  /** A copy of the card's own turning bin, or the thumbnail if no canvas is on screen. */
  | { readonly kind: 'canvas'; readonly thumbnail: string | null }
  /** A drawn bin, for a design with no mesh or thumbnail yet. */
  | { readonly kind: 'glyph' }
  | { readonly kind: 'plan'; readonly preview: LayoutPreview }
  | {
      readonly kind: 'bars';
      readonly counts: readonly number[];
      readonly highlight: number;
      readonly labels: readonly string[];
    }
  | { readonly kind: 'cells'; readonly lit: number; readonly total: number }
  | {
      readonly kind: 'rows';
      readonly rows: readonly [string, string][];
      readonly heading: string;
    };

export interface ShareSpec {
  readonly kicker?: string;
  readonly title: string;
  readonly lines: readonly string[];
  readonly visual: ShareVisual;
}

export interface ShareInput extends CopyInput {
  readonly drawerPreview: LayoutPreview | null;
  readonly meshes: ReadonlyMap<string, YearMesh>;
}

const CELLS = 64;

function binImage(id: string, thumbnail: string | null, meshes: ShareInput['meshes']): ShareVisual {
  const mesh = meshes.get(id);
  if (mesh && canSpin(mesh)) return { kind: 'canvas', thumbnail };
  if (thumbnail) return { kind: 'image', src: thumbnail };
  return { kind: 'glyph' };
}

function visualFor(card: YearCard, input: ShareInput): ShareVisual {
  const { stats, locale, unit, meshes } = input;
  const count = (value: number): ShareVisual => ({ kind: 'big', text: formatCount(locale, value) });
  switch (card.kind) {
    case 'intro':
      return { kind: 'big', text: String(stats.year), pixel: true };
    case 'drawers':
      return count(stats.drawers);
    case 'bins':
      return { kind: 'cells', lit: Math.min(CELLS, stats.binsPlaced), total: CELLS };
    case 'area':
      return { kind: 'big', text: formatArea(locale, stats.drawerAreaMm2, unit) };
    case 'biggest': {
      if (input.drawerPreview) return { kind: 'plan', preview: input.drawerPreview };
      const drawer = stats.biggestDrawer;
      return {
        kind: 'big',
        text: drawer ? formatSize(locale, drawer.widthMm, drawer.depthMm, unit) : '',
      };
    }
    case 'size': {
      const size = stats.favouriteSize;
      return { kind: 'big', text: size ? formatFootprint(locale, size.width, size.depth) : '' };
    }
    case 'designs':
      return count(stats.designs);
    case 'month': {
      const letter = new Intl.DateTimeFormat(locale, { month: 'narrow' });
      return {
        kind: 'bars',
        counts: stats.monthCounts,
        highlight: stats.busiestMonth?.month ?? -1,
        labels: stats.monthCounts.map((_, month) => letter.format(new Date(stats.year, month, 15))),
      };
    }
    case 'filament':
      return {
        kind: 'big',
        text: stats.filament ? formatWeight(locale, stats.filament.grams) : '',
      };
    case 'longest': {
      const longest = stats.longestPrint;
      if (!longest) return { kind: 'big', text: '' };
      return binImage(longest.id, longest.thumbnail, meshes);
    }
    case 'complicated': {
      const pick = input.complicated;
      if (!pick) return { kind: 'big', text: '' };
      return binImage(pick.design.id, pick.design.thumbnail, meshes);
    }
    case 'exports':
      return count(stats.exports);
    case 'type':
      return { kind: 'big', text: typeName(input.t, stats.type.id), pixel: true };
    case 'summary':
      return { kind: 'rows', rows: summaryRows(input), heading: String(stats.year) };
    case 'thanks':
      return count(input.supporterCount);
  }
}

/** What the share image of a card shows: its final words and one visual. */
export function shareSpecFor(card: YearCard, input: ShareInput): ShareSpec | null {
  const copy = cardCopy(card.kind, { ...input, shown: (value) => value });
  if (!copy) return null;
  return {
    kicker: copy.kicker,
    title: card.kind === 'summary' ? '' : copy.title,
    lines: copy.lines,
    visual: visualFor(card, input),
  };
}
