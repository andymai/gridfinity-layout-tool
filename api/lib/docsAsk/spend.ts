import type { Redis } from 'ioredis';
import { appAskSpendKey, docsAskSpendKey } from '../redisKeys.js';
import type { Door } from './tools.js';

/** USD per million tokens: input, output, cache read, cache write (5-minute TTL). */
interface Prices {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheWrite: number;
}

const PRICES: Readonly<Record<string, Prices>> = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 2.5 },
};
// A refusal fallback can answer on a model this table does not list. Pricing
// it like an older Opus keeps the cap on the safe side.
const UNLISTED: Prices = { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 };

export const DEFAULT_DAILY_CAP_USD = 5;
/** The app door's own share, counted apart, so neither door can spend the other's money. */
export const DEFAULT_APP_DAILY_CAP_USD = 2;
/**
 * Set aside before each round. It covers a round's full MAX_TOKENS of output
 * even at the unlisted price of a fallback model, so rounds that start
 * together cannot run far past the cap.
 */
export const ROUND_RESERVE_USD = 0.5;
const SPEND_TTL_SECONDS = 2 * 24 * 60 * 60;

export interface Usage {
  readonly input_tokens: number;
  readonly output_tokens: number;
  readonly cache_read_input_tokens?: number | null;
  readonly cache_creation_input_tokens?: number | null;
}

export function costUsd(model: string, usage: Usage): number {
  const p = PRICES[model] ?? UNLISTED;
  return (
    (usage.input_tokens * p.input +
      usage.output_tokens * p.output +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead +
      (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite) /
    1_000_000
  );
}

export function dailyCapUsd(door: Door = 'docs'): number {
  const value = Number(
    door === 'app'
      ? process.env.APP_ASSISTANT_DAILY_CAP_USD
      : process.env.DOCS_ASSISTANT_DAILY_CAP_USD
  );
  if (Number.isFinite(value) && value >= 0) return value;
  return door === 'app' ? DEFAULT_APP_DAILY_CAP_USD : DEFAULT_DAILY_CAP_USD;
}

const spendKey = (day: string, door: Door): string =>
  door === 'app' ? appAskSpendKey(day) : docsAskSpendKey(day);

export function spendDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function readSpend(
  redis: Redis,
  day: string = spendDay(),
  door: Door = 'docs'
): Promise<number> {
  const value = Number(await redis.get(spendKey(day, door)));
  return Number.isFinite(value) ? value : 0;
}

export async function addSpend(
  redis: Redis,
  usd: number,
  day: string = spendDay(),
  door: Door = 'docs'
): Promise<void> {
  if (!(usd > 0)) return;
  const key = spendKey(day, door);
  await redis.multi().incrbyfloat(key, usd).expire(key, SPEND_TTL_SECONDS).exec();
}

/** True, with the money held, when the spend before it was under the cap. */
export async function reserveSpend(
  redis: Redis,
  usd: number,
  capUsd: number,
  day: string = spendDay(),
  door: Door = 'docs'
): Promise<boolean> {
  const key = spendKey(day, door);
  const results = await redis.multi().incrbyfloat(key, usd).expire(key, SPEND_TTL_SECONDS).exec();
  const total = Number(results?.[0]?.[1]);
  if (Number.isFinite(total) && total - usd < capUsd) return true;
  await redis.incrbyfloat(key, -usd);
  return false;
}

export async function releaseSpend(
  redis: Redis,
  usd: number,
  day: string,
  door: Door = 'docs'
): Promise<void> {
  await redis.incrbyfloat(spendKey(day, door), -usd);
}
