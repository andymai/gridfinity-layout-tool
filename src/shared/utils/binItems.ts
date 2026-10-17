import { CONSTRAINTS, generateId } from '@/core/constants';
import type { Bin, BinItem } from '@/core/types';

const ITEM_ID_MAX_LENGTH = 64;

function sanitizeItem(value: unknown): BinItem | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== 'string' || raw.id === '' || raw.id.length > ITEM_ID_MAX_LENGTH) {
    return null;
  }
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  if (name === '') return null;
  const qty =
    typeof raw.qty === 'number' &&
    Number.isInteger(raw.qty) &&
    raw.qty >= 0 &&
    raw.qty <= CONSTRAINTS.ITEM_QTY_MAX
      ? raw.qty
      : undefined;
  const note = typeof raw.note === 'string' ? raw.note.trim() : '';
  return {
    id: raw.id,
    name: name.slice(0, CONSTRAINTS.ITEM_NAME_MAX_LENGTH),
    ...(qty === undefined ? {} : { qty }),
    ...(note === '' ? {} : { note: note.slice(0, CONSTRAINTS.ITEM_NOTE_MAX_LENGTH) }),
  };
}

/**
 * The well-formed items of a stored bin, capped and trimmed, each malformed one
 * dropped alone so a damaged entry never costs the rest. Absent when none
 * survive, matching a bin that never had any.
 */
export function sanitizeBinItems(value: unknown): BinItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const items: BinItem[] = [];
  for (const raw of value) {
    if (items.length >= CONSTRAINTS.ITEMS_PER_BIN_MAX) break;
    const item = sanitizeItem(raw);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items.length > 0 ? items : undefined;
}

/** A bin with its items sanitized; a bin that carries no `items` key passes through untouched. */
export function withSanitizedItems(bin: unknown): unknown {
  if (typeof bin !== 'object' || bin === null || !('items' in bin)) return bin;
  const { items, ...rest } = bin as Record<string, unknown>;
  const clean = sanitizeBinItems(items);
  return clean ? { ...rest, items: clean } : rest;
}

/**
 * What a bin merged from `bins` holds: everything they held, in order, or null
 * when that is more than one bin can hold, so a caller never trims saved items.
 * Ids are unique only within a bin, so a clash gets a fresh one.
 */
export function mergeBinItems(bins: readonly Pick<Bin, 'items'>[]): BinItem[] | undefined | null {
  const all = bins.flatMap((bin) => bin.items ?? []);
  if (all.length > CONSTRAINTS.ITEMS_PER_BIN_MAX) return null;
  const seen = new Set<string>();
  const merged: BinItem[] = [];
  for (const item of all) {
    const id = seen.has(item.id) ? generateId() : item.id;
    seen.add(id);
    merged.push({ ...item, id });
  }
  return merged.length > 0 ? merged : undefined;
}
