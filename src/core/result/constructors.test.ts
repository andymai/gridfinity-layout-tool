import { describe, it, expect } from 'vitest';
import {
  storageQuotaExceeded,
  storageNotFound,
  storageCorrupted,
  storageUnavailable,
  storageNetworkError,
  validationOutOfBounds,
  validationCollision,
  validationInvalidLayer,
  validationHeightExceeded,
  validationBlockedZone,
  validationImportFailed,
  layoutLayerLimit,
  layoutCategoryLimit,
  layoutLibraryLimit,
  layoutLastEntity,
  layoutInvalidOperation,
  apiRateLimited,
  apiUnauthorized,
  apiNotFound,
  apiServerError,
  apiNetworkError,
  apiTimeout,
  apiValidationError,
  apiContentBlocked,
  apiSizeLimit,
  apiBinLimit,
  apiExpired,
  apiInvalidExpiration,
  unknownError,
  fromUnknown,
} from './constructors';
import { getUserMessage, getRecoveryHint, isRetryable, getSeverity } from './catalog';

describe('error constructors', () => {
  describe('common structure', () => {
    it('all constructors produce kind, code, message, and timestamp', () => {
      const errors = [
        storageQuotaExceeded(),
        storageNotFound('key'),
        storageCorrupted('key'),
        storageUnavailable('localStorage'),
        storageNetworkError(),
        validationOutOfBounds('out_of_bounds'),
        validationCollision(),
        validationInvalidLayer('layer-1'),
        validationHeightExceeded(10, 5),
        validationBlockedZone(),
        validationImportFailed(['error']),
        layoutLayerLimit(10, 10),
        layoutCategoryLimit(20, 20),
        layoutLibraryLimit(100, 100),
        layoutLastEntity('layer'),
        layoutInvalidOperation('op'),
        apiRateLimited(),
        apiUnauthorized(),
        apiNotFound(),
        apiServerError(),
        apiNetworkError(),
        apiTimeout(),
        apiValidationError(),
        apiContentBlocked(),
        apiSizeLimit(),
        apiBinLimit(),
        apiExpired(),
        apiInvalidExpiration(),
        unknownError(),
      ];

      for (const error of errors) {
        expect(error.kind).toBeTruthy();
        expect(error.code).toBeTruthy();
        expect(error.message).toBeTruthy();
        expect(error.timestamp).toBeGreaterThan(0);
      }
    });
  });

  describe('storage errors', () => {
    it('storageQuotaExceeded includes usage metadata', () => {
      const error = storageQuotaExceeded(5000, 10000);
      expect(error.kind).toBe('StorageError');
      expect(error.code).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(error.usageBytes).toBe(5000);
      expect(error.limitBytes).toBe(10000);
    });

    it('storageNotFound includes key', () => {
      const error = storageNotFound('gridfinity-layout-abc');
      expect(error.key).toBe('gridfinity-layout-abc');
    });

    it('storageCorrupted includes validation errors', () => {
      const error = storageCorrupted('key', ['missing field: bins']);
      expect(error.validationErrors).toEqual(['missing field: bins']);
    });
  });

  describe('validation errors', () => {
    it('validationHeightExceeded includes requested and max', () => {
      const error = validationHeightExceeded(15, 12);
      expect(error.requested).toBe(15);
      expect(error.max).toBe(12);
    });

    it('validationCollision includes colliding bin IDs', () => {
      const error = validationCollision(['bin-1', 'bin-2']);
      expect(error.collidingBinIds).toEqual(['bin-1', 'bin-2']);
    });

    it('validationImportFailed includes error list', () => {
      const error = validationImportFailed(['missing bins', 'bad version']);
      expect(error.errors).toEqual(['missing bins', 'bad version']);
    });
  });

  describe('layout errors', () => {
    it('layoutLayerLimit includes counts in metadata', () => {
      const error = layoutLayerLimit(10, 10);
      expect(error.currentCount).toBe(10);
      expect(error.maxCount).toBe(10);
      expect(error.metadata).toEqual({ currentCount: 10, maxCount: 10 });
    });

    it('layoutLastEntity includes entity type', () => {
      const error = layoutLastEntity('layer');
      expect(error.entityType).toBe('layer');
    });

    it('layoutInvalidOperation includes operation and reason', () => {
      const error = layoutInvalidOperation('reorder', 'no layers');
      expect(error.operation).toBe('reorder');
      expect(error.reason).toBe('no layers');
    });
  });

  describe('API errors', () => {
    it('apiRateLimited includes retryAfter', () => {
      const error = apiRateLimited(60);
      expect(error.retryAfter).toBe(60);
      expect(error.metadata).toEqual({ retryAfter: 60 });
    });

    it('apiSizeLimit includes size info', () => {
      const error = apiSizeLimit(600000, 500000);
      expect(error.sizeBytes).toBe(600000);
      expect(error.maxBytes).toBe(500000);
    });

    it('apiBinLimit includes bin counts', () => {
      const error = apiBinLimit(3000, 2500);
      expect(error.binCount).toBe(3000);
      expect(error.maxBins).toBe(2500);
    });
  });

  describe('unknown error', () => {
    it('fromUnknown wraps arbitrary errors', () => {
      const original = new Error('test');
      const error = fromUnknown(original);
      expect(error.kind).toBe('UnknownError');
      expect(error.code).toBe('UNKNOWN_ERROR');
      expect(error.cause).toBe(original);
    });
  });

  describe('catalog integration', () => {
    it('getUserMessage interpolates metadata', () => {
      const error = layoutLayerLimit(10, 10);
      const message = getUserMessage(error);
      expect(message).toContain('10');
    });

    it('getUserMessage returns user message for layoutLastEntity', () => {
      const error = layoutLastEntity('layer');
      const message = getUserMessage(error);
      expect(message).toContain('layer');
    });

    it('getRecoveryHint returns hint with metadata interpolation', () => {
      const error = apiRateLimited(60);
      const hint = getRecoveryHint(error);
      expect(hint).toContain('60');
    });

    it('getRecoveryHint returns hint for storage errors', () => {
      const hint = getRecoveryHint(storageQuotaExceeded());
      expect(hint).toContain('Export');
    });

    it('isRetryable returns correct value per error code', () => {
      expect(isRetryable('API_RATE_LIMITED')).toBe(true);
      expect(isRetryable('API_SERVER_ERROR')).toBe(true);
      expect(isRetryable('STORAGE_NOT_FOUND')).toBe(false);
      expect(isRetryable('VALIDATION_COLLISION')).toBe(false);
    });

    it('getSeverity returns correct severity per error code', () => {
      expect(getSeverity('API_SERVER_ERROR')).toBe('error');
      expect(getSeverity('VALIDATION_COLLISION')).toBe('warning');
      expect(getSeverity('API_RATE_LIMITED')).toBe('warning');
    });
  });
});
