import { z } from 'zod';

export const drawerFitInput = z
  .object({
    widthMm: z.number(),
    depthMm: z.number(),
    heightMm: z.number().optional(),
    unit: z.enum(['mm', 'in']).optional(),
  })
  .strict();

export type DrawerFitInput = z.infer<typeof drawerFitInput>;
