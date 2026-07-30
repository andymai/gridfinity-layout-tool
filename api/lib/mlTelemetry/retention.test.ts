import { describe, it, expect } from 'vitest';
import { ML_AGGREGATE_TTL_SECONDS, ML_LIFETIME_KEYS, isExpiringAggregate } from './retention.js';

describe('ML telemetry retention policy', () => {
  it('expires 90 days out', () => {
    expect(ML_AGGREGATE_TTL_SECONDS).toBe(7776000);
  });

  it.each([
    'ml:label_hash:1ba025cd',
    'ml:cat:mpwa8w43-50ce8db90a',
    'ml:clusters:000078d9',
    'ml:drawer_sizes:9x7x12.86',
    'ml:sizes',
    'ml:meta:vocab_versions',
    'ml:meta:client_versions',
  ])('expires the aggregate %s', (key) => {
    expect(isExpiringAggregate(key)).toBe(true);
  });

  it.each([...ML_LIFETIME_KEYS])('never expires the running total %s', (key) => {
    expect(isExpiringAggregate(key)).toBe(false);
  });

  // ml_ratelimit:* carries its own 120s TTL and is not an aggregate; the
  // underscore keeps it out of an `ml:*` SCAN, and out of this predicate.
  it.each(['ml_ratelimit:be667baa342372ce', 'session:abc', 'users:abc:profile'])(
    'ignores the non-aggregate key %s',
    (key) => {
      expect(isExpiringAggregate(key)).toBe(false);
    }
  );
});
