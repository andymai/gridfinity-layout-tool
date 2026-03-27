/**
 * Zod Schemas for Library Command Payload Validation
 */

import * as z from 'zod';
import { CONSTRAINTS } from '@/core/constants';

const layoutIdSchema = z.string().min(1);
const nameStr = z.string().min(1).max(CONSTRAINTS.NAME_MAX_LENGTH);

export const libraryCreateEntrySchema = z.object({
  name: nameStr,
  layoutId: layoutIdSchema.optional(),
  preview: z.unknown().optional(),
});

export const libraryDeleteEntrySchema = z.object({ layoutId: layoutIdSchema });

export const libraryDuplicateEntrySchema = z.object({ sourceLayoutId: layoutIdSchema });

export const librarySwitchActiveSchema = z.object({ layoutId: layoutIdSchema });

export const libraryUpdateEntrySchema = z.object({
  layoutId: layoutIdSchema,
  updates: z.object({
    name: nameStr.optional(),
    preview: z.unknown().optional(),
    author: z.string().optional(),
  }),
});

export const librarySetAuthorNameSchema = z.object({ name: nameStr });

export const librarySetCloudShareSchema = z.object({
  layoutId: layoutIdSchema,
  shareInfo: z.object({ id: z.string(), url: z.string() }).passthrough(),
});

export const libraryClearCloudShareSchema = z.object({ layoutId: layoutIdSchema });

export const libraryRenameEntrySchema = z.object({
  layoutId: layoutIdSchema,
  name: nameStr,
});

export const libraryImportLayoutSchema = z.object({
  layout: z.unknown(),
  name: nameStr,
});
