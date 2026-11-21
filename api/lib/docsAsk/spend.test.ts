import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Redis } from 'ioredis';
import {
  DEFAULT_DAILY_CAP_USD,
  costUsd,
  dailyCapUsd,
  releaseSpend,
  reserveSpend,
  spendDay,
} from './spend.js';

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

describe('reserveSpend', () => {
  function counter(start: number) {
    let value = start;
    const redis = {
      multi: () => {
        const ops: number[] = [];
        const chain = {
          incrbyfloat: (_key: string, by: number) => (ops.push(by), chain),
          expire: () => chain,
          exec: async () => ops.map((by) => [null, String((value += by))]),
        };
        return chain;
      },
      incrbyfloat: async (_key: string, by: number) => String((value += by)),
    };
    return { redis: redis as unknown as Redis, total: () => value };
  }

  it('holds money while the spend before it is under the cap', async () => {
    const day = counter(4.9);
    expect(await reserveSpend(day.redis, 0.15, 5, '2026-11-21')).toBe(true);
    expect(day.total()).toBeCloseTo(5.05);
    await releaseSpend(day.redis, 0.15, '2026-11-21');
    expect(day.total()).toBeCloseTo(4.9);
  });

  it('refuses at the cap and gives the money back', async () => {
    const day = counter(5);
    expect(await reserveSpend(day.redis, 0.15, 5, '2026-11-21')).toBe(false);
    expect(day.total()).toBeCloseTo(5);
  });
});
