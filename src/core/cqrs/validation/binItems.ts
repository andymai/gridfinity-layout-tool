import * as z from 'zod';
import { CONSTRAINTS } from '@/core/constants';

// The pipeline only checks a payload against this schema and hands the handler
// the original, so nothing here may transform: bounds apply to the raw values,
// and the handlers store items through `sanitizeBinItems`.
const binItemSchema = z.object({
  id: z.string().min(1).max(64),
  name: z
    .string()
    .max(CONSTRAINTS.ITEM_NAME_MAX_LENGTH)
    .refine((name) => name.trim() !== '', { message: 'Item name is blank' }),
  qty: z.number().int().min(0).max(CONSTRAINTS.ITEM_QTY_MAX).optional(),
  note: z.string().max(CONSTRAINTS.ITEM_NOTE_MAX_LENGTH).optional(),
});

/** Shared by `bin.update` and its registry schema, which reject a mismatch silently. */
export const binItemsSchema = z
  .array(binItemSchema)
  .max(CONSTRAINTS.ITEMS_PER_BIN_MAX)
  .refine((items) => new Set(items.map((item) => item.id)).size === items.length, {
    message: 'Item ids must be unique within a bin',
  });
