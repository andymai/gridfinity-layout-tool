import { z } from 'zod';

export const drawerFitInput = z
  .object({
    widthMm: z.number().describe('Inside width, in the unit below.'),
    depthMm: z.number().describe('Inside depth, in the unit below.'),
    heightMm: z.number().optional().describe('Inside height, if known.'),
    unit: z.enum(['mm', 'in']).optional().describe('Default mm.'),
  })
  .strict();

export type DrawerFitInput = z.infer<typeof drawerFitInput>;
