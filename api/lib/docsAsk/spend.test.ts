import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_DAILY_CAP_USD, costUsd, dailyCapUsd, spendDay } from './spend.js';

describe('costUsd', () => {
  it('prices each kind of token at the Opus 5.5 rate', () => {
    const usage = {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
      cache_read_input_tokens: 1_000_000,
      cache_creation_input_tokens: 1_000_000,
    };
    expect(costUsd('claude-opus-5-5', usage)).toBeCloseTo(4 + 20 + 0.2 + 5);
  });

  it('prices an unlisted fallback model above Opus 5.5', () => {
    const usage = { input_tokens: 1000, output_tokens: 1000 };
    expect(costUsd('claude-some-fallback', usage)).toBeGreaterThan(
      costUsd('claude-opus-5-5', usage)
    );
  });
});

describe('dailyCapUsd', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reads the env, and falls back to the default for nonsense', () => {
    vi.stubEnv('DOCS_ASSISTANT_DAILY_CAP_USD', '12.5');
    expect(dailyCapUsd()).toBe(12.5);
    vi.stubEnv('DOCS_ASSISTANT_DAILY_CAP_USD', 'lots');
    expect(dailyCapUsd()).toBe(DEFAULT_DAILY_CAP_USD);
    vi.stubEnv('DOCS_ASSISTANT_DAILY_CAP_USD', '-1');
    expect(dailyCapUsd()).toBe(DEFAULT_DAILY_CAP_USD);
  });
});

it('counts the day in UTC', () => {
  expect(spendDay(new Date('2026-11-21T23:59:59-08:00'))).toBe('2026-11-22');
});
