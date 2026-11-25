import * as z from 'zod';
import { CONSTRAINTS } from '@/core/constants';

export const CHANGE_SET_LIMITS = {
  OPS_MAX: 100,
  ITEMS_MAX: 20,
  REF_MAX_LENGTH: 32,
  SUMMARY_MAX_LENGTH: 200,
} as const;

const ref = z.string().trim().min(1).max(CHANGE_SET_LIMITS.REF_MAX_LENGTH);

/** An entity that exists (`id`), or one that an earlier op in the set adds (`ref`). */
const entityRef = z.union([
  z.object({ id: z.string().min(1).max(64) }).strict(),
  z.object({ ref }).strict(),
]);

const label = z.string().trim().max(CONSTRAINTS.LABEL_MAX_LENGTH);
const items = z
  .array(z.string().trim().min(1).max(CONSTRAINTS.ITEM_NAME_MAX_LENGTH))
  .max(CHANGE_SET_LIMITS.ITEMS_MAX);

// Sizes and positions stay plain numbers here: each op runs the real
// command, whose own schema and placement rules judge them.
const position = { x: z.number(), y: z.number() };
const size = { width: z.number(), depth: z.number(), height: z.number() };

export const changeOpSchema = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('addBin'),
      ref: ref.optional(),
      layer: entityRef,
      ...position,
      ...size,
      label: label.optional(),
      category: entityRef.optional(),
      items: items.optional(),
    })
    .strict(),
  z
    .object({
      op: z.literal('updateBin'),
      bin: entityRef,
      set: z
        .object({ ...size, label, category: entityRef, items })
        .partial()
        .strict()
        .refine((set) => Object.keys(set).length > 0, 'Name at least one field to change.'),
    })
    .strict(),
  z.object({ op: z.literal('moveBin'), bin: entityRef, layer: entityRef, ...position }).strict(),
  z.object({ op: z.literal('stashBin'), bin: entityRef }).strict(),
  z.object({ op: z.literal('deleteBin'), bin: entityRef }).strict(),
  z.object({ op: z.literal('addCategory'), ref, name: label.min(1) }).strict(),
  z.object({ op: z.literal('addLayer'), ref }).strict(),
]);

/**
 * A set of edits to one layout, previewed before it applies. `baseRev` is the
 * `layoutRevision` that the preview saw, so a set made for an older state
 * cannot apply over newer edits.
 */
export const changeSetSchema = z
  .object({
    v: z.literal(1),
    layoutId: z.string().min(1).max(64),
    baseRev: z.string().min(1).max(32),
    summary: z.string().trim().min(1).max(CHANGE_SET_LIMITS.SUMMARY_MAX_LENGTH),
    ops: z.array(changeOpSchema).min(1).max(CHANGE_SET_LIMITS.OPS_MAX),
  })
  .strict();

export type EntityRef = z.infer<typeof entityRef>;
export type ChangeOp = z.infer<typeof changeOpSchema>;
export type ChangeSet = z.infer<typeof changeSetSchema>;
