/**
 * Zod Schemas for Designer Command Payload Validation
 */

import * as z from 'zod';

export const designerSaveSchema = z.object({
  designId: z.string().min(1),
  data: z.unknown(),
});
