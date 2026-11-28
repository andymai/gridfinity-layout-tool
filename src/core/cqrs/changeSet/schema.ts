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

// The descriptions are for the AI model that writes a change set through the
// Ask AI tool propose_changes. Validation does not read them.
const binRef = entityRef.describe(
  '{ id } of a bin in the layout, or { ref } of an earlier addBin.'
);
const layerRef = entityRef.describe(
  '{ id } of a layer in the layout, or { ref } of an earlier addLayer. The stash is { id: "__staging__" }.'
);
const categoryRef = entityRef.describe(
  '{ id } of a category in the layout, or { ref } of an earlier addCategory.'
);
const newRef = ref.describe(
  'A name for what this op adds, so that a later op can use it as { ref }.'
);

const label = z.string().trim().max(CONSTRAINTS.LABEL_MAX_LENGTH);
const items = z
  .array(z.string().trim().min(1).max(CONSTRAINTS.ITEM_NAME_MAX_LENGTH))
  .max(CHANGE_SET_LIMITS.ITEMS_MAX);

// Sizes and positions stay plain numbers here: each op runs the real
// command, whose own schema and placement rules judge them.
const position = {
  x: z.number().describe('Grid units from the left edge of the grid to the left side of the bin.'),
  y: z.number().describe('Grid units from the front edge of the grid to the front of the bin.'),
};
const size = {
  width: z.number().describe('Width in grid units, whole or half.'),
  depth: z.number().describe('Depth in grid units, whole or half.'),
  height: z.number().describe('Height in height units.'),
};

export const changeOpSchema = z.discriminatedUnion('op', [
  z
    .object({
      op: z.literal('addBin'),
      ref: newRef.optional(),
      layer: layerRef,
      ...position,
      ...size,
      label: label.optional(),
      category: categoryRef.optional(),
      items: items.optional().describe('What the bin holds.'),
    })
    .strict(),
  z
    .object({
      op: z.literal('updateBin'),
      bin: binRef,
      set: z
        .object({ ...size, label, category: categoryRef, items })
        .partial()
        .strict()
        .refine((set) => Object.keys(set).length > 0, 'Name at least one field to change.')
        .describe('Only the fields to change.'),
    })
    .strict(),
  z.object({ op: z.literal('moveBin'), bin: binRef, layer: layerRef, ...position }).strict(),
  z.object({ op: z.literal('stashBin'), bin: binRef }).strict(),
  z.object({ op: z.literal('deleteBin'), bin: binRef }).strict(),
  z.object({ op: z.literal('addCategory'), ref: newRef, name: label.min(1) }).strict(),
  z.object({ op: z.literal('addLayer'), ref: newRef }).strict(),
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
