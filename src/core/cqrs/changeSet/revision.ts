import type { Layout } from '@/core/types';

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fnv1a(text: string, seed: number): string {
  let hash = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * A fingerprint of the parts of a layout that change sets edit. Keys are
 * sorted first, because an Immer edit can reorder an object's keys without
 * changing what it holds.
 */
export function layoutRevision(layout: Layout): string {
  const text = canonical({
    drawer: layout.drawer,
    layers: layout.layers,
    categories: layout.categories,
    bins: layout.bins,
  });
  return fnv1a(text, 0x811c9dc5) + fnv1a(text, 0x01000193);
}
