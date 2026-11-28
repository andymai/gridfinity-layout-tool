import { proposeChangesInput } from '@/agent/contract';
import type { ProposeChangesInput } from '@/agent/contract';
import { prepareChanges } from '@/agent/reader/changes';
import type { OpenLayout } from '@/agent/reader/changes';
import { STAGING_ID } from '@/core/constants';
import type { Bin, Layout } from '@/core/types';
import type { TFunction } from '@/i18n';

export interface PreviewBin {
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly depth: number;
  readonly layer: number;
  readonly color: string;
  /** Added or changed by the set. */
  readonly changed: boolean;
}

export type ChangePreview =
  | {
      readonly kind: 'preview';
      readonly lines: readonly string[];
      readonly grid: { readonly width: number; readonly depth: number };
      readonly bins: readonly PreviewBin[];
      readonly stashed: number;
    }
  | { readonly kind: 'refused'; readonly lines: readonly string[]; readonly reason: string }
  | { readonly kind: 'unavailable'; readonly lines: readonly string[] };

const n = (value: number): string => String(value);

/** Each op in the reader's words, with bins named by their labels. */
export function describeOps(input: ProposeChangesInput, layout: Layout, t: TFunction): string[] {
  const labels = new Map<string, string>();
  const name = (target: { id: string } | { ref: string }): string => {
    const label =
      'id' in target
        ? layout.bins.find((bin) => bin.id === target.id)?.label
        : labels.get(target.ref);
    return label && label.trim() !== '' ? label : t('askAi.change.aBin');
  };
  return input.ops.map((op) => {
    switch (op.op) {
      case 'addBin': {
        if (op.ref && op.label) labels.set(op.ref, op.label);
        const [width, depth, x, y] = [n(op.width), n(op.depth), n(op.x), n(op.y)];
        return op.label
          ? t('askAi.change.addBin', { width, depth, x, y, label: op.label })
          : t('askAi.change.addBinUnlabeled', { width, depth, x, y });
      }
      case 'updateBin':
        return t('askAi.change.updateBin', { label: name(op.bin) });
      case 'moveBin':
        return 'id' in op.layer && op.layer.id === STAGING_ID
          ? t('askAi.change.stashBin', { label: name(op.bin) })
          : t('askAi.change.moveBin', { label: name(op.bin), x: n(op.x), y: n(op.y) });
      case 'stashBin':
        return t('askAi.change.stashBin', { label: name(op.bin) });
      case 'deleteBin':
        return t('askAi.change.deleteBin', { label: name(op.bin) });
      case 'addCategory':
        return t('askAi.change.addCategory', { name: op.name });
      case 'addLayer':
        return t('askAi.change.addLayer');
      default: {
        const _exhaustive: never = op;
        return String(_exhaustive);
      }
    }
  });
}

const placeOf = (bin: Bin): string =>
  [bin.layerId, bin.x, bin.y, bin.width, bin.depth, bin.height, bin.label, bin.category].join('|');

/**
 * The set run on the layout as it is now, for the card: what each op does,
 * and the drawer after it, with the bins it adds or changes marked.
 */
export function previewChanges(
  open: OpenLayout | null,
  input: unknown,
  t: TFunction
): ChangePreview {
  const parsed = proposeChangesInput.safeParse(input);
  const lines = parsed.success && open ? describeOps(parsed.data, open.layout, t) : [];
  const prepared = prepareChanges(open, input);
  if (prepared.kind === 'unavailable') return { kind: 'unavailable', lines };
  if (prepared.kind === 'refused') {
    const reason = prepared.data.outcome === 'refused' ? prepared.data.reason : '';
    return { kind: 'refused', lines, reason };
  }
  const before = new Map((open?.layout.bins ?? []).map((bin) => [bin.id, placeOf(bin)]));
  const after = prepared.result.layout;
  const layerOf = new Map(after.layers.map((layer, i) => [layer.id, i + 1]));
  const colorOf = new Map(after.categories.map((category) => [category.id, category.color]));
  return {
    kind: 'preview',
    lines,
    grid: { width: after.drawer.width, depth: after.drawer.depth },
    bins: after.bins
      .filter((bin) => bin.layerId !== STAGING_ID)
      .map((bin) => ({
        label: bin.label,
        x: bin.x,
        y: bin.y,
        width: bin.width,
        depth: bin.depth,
        layer: layerOf.get(bin.layerId) ?? 1,
        color: colorOf.get(bin.category) ?? '#94a3b8',
        changed: before.get(bin.id) !== placeOf(bin),
      })),
    stashed: after.bins.filter((bin) => bin.layerId === STAGING_ID).length,
  };
}
