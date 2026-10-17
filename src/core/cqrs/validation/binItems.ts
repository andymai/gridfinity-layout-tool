import * as z from 'zod';
import { CONSTRAINTS } from '@/core/constants';

const binItemSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(CONSTRAINTS.ITEM_NAME_MAX_LENGTH),
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
