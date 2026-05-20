// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackEventMock = vi.fn();

vi.mock('./trackEvent', () => ({
  trackEvent: (name: string, properties?: Record<string, unknown>) => {
    trackEventMock(name, properties);
  },
  getDeviceType: () => 'desktop',
}));

import { trackCachePerformance } from './eventsPerformance';

beforeEach(() => {
  trackEventMock.mockReset();
});

describe('trackCachePerformance', () => {
  it('emits aggregate properties without per-cache fields when per_cache is omitted', () => {
    trackCachePerformance({
      total_hits: 12,
      total_misses: 4,
      total_evictions: 1,
      hit_rate: 0.75,
      cache_count: 3,
    });

    expect(trackEventMock).toHaveBeenCalledWith('generation_cache_stats', {
      total_hits: 12,
      total_misses: 4,
      total_evictions: 1,
      hit_rate: 0.75,
      cache_count: 3,
    });
  });

  it('flattens per-cache hit rate and evictions into top-level properties', () => {
    trackCachePerformance({
      total_hits: 10,
      total_misses: 10,
      total_evictions: 2,
      hit_rate: 0.5,
      cache_count: 2,
      per_cache: [
        { name: 'socket', hits: 8, misses: 2, evictions: 0, size: 5, maxSize: 20 },
        { name: 'shell', hits: 2, misses: 8, evictions: 2, size: 5, maxSize: 15 },
      ],
    });

    expect(trackEventMock).toHaveBeenCalledWith('generation_cache_stats', {
      total_hits: 10,
      total_misses: 10,
      total_evictions: 2,
      hit_rate: 0.5,
      cache_count: 2,
      cache_socket_hit_rate: 0.8,
      cache_socket_evictions: 0,
      cache_shell_hit_rate: 0.2,
      cache_shell_evictions: 2,
    });
  });

  it('normalises any non-alphanumeric character so PostHog keys stay ergonomic', () => {
    trackCachePerformance({
      total_hits: 4,
      total_misses: 0,
      total_evictions: 0,
      hit_rate: 1,
      cache_count: 1,
      per_cache: [
        { name: 'baseplate-mesh-result', hits: 4, misses: 0, evictions: 0, size: 1, maxSize: 32 },
        { name: 'Feature.Builder (v2)', hits: 2, misses: 0, evictions: 0, size: 1, maxSize: 10 },
      ],
    });

    const props = trackEventMock.mock.calls[0]?.[1] as Record<string, number>;
    expect(props).toHaveProperty('cache_baseplate_mesh_result_hit_rate', 1);
    expect(props).toHaveProperty('cache_feature_builder_v2_hit_rate', 1);
    expect(props).not.toHaveProperty('cache_baseplate-mesh-result_hit_rate');
  });

  it('drops colliding entries and records the collision count for HogQL visibility', () => {
    trackCachePerformance({
      total_hits: 6,
      total_misses: 4,
      total_evictions: 0,
      hit_rate: 0.6,
      cache_count: 2,
      per_cache: [
        { name: 'feature-socket', hits: 4, misses: 0, evictions: 0, size: 1, maxSize: 10 },
        { name: 'feature_socket', hits: 2, misses: 4, evictions: 5, size: 1, maxSize: 10 },
      ],
    });

    const props = trackEventMock.mock.calls[0]?.[1] as Record<string, number>;
    expect(props).toHaveProperty('cache_feature_socket_hit_rate', 1);
    expect(props).toHaveProperty('cache_feature_socket_evictions', 0);
    expect(props).toHaveProperty('cache_key_collisions', 1);
  });

  it('skips caches with zero activity to avoid NaN', () => {
    trackCachePerformance({
      total_hits: 5,
      total_misses: 0,
      total_evictions: 0,
      hit_rate: 1,
      cache_count: 2,
      per_cache: [
        { name: 'used', hits: 5, misses: 0, evictions: 0, size: 1, maxSize: 10 },
        { name: 'idle', hits: 0, misses: 0, evictions: 0, size: 0, maxSize: 10 },
      ],
    });

    const props = trackEventMock.mock.calls[0]?.[1] as Record<string, number>;
    expect(props).toHaveProperty('cache_used_hit_rate', 1);
    expect(props).not.toHaveProperty('cache_idle_hit_rate');
  });
});
