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
 * A fingerprint of everything in a layout but its name: grid pitch, height
 * units and baseplate settings feed placement too. Keys are sorted first,
 * because an Immer edit can reorder an object's keys without changing what
 * it holds.
 */
export function layoutRevision(layout: Layout): string {
  const { name: _name, ...content } = layout;
  const text = canonical(content);
  return fnv1a(text, 0x811c9dc5) + fnv1a(text, 0x01000193);
}
