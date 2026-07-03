import { describe, expect, it } from 'vitest';
import { getErrorCode, getErrorMessage } from './errors';

describe('getErrorCode', () => {
  it('returns the code from an object with a string code', () => {
    expect(getErrorCode({ code: 'INVALID_PARAMS' })).toBe('INVALID_PARAMS');
  });

  it('returns undefined for an object with a non-string code', () => {
    expect(getErrorCode({ code: 42 })).toBeUndefined();
    expect(getErrorCode({ code: null })).toBeUndefined();
  });

  it('returns the code off an Error subclass that carries one', () => {
    const err = Object.assign(new Error('boom'), { code: 'EMPTY_GEOMETRY' });
    expect(getErrorCode(err)).toBe('EMPTY_GEOMETRY');
  });

  it('returns undefined for null', () => {
    expect(getErrorCode(null)).toBeUndefined();
  });

  it('returns undefined for a non-object', () => {
    expect(getErrorCode('oops')).toBeUndefined();
    expect(getErrorCode(7)).toBeUndefined();
    expect(getErrorCode(undefined)).toBeUndefined();
  });

  it('returns undefined for an object missing a code field', () => {
    expect(getErrorCode({ message: 'no code here' })).toBeUndefined();
  });
});

describe('getErrorMessage', () => {
  it('returns the message of an Error', () => {
    expect(getErrorMessage(new Error('kaboom'), 'fallback')).toBe('kaboom');
  });

  it('returns the fallback for a non-Error', () => {
    expect(getErrorMessage('nope', 'fallback')).toBe('fallback');
    expect(getErrorMessage(null, 'fallback')).toBe('fallback');
  });
});
