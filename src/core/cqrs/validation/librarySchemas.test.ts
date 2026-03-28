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
    it('accepts valid share info', () => {
      const result = librarySetCloudShareSchema.safeParse({
        layoutId: 'abc',
        shareInfo: { id: 'share-1', url: 'https://example.com/s/abc' },
      });
      expect(result.success).toBe(true);
    });

    it('rejects missing share id', () => {
      const result = librarySetCloudShareSchema.safeParse({
        layoutId: 'abc',
        shareInfo: { url: 'https://example.com' },
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
