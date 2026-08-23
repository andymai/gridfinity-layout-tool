/**
 * Short dimension caption for a tree row, so three Posts read as three
 * different posts. Numbers are mm and locale-neutral — no i18n needed.
 */
import type { AssemblyPartNode } from '@/shared/types/assembly';
import { partFootprint } from '@/shared/types/assemblyPlacement';

const fmt = (v: number): string => {
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

export function partSummary(node: AssemblyPartNode): string {
  switch (node.type) {
    case 'post':
      return `⌀${fmt(node.params.diameter)}×${fmt(node.params.height)}`;
    case 'fin':
      return `${fmt(node.params.length)}×${fmt(node.params.height)}`;
    case 'block':
      return `${fmt(node.params.width)}×${fmt(node.params.depth)}×${fmt(node.params.height)}`;
    case 'tube':
      return `⌀${fmt(node.params.boreDiameter)}×${fmt(node.params.height)}`;
    case 'cradle':
      return `${fmt(node.params.length)}×${fmt(node.params.width)}`;
    case 'hook':
      return `${fmt(node.params.reach)}×${fmt(node.params.stemHeight)}`;
    case 'arch':
      return `${fmt(node.params.span)}×${fmt(node.params.height)}`;
    case 'comb':
      return `${fmt(node.params.width)}mm ${node.params.slotCount}×${fmt(node.params.slotWidth)}`;
    case 'riser':
      return `${node.params.stepCount}×${fmt(node.params.stepHeight)}mm`;
    case 'cutter': {
      const profile = node.params.profile;
      if (profile.shape === 'circle' || profile.shape === 'polygon') {
        return `⌀${fmt(profile.diameter)}`;
      }
      const { w, d } = partFootprint(node);
      return `${fmt(w)}×${fmt(d)}`;
    }
  }
}
