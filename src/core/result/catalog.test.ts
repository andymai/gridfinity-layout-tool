import { describe, it, expect } from 'vitest';
import {
  ERROR_CATALOG,
  getErrorInfo,
  formatErrorMessage,
  getUserMessage,
  getRecoveryHint,
  isRetryable,
  getSeverity,
} from './catalog';
import type { ErrorCode } from './errors';

describe('error catalog', () => {
  describe('ERROR_CATALOG', () => {
    it('has an entry for every ErrorCode (exhaustive check via catalog keys)', () => {
      // Use the catalog's own keys as the source of truth — every key must match its entry's code
      const catalogKeys = Object.keys(ERROR_CATALOG) as ErrorCode[];
      expect(catalogKeys.length).toBeGreaterThan(0);
      for (const code of catalogKeys) {
        expect(ERROR_CATALOG[code].code).toBe(code);
      }

      // Compile-time exhaustiveness: if a new ErrorCode is added to the union
      // but not to ERROR_CATALOG, TypeScript will error here since the catalog
      // is Record<ErrorCode, ...> and must have all keys.
      // Runtime check: verify known domains are represented
      const domains = catalogKeys.map((k) => k.split('_')[0]);
      expect(domains).toContain('STORAGE');
      expect(domains).toContain('VALIDATION');
      expect(domains).toContain('LAYOUT');
      expect(domains).toContain('API');
      expect(domains).toContain('UNKNOWN');
    });

    it('every entry has required fields', () => {
      for (const [code, entry] of Object.entries(ERROR_CATALOG)) {
        expect(entry.code).toBe(code);
        expect(typeof entry.defaultMessage).toBe('string');
        expect(typeof entry.retryable).toBe('boolean');
        expect(['error', 'warning', 'info']).toContain(entry.severity);
      }
    });
  });

  describe('getErrorInfo', () => {
    it('returns catalog entry for known code', () => {
      const info = getErrorInfo('STORAGE_QUOTA_EXCEEDED');
      expect(info.code).toBe('STORAGE_QUOTA_EXCEEDED');
      expect(info.retryable).toBe(false);
    });
  });

  describe('formatErrorMessage', () => {
    it('interpolates variables', () => {
      expect(formatErrorMessage('Hello {name}', { name: 'World' })).toBe('Hello World');
    });

    it('handles multiple variables', () => {
      expect(formatErrorMessage('{a} and {b}', { a: 'X', b: 'Y' })).toBe('X and Y');
    });

    it('handles numeric variables', () => {
      expect(formatErrorMessage('Wait {seconds}s', { seconds: 60 })).toBe('Wait 60s');
    });

    it('keeps placeholder for missing variables', () => {
      expect(formatErrorMessage('Hello {missing}', {})).toBe('Hello {missing}');
    });

    it('returns template unchanged when no vars provided', () => {
      expect(formatErrorMessage('plain text')).toBe('plain text');
    });
  });

  describe('getUserMessage', () => {
    it('returns user message for error with userMessage', () => {
      const msg = getUserMessage({ code: 'STORAGE_QUOTA_EXCEEDED' });
      expect(msg).toBe('Storage full. Export your layout to save it.');
    });

    it('falls back to defaultMessage if no userMessage', () => {
      // STORAGE_NETWORK_ERROR has no userMessage in the catalog
      const info = getErrorInfo('STORAGE_NETWORK_ERROR');
      const msg = getUserMessage({ code: 'STORAGE_NETWORK_ERROR' });
      expect(msg).toBe(info.userMessage || info.defaultMessage);
    });

    it('interpolates metadata into message', () => {
      const msg = getUserMessage({
        code: 'LAYOUT_LAST_ENTITY',
        metadata: { entityType: 'layer' },
      });
      expect(msg).toContain('layer');
    });
  });

  describe('getRecoveryHint', () => {
    it('returns recovery hint for error with one', () => {
      const hint = getRecoveryHint({ code: 'STORAGE_QUOTA_EXCEEDED' });
      expect(hint).toBeDefined();
      expect(typeof hint).toBe('string');
    });

    it('interpolates metadata into hint', () => {
      const hint = getRecoveryHint({
        code: 'API_RATE_LIMITED',
        metadata: { retryAfter: 60 },
      });
      expect(hint).toContain('60');
    });
  });

  describe('isRetryable', () => {
    it('returns true for retryable errors', () => {
      expect(isRetryable('API_SERVER_ERROR')).toBe(true);
      expect(isRetryable('API_TIMEOUT')).toBe(true);
      expect(isRetryable('UNKNOWN_ERROR')).toBe(true);
    });

    it('returns false for non-retryable errors', () => {
      expect(isRetryable('VALIDATION_COLLISION')).toBe(false);
      expect(isRetryable('LAYOUT_LAST_ENTITY')).toBe(false);
    });
  });

  describe('getSeverity', () => {
    it('returns correct severity for errors', () => {
      expect(getSeverity('STORAGE_QUOTA_EXCEEDED')).toBe('error');
      expect(getSeverity('API_RATE_LIMITED')).toBe('warning');
    });
  });
});
