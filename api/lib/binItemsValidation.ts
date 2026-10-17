/**
 * What a layout bin holds. Each malformed item is dropped alone and the rest
 * are capped and trimmed, so one bad entry never costs the bin or the layout.
 */
import { sanitizeString } from './sanitize.js';
import { SHARE_CONSTRAINTS } from './shareConstraints.js';
import { isObject } from './validationUtils.js';

export interface BinItemShape {
  id: string;
  name: string;
  qty?: number;
  note?: string;
}

function sanitizeItem(value: unknown): BinItemShape | null {
  if (!isObject(value)) return null;
  if (
    typeof value.id !== 'string' ||
    value.id === '' ||
    value.id.length > SHARE_CONSTRAINTS.ITEM_ID_MAX_LENGTH
  ) {
    return null;
  }
  const name =
    typeof value.name === 'string'
      ? sanitizeString(value.name, SHARE_CONSTRAINTS.ITEM_NAME_MAX_LENGTH)
      : '';
  if (name === '') return null;
  const qty =
    typeof value.qty === 'number' &&
    Number.isInteger(value.qty) &&
    value.qty >= 0 &&
    value.qty <= SHARE_CONSTRAINTS.ITEM_QTY_MAX
      ? value.qty
      : undefined;
  const note =
    typeof value.note === 'string'
      ? sanitizeString(value.note, SHARE_CONSTRAINTS.ITEM_NOTE_MAX_LENGTH)
      : '';
  return {
    id: value.id,
    name,
    ...(qty === undefined ? {} : { qty }),
    ...(note === '' ? {} : { note }),
  };
}

export function sanitizeBinItems(value: unknown): BinItemShape[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const items: BinItemShape[] = [];
  for (const raw of value) {
    if (items.length >= SHARE_CONSTRAINTS.ITEMS_PER_BIN_MAX) break;
    const item = sanitizeItem(raw);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items.length > 0 ? items : undefined;
}
