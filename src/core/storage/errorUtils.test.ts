import { describe, it, expect } from 'vitest';
import {
  classifyStorageError,
  createStorageErrorClassifier,
  extractErrorMessage,
  isStorageQuotaError,
} from './errorUtils';

describe('errorUtils', () => {
  describe('extractErrorMessage', () => {
    it('extracts message from Error instance', () => {
      const error = new Error('Something went wrong');
      expect(extractErrorMessage(error)).toBe('Something went wrong');
    });

    it('converts non-Error to string', () => {
      expect(extractErrorMessage('string error')).toBe('string error');
      expect(extractErrorMessage(123)).toBe('123');
      expect(extractErrorMessage(null)).toBe('null');
      expect(extractErrorMessage(undefined)).toBe('undefined');
    });
  });

  describe('classifyStorageError', () => {
    it('classifies quota exceeded errors', () => {
      const quotaError = new Error('QuotaExceededError: Storage limit reached');
      const result = classifyStorageError(quotaError, 'indexedDB');

      expect(result.code).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(result.cause).toBe(quotaError);
    });

    it('classifies quota errors with lowercase', () => {
      const quotaError = new Error('Storage quota has been exceeded');
      const result = classifyStorageError(quotaError, 'localStorage');

      expect(result.code).toBe('STORAGE_QUOTA_EXCEEDED');
    });

    it('classifies storage full errors', () => {
      const fullError = new Error('Storage full');
      const result = classifyStorageError(fullError, 'localStorage');

      expect(result.code).toBe('STORAGE_QUOTA_EXCEEDED');
    });

    it("classifies Chrome's disk-full FILE_ERROR_NO_SPACE as quota exceeded", () => {
      // Chrome's leveldb-backed disk-full error surfaces as an UnknownError, not
      // a QuotaExceededError — it must still classify as a quota condition.
      const diskFull = new Error(
        'UnknownError: Internal error. (ChromeMethodBFE: 4#WritableFileAppend ::FILE_ERROR_NO_SPACE)'
      );
      const result = classifyStorageError(diskFull, 'indexedDB');

      expect(result.code).toBe('STORAGE_QUOTA_EXCEEDED');
    });

    it("classifies leveldb 'IO error' as quota exceeded", () => {
      const ioError = new Error(
        'UnknownError: Internal error. ... IO error: No space left on device'
      );
      const result = classifyStorageError(ioError, 'indexedDB');

      expect(result.code).toBe('STORAGE_QUOTA_EXCEEDED');
    });

    it('classifies unavailable/security errors', () => {
      const securityError = new Error('SecurityError: Access denied');
      const result = classifyStorageError(securityError, 'indexedDB');

      expect(result.code).toBe('STORAGE_UNAVAILABLE');
    });

    it('classifies blocked access errors', () => {
      const blockedError = new Error('Storage access blocked');
      const result = classifyStorageError(blockedError, 'localStorage');

      expect(result.code).toBe('STORAGE_UNAVAILABLE');
    });

    it('defaults to unavailable for unknown errors', () => {
      const unknownError = new Error('Something unexpected happened');
      const result = classifyStorageError(unknownError, 'indexedDB');

      expect(result.code).toBe('STORAGE_UNAVAILABLE');
      expect(result.cause).toBe(unknownError);
    });

    it('handles non-Error values', () => {
      const result = classifyStorageError('string error', 'indexedDB');
      expect(result.code).toBe('STORAGE_UNAVAILABLE');
    });

    it('uses provided storage type in error', () => {
      const error = new Error('Failed');
      const result = classifyStorageError(error, 'localStorage');

      // Storage type is stored in backend property, not message
      expect(result.code).toBe('STORAGE_UNAVAILABLE');
      expect((result as { backend: string }).backend).toBe('localStorage');
    });
  });

  describe('isStorageQuotaError', () => {
    it('is true for quota / disk-full conditions', () => {
      expect(isStorageQuotaError(new Error('QuotaExceededError'))).toBe(true);
      expect(isStorageQuotaError(new Error('NS_ERROR_DOM_QUOTA_REACHED'))).toBe(true);
      expect(isStorageQuotaError(new Error('...FILE_ERROR_NO_SPACE)'))).toBe(true);
      expect(isStorageQuotaError(new Error('IO error: No space left on device'))).toBe(true);
    });

    it('is false for unrelated / transient errors', () => {
      expect(isStorageQuotaError(new Error('Something unexpected happened'))).toBe(false);
      expect(
        isStorageQuotaError(
          new Error('Attempt to get a record from database without an in-progress transaction')
        )
      ).toBe(false);
      expect(isStorageQuotaError('not an error')).toBe(false);
    });
  });

  describe('createStorageErrorClassifier', () => {
    it('creates a classifier function', () => {
      const classifier = createStorageErrorClassifier('indexedDB');
      expect(typeof classifier).toBe('function');
    });

    it('returned function classifies errors correctly', () => {
      const classifier = createStorageErrorClassifier('indexedDB');
      const quotaError = new Error('QuotaExceeded');

      const result = classifier(quotaError);
      expect(result.code).toBe('STORAGE_QUOTA_EXCEEDED');
    });

    it('uses provided storage type', () => {
      const classifier = createStorageErrorClassifier('localStorage');
      const error = new Error('Failed');

      const result = classifier(error);
      expect(result.code).toBe('STORAGE_UNAVAILABLE');
      expect((result as { backend: string }).backend).toBe('localStorage');
    });

    it('defaults to indexedDB when no type provided', () => {
      const classifier = createStorageErrorClassifier();
      const error = new Error('Failed');

      const result = classifier(error);
      expect(result.code).toBe('STORAGE_UNAVAILABLE');
      expect((result as { backend: string }).backend).toBe('indexedDB');
    });
  });
});
