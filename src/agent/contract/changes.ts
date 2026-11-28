import { z } from 'zod';
import { CHANGE_SET_LIMITS, changeOpSchema } from '@/core/cqrs/changeSet/schema';

/**
 * A browser act: the model proposes edits to the layout open in the app, the
 * panel previews them on that layout, and the reader applies them as one
 * edit that one Undo reverts. The browser adds the layout id and revision, so
 * the model never writes them.
 */
export const PROPOSE_CHANGES = 'propose_changes';

export const proposeChangesInput = z
  .object({
    summary: z
      .string()
      .trim()
      .min(1)
      .max(CHANGE_SET_LIMITS.SUMMARY_MAX_LENGTH)
      .describe(
        'One short sentence that says what the changes do, in the language of the reply. The panel shows it, and it names the Undo step.'
      ),
    ops: z
      .array(changeOpSchema)
      .min(1)
      .max(CHANGE_SET_LIMITS.OPS_MAX)
      .describe('The edits, in order. Each op sees the layout as the ops before it left it.'),
  })
  .strict();
export type ProposeChangesInput = z.infer<typeof proposeChangesInput>;

const id = z.string().min(1).max(64);

/** What the browser sends back for a proposal that the reader saw. */
export const proposeChangesData = z.discriminatedUnion('outcome', [
  z
    .object({
      outcome: z.literal('applied'),
      /** The id of each entity that an op with a `ref` added. */
      added: z.record(z.string().max(CHANGE_SET_LIMITS.REF_MAX_LENGTH), id),
    })
    .strict(),
  z
    .object({
      outcome: z.literal('refused'),
      /** The op that the app refused, counted from 1, or null for the set as a whole. */
      change: z.number().int().min(1).max(CHANGE_SET_LIMITS.OPS_MAX).nullable(),
      reason: z.string().max(400),
    })
    .strict(),
]);
export type ProposeChangesData = z.infer<typeof proposeChangesData>;

export const CHANGES_DECLINED =
  'The reader chose not to apply these changes, so the layout did not change. Do not propose them again in this answer.';
export const CHANGES_UNAVAILABLE =
  'The app could not preview these changes: the reader has no layout of their own open, for example a shared preview. Nothing changed.';

export function formatProposeChanges(data: ProposeChangesData, summary: string): string {
  if (data.outcome === 'refused') {
    const where = data.change === null ? 'the changes' : `change ${data.change}`;
    return `The app refused ${where}: ${JSON.stringify(data.reason)}. Nothing changed, and the reader saw no preview. Fix the changes and call propose_changes again, or tell the reader what stops them.`;
  }
  const added = Object.entries(data.added);
  const ids =
    added.length > 0
      ? ` New ids: ${added.map(([ref, value]) => `${ref} = ${JSON.stringify(value)}`).join(', ')}.`
      : '';
  return `The reader applied the changes (${JSON.stringify(summary)}). One Undo in the app reverts all of them.${ids}`;
}
