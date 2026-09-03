import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const captureException = vi.fn();
vi.mock('@/shared/analytics/posthog/eventsErrors', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
}));

import { guardRead, guardWrite } from './navlibClient';

describe('navlib wire-boundary guards', () => {
  beforeEach(() => {
    captureException.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes a value through and substitutes the fallback for null or undefined', () => {
    expect(
      guardRead(
        'a',
        () => [1, 2],
        () => [0]
      )()
    ).toEqual([1, 2]);
    expect(
      guardRead(
        'b',
        () => null,
        () => [0]
      )()
    ).toEqual([0]);
    expect(
      guardRead(
        'c',
        () => undefined,
        () => 'x'
      )()
    ).toBe('x');
    expect(
      guardRead(
        'd',
        () => false,
        () => true
      )()
    ).toBe(false);
  });

  it('answers with the fallback when the read throws, and reports once per property', async () => {
    const read = guardRead(
      'hit.lookat',
      () => {
        throw new TypeError("Cannot read properties of null (reading 'near')");
      },
      () => null
    );
    expect(read()).toBeNull();
    expect(read()).toBeNull();
    await vi.waitFor(() => expect(captureException).toHaveBeenCalledTimes(1));
    expect(captureException.mock.calls[0][1]).toMatchObject({
      boundary: 'spacemouse-navlib',
      property: 'hit.lookat',
    });
  });

  it('swallows a throwing write', async () => {
    const write = guardWrite<number>('transaction', () => {
      throw new Error('boom');
    });
    expect(() => write(0)).not.toThrow();
    await vi.waitFor(() => expect(captureException).toHaveBeenCalledTimes(1));
  });

  it('lets a later failure report again when the error module fails to load', async () => {
    vi.resetModules();
    vi.doMock('@/shared/analytics/posthog/eventsErrors', () => {
      throw new Error('chunk load failed');
    });
    const fresh = await import('./navlibClient');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const read = fresh.guardRead(
      'view.fov',
      () => {
        throw new Error('boom');
      },
      () => 1
    );
    expect(read()).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    // Once the rejected import settles the property is released, so a retry
    // warns again instead of staying silent for the rest of the session.
    await vi.waitFor(() => {
      read();
      expect(warn).toHaveBeenCalledTimes(2);
    });
    vi.doUnmock('@/shared/analytics/posthog/eventsErrors');
  });
});
