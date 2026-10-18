import { z } from 'zod';
import { SLANT_MAX_DEG, SLANT_SIDES } from '@/core/types/slant';

/** A placed bin's slant, as `bin.add` and `bin.update` accept it. Mirrors `SlantConfig`. */
export const slantSchema = z.object({
  angleDeg: z.number().gt(0).max(SLANT_MAX_DEG),
  side: z.enum(SLANT_SIDES),
  endSupport: z.boolean().optional(),
});
