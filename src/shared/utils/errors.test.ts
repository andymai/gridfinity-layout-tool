import { beforeEach, describe, expect, it } from 'vitest';
import { getErrorCode, getErrorMessage, reportExportFailure } from './errors';
import { useToastStore } from '@/core/store/toast';

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

describe('reportExportFailure', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it('returns false', () => {
    expect(reportExportFailure(new Error('boom'))).toBe(false);
  });

  it('adds an error toast with the Error message', () => {
    reportExportFailure(new Error('boom'));
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('boom');
    expect(toasts[0].type).toBe('error');
  });

  it("adds an error toast with the 'Export failed' fallback for a non-Error", () => {
    reportExportFailure('nope');
    const { toasts } = useToastStore.getState();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].message).toBe('Export failed');
    expect(toasts[0].type).toBe('error');
  });
});
