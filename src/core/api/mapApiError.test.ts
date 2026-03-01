import { describe, it, expect } from 'vitest';
import { isApiErrorResponse, mapApiErrorResponse } from './mapApiError';

describe('isApiErrorResponse', () => {
  it('returns true for valid error response', () => {
    expect(isApiErrorResponse({ error: 'msg', code: 'NOT_FOUND' })).toBe(true);
  });

  it('returns true for response with retryAfter', () => {
    expect(isApiErrorResponse({ error: 'msg', code: 'RATE_LIMITED', retryAfter: 60 })).toBe(true);
  });

  it('returns false for null', () => {
    expect(isApiErrorResponse(null)).toBe(false);
  });

  it('returns false for non-object', () => {
    expect(isApiErrorResponse('string')).toBe(false);
  });

  it('returns false when error is not a string', () => {
    expect(isApiErrorResponse({ error: 123, code: 'NOT_FOUND' })).toBe(false);
  });

  it('returns false when code is missing', () => {
    expect(isApiErrorResponse({ error: 'msg' })).toBe(false);
  });

  it('returns false when retryAfter is not a number', () => {
    expect(isApiErrorResponse({ error: 'msg', code: 'RATE_LIMITED', retryAfter: 'soon' })).toBe(
      false
    );
  });
});

describe('mapApiErrorResponse', () => {
  it('maps RATE_LIMITED with retryAfter', () => {
    const result = mapApiErrorResponse({ error: 'msg', code: 'RATE_LIMITED', retryAfter: 3600 });
    expect(result.code).toBe('API_RATE_LIMITED');
    expect(result.kind).toBe('ApiError');
    if ('retryAfter' in result) {
      expect(result.retryAfter).toBe(3600);
    }
  });

  it('maps SIZE_LIMIT', () => {
    expect(mapApiErrorResponse({ error: 'msg', code: 'SIZE_LIMIT' }).code).toBe('API_SIZE_LIMIT');
  });

  it('maps BIN_LIMIT', () => {
    expect(mapApiErrorResponse({ error: 'msg', code: 'BIN_LIMIT' }).code).toBe('API_BIN_LIMIT');
  });

  it('maps CONTENT_BLOCKED', () => {
    expect(mapApiErrorResponse({ error: 'msg', code: 'CONTENT_BLOCKED' }).code).toBe(
      'API_CONTENT_BLOCKED'
    );
  });

  it('maps NOT_FOUND', () => {
    expect(mapApiErrorResponse({ error: 'msg', code: 'NOT_FOUND' }).code).toBe('API_NOT_FOUND');
  });

  it('maps UNAUTHORIZED', () => {
    expect(mapApiErrorResponse({ error: 'msg', code: 'UNAUTHORIZED' }).code).toBe(
      'API_UNAUTHORIZED'
    );
  });

  it('maps VALIDATION_ERROR', () => {
    expect(mapApiErrorResponse({ error: 'msg', code: 'VALIDATION_ERROR' }).code).toBe(
      'API_VALIDATION_ERROR'
    );
  });

  it('maps EXPIRED', () => {
    expect(mapApiErrorResponse({ error: 'msg', code: 'EXPIRED' }).code).toBe('API_EXPIRED');
  });

  it('maps INVALID_EXPIRATION', () => {
    expect(mapApiErrorResponse({ error: 'msg', code: 'INVALID_EXPIRATION' }).code).toBe(
      'API_INVALID_EXPIRATION'
    );
  });

  it('maps INVALID_PERMISSION to validation error', () => {
    expect(mapApiErrorResponse({ error: 'msg', code: 'INVALID_PERMISSION' }).code).toBe(
      'API_VALIDATION_ERROR'
    );
  });

  it('maps SERVICE_UNAVAILABLE to server error', () => {
    expect(mapApiErrorResponse({ error: 'msg', code: 'SERVICE_UNAVAILABLE' }).code).toBe(
      'API_SERVER_ERROR'
    );
  });

  it('maps SERVER_ERROR', () => {
    expect(mapApiErrorResponse({ error: 'msg', code: 'SERVER_ERROR' }).code).toBe(
      'API_SERVER_ERROR'
    );
  });

  it('maps CONFIGURATION_ERROR to server error', () => {
    expect(mapApiErrorResponse({ error: 'msg', code: 'CONFIGURATION_ERROR' }).code).toBe(
      'API_SERVER_ERROR'
    );
  });

  it('maps METHOD_NOT_ALLOWED to server error', () => {
    expect(mapApiErrorResponse({ error: 'msg', code: 'METHOD_NOT_ALLOWED' }).code).toBe(
      'API_SERVER_ERROR'
    );
  });

  it('maps unknown codes to server error', () => {
    expect(mapApiErrorResponse({ error: 'msg', code: 'TOTALLY_UNKNOWN' }).code).toBe(
      'API_SERVER_ERROR'
    );
  });
});
