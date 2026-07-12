/**
 * Zod schema for `DrawerOutline` payloads. Structural bounds only — the
 * geometric invariants (closed CCW simple loop, min area, within the drawer
 * extent) are checked by `validateOutline` in the command handler, which
 * knows the drawer dims. Coordinate bounds cover the largest drawer (50 units
 * × up to 52mm grid) with slack.
 */

import * as z from 'zod';
import { OUTLINE_MAX_VERTICES } from '@/shared/utils/drawerOutline';

const OUTLINE_COORD_MIN = -1;
const OUTLINE_COORD_MAX = 2600;

const outlineVertexSchema = z.object({
  x: z.number().finite().gte(OUTLINE_COORD_MIN).lte(OUTLINE_COORD_MAX),
  y: z.number().finite().gte(OUTLINE_COORD_MIN).lte(OUTLINE_COORD_MAX),
  bulge: z.number().finite().gte(-1).lte(1).optional(),
});

const cornerCutSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({ kind: z.literal('chamfer'), size: z.number().finite().gt(0).lte(500) }),
  z.object({ kind: z.literal('radius'), r: z.number().finite().gt(0).lte(500) }),
  z.object({
    kind: z.literal('notch'),
    w: z.number().finite().gt(0).lte(2600),
    d: z.number().finite().gt(0).lte(2600),
  }),
]);

export const drawerOutlineSchema = z.object({
  vertices: z.array(outlineVertexSchema).min(3).max(OUTLINE_MAX_VERTICES),
  authoring: z
    .object({
      kind: z.enum(['cells', 'corners', 'trace', 'pen']),
      corners: z
        .object({
          tl: cornerCutSchema,
          tr: cornerCutSchema,
          bl: cornerCutSchema,
          br: cornerCutSchema,
        })
        .optional(),
    })
    .optional(),
});
