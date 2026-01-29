import { describe, it, expect } from 'vitest';
import {
  classifyStorageError,
  createStorageErrorClassifier,
  extractErrorMessage,
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
