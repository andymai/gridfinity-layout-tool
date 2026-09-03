import { beforeEach, describe, expect, it, vi } from 'vitest';

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
});
