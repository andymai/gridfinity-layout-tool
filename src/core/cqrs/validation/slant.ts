import { z } from 'zod';
import { SLANT_MAX_DEG, SLANT_SIDES } from '@/core/types/slant';

export const slantSchema = z.object({
  angleDeg: z.number().gt(0).max(SLANT_MAX_DEG),
  side: z.enum(SLANT_SIDES),
  endSupport: z.boolean().optional(),
});
