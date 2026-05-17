import { describe, expect, it } from 'vitest';
import { filterExceptionForPosthog, shouldIgnoreError } from './errorFilters';

describe('shouldIgnoreError — message patterns', () => {
  it.each([
    'Error: No Listener: tabs:outgoing.message.ready',
    'No Listener: tabs:incoming.foo',
    'Invalid call to runtime.sendMessage(). Tab not found.',
    'Extension context invalidated.',
    'Script error.',
    'Script error',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications.',
  ])('ignores %j', (msg) => {
    expect(shouldIgnoreError(msg)).toBe(true);
  });

  it.each([
    'Cannot read properties of null (reading addEventListener)',
    'Error creating WebGL context',
    'Failed to fetch dynamically imported module',
    'TypeError: foo is not a function',
  ])('does NOT ignore real app error %j', (msg) => {
    expect(shouldIgnoreError(msg)).toBe(false);
  });

  it('ignores empty / undefined message safely', () => {
    expect(shouldIgnoreError(null)).toBe(false);
    expect(shouldIgnoreError(undefined)).toBe(false);
    expect(shouldIgnoreError('')).toBe(false);
  });
});

describe('shouldIgnoreError — source patterns', () => {
  it.each([
    'chrome-extension://abc123/content.js',
    'moz-extension://uuid/script.js',
    'safari-web-extension://abc/foo.js',
    'safari-extension://abc/foo.js',
  ])('ignores %j', (source) => {
    expect(shouldIgnoreError('TypeError: x', source)).toBe(true);
  });

  it('does NOT ignore app sources', () => {
    expect(shouldIgnoreError('TypeError: x', '/assets/main-abc.js')).toBe(false);
    expect(shouldIgnoreError('TypeError: x', 'https://gridfinitylayouttool.com/foo.js')).toBe(
      false
    );
  });
});

describe('filterExceptionForPosthog', () => {
  it('passes non-$exception events through unchanged', () => {
    const e = { event: '$pageview', properties: { url: '/baseplate' } };
    expect(filterExceptionForPosthog(e)).toBe(e);
  });

  it('drops $exception events whose $exception_list value matches a filter', () => {
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [{ value: 'No Listener: tabs:outgoing.message.ready' }],
      },
    };
    expect(filterExceptionForPosthog(e)).toBeNull();
  });

  it('drops $exception events using $exception_values fallback', () => {
    const e = {
      event: '$exception',
      properties: { $exception_values: ['Invalid call to runtime.sendMessage(). Tab not found.'] },
    };
    expect(filterExceptionForPosthog(e)).toBeNull();
  });

  it('passes $exception events for real app errors through', () => {
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [{ value: 'Cannot read properties of null (reading foo)' }],
      },
    };
    expect(filterExceptionForPosthog(e)).toBe(e);
  });

  it('keeps $exception when only a non-primary cause matches a filter', () => {
    // Real app error wraps an extension error as Error.cause — keep the event,
    // since the user-visible failure is the primary (app) error.
    const e = {
      event: '$exception',
      properties: {
        $exception_list: [
          { value: 'TypeError: appCode is undefined' },
          { value: 'No Listener: tabs:outgoing.message.ready' },
        ],
      },
    };
    expect(filterExceptionForPosthog(e)).toBe(e);
  });
});
