/**
 * Zod Schemas for Restore Command Payload Validation
 *
 * Note: The restore middleware profile has validation=false, so this schema
 * is not actively enforced. It exists for documentation and optional use.
 */

import * as z from 'zod';

export const layoutRestoreSchema = z.object({
  layout: z.unknown(),
  direction: z.enum(['undo', 'redo']),
});
