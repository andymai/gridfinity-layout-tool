import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPerfSampled, PERF_SAMPLE_RATE, resetPerfSampling } from './perfSampling';

afterEach(() => {
  resetPerfSampling();
  vi.restoreAllMocks();
});

describe('isPerfSampled', () => {
  it('admits a session that rolls under the sample rate', () => {
    vi.spyOn(Math, 'random').mockReturnValue(PERF_SAMPLE_RATE / 2);

    expect(isPerfSampled()).toBe(true);
  });

  it('rejects a session that rolls on or above the sample rate', () => {
    vi.spyOn(Math, 'random').mockReturnValue(PERF_SAMPLE_RATE);

    expect(isPerfSampled()).toBe(false);
  });

  it('rolls once and reuses the verdict so a session emits a complete series', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);

    const verdicts = [isPerfSampled(), isPerfSampled(), isPerfSampled()];

    expect(verdicts).toEqual([true, true, true]);
    expect(random).toHaveBeenCalledTimes(1);
  });
});
