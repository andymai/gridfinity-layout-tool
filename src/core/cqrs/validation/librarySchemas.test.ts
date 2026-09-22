import { describe, it, expect } from 'vitest';
import { CONSTRAINTS } from '@/core/constants';
import {
  libraryCreateEntrySchema,
  libraryDeleteEntrySchema,
  libraryDuplicateEntrySchema,
  librarySwitchActiveSchema,
  libraryUpdateEntrySchema,
  librarySetAuthorNameSchema,
  librarySetCloudShareSchema,
  libraryClearCloudShareSchema,
  libraryRenameEntrySchema,
  libraryImportLayoutSchema,
} from './librarySchemas';

describe('library validation schemas', () => {
  describe('libraryCreateEntrySchema', () => {
    it('accepts valid name', () => {
      const result = libraryCreateEntrySchema.safeParse({ name: 'My Layout' });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = libraryCreateEntrySchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('rejects name exceeding max length', () => {
      const result = libraryCreateEntrySchema.safeParse({
        name: 'x'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 1),
      });
      expect(result.success).toBe(false);
    });

    it('accepts optional layoutId and preview', () => {
      const result = libraryCreateEntrySchema.safeParse({
        name: 'Test',
        layoutId: 'abc-123',
        preview: { some: 'data' },
      });
      expect(result.success).toBe(true);
    });
  });

  describe('libraryDeleteEntrySchema', () => {
    it('accepts valid layoutId', () => {
      expect(libraryDeleteEntrySchema.safeParse({ layoutId: 'abc' }).success).toBe(true);
    });

    it('rejects empty layoutId', () => {
      expect(libraryDeleteEntrySchema.safeParse({ layoutId: '' }).success).toBe(false);
    });

    it('rejects missing layoutId', () => {
      expect(libraryDeleteEntrySchema.safeParse({}).success).toBe(false);
    });
  });

  describe('libraryDuplicateEntrySchema', () => {
    it('accepts valid sourceLayoutId', () => {
      expect(libraryDuplicateEntrySchema.safeParse({ sourceLayoutId: 'abc' }).success).toBe(true);
    });

    it('rejects empty sourceLayoutId', () => {
      expect(libraryDuplicateEntrySchema.safeParse({ sourceLayoutId: '' }).success).toBe(false);
    });
  });

  describe('librarySwitchActiveSchema', () => {
    it('accepts valid layoutId', () => {
      expect(librarySwitchActiveSchema.safeParse({ layoutId: 'xyz' }).success).toBe(true);
    });
  });

  describe('libraryUpdateEntrySchema', () => {
    it('accepts layoutId with name update', () => {
      const result = libraryUpdateEntrySchema.safeParse({
        layoutId: 'abc',
        updates: { name: 'New Name' },
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty updates object', () => {
      const result = libraryUpdateEntrySchema.safeParse({
        layoutId: 'abc',
        updates: {},
      });
      expect(result.success).toBe(true);
    });

    it('rejects name exceeding max length in updates', () => {
      const result = libraryUpdateEntrySchema.safeParse({
        layoutId: 'abc',
        updates: { name: 'x'.repeat(CONSTRAINTS.NAME_MAX_LENGTH + 1) },
      });
      expect(result.success).toBe(false);
    });
  });

  describe('librarySetAuthorNameSchema', () => {
    it('accepts valid name', () => {
      expect(librarySetAuthorNameSchema.safeParse({ name: 'Author' }).success).toBe(true);
    });

    it('rejects empty name', () => {
      expect(librarySetAuthorNameSchema.safeParse({ name: '' }).success).toBe(false);
    });
  });

  describe('librarySetCloudShareSchema', () => {
    const shareInfo = {
      id: 'share-1',
      deleteToken: 'token-1',
      sharedAt: 1_700_000_000_000,
      permission: 'edit',
    };

    it('accepts the CloudShareInfo that useCloudShare dispatches', () => {
      const result = librarySetCloudShareSchema.safeParse({ layoutId: 'abc', shareInfo });
      expect(result.success).toBe(true);
    });

    it('accepts an updated share carrying lastUpdatedAt', () => {
      const result = librarySetCloudShareSchema.safeParse({
        layoutId: 'abc',
        shareInfo: { ...shareInfo, lastUpdatedAt: 1_700_000_000_001 },
      });
      expect(result.success).toBe(true);
    });

    it('rejects share info without a delete token', () => {
      const { deleteToken: _deleteToken, ...withoutToken } = shareInfo;
      const result = librarySetCloudShareSchema.safeParse({
        layoutId: 'abc',
        shareInfo: withoutToken,
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing share id', () => {
      const { id: _id, ...withoutId } = shareInfo;
      const result = librarySetCloudShareSchema.safeParse({
        layoutId: 'abc',
        shareInfo: withoutId,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('libraryClearCloudShareSchema', () => {
    it('accepts valid layoutId', () => {
      expect(libraryClearCloudShareSchema.safeParse({ layoutId: 'abc' }).success).toBe(true);
    });
  });

  describe('libraryRenameEntrySchema', () => {
    it('accepts valid rename', () => {
      expect(libraryRenameEntrySchema.safeParse({ layoutId: 'abc', name: 'New' }).success).toBe(
        true
      );
    });

    it('rejects empty name', () => {
      expect(libraryRenameEntrySchema.safeParse({ layoutId: 'abc', name: '' }).success).toBe(false);
    });
  });

  describe('libraryImportLayoutSchema', () => {
    it('accepts valid import data', () => {
      const result = libraryImportLayoutSchema.safeParse({
        layout: { some: 'layout data' },
        name: 'Imported',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = libraryImportLayoutSchema.safeParse({
        layout: {},
        name: '',
      });
      expect(result.success).toBe(false);
    });
  });
});
