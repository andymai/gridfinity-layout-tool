/**
 * One-time seed / backfill of Ko-fi supporters into Redis.
 *
 * The Ko-fi webhook is a push-only feed with no replay, so it can only record
 * supporters who pay *after* it goes live. Everyone already in `supporters.json`
 * predates it; they get synthetic `seed:*` ids that no webhook delivery can
 * collide with, so re-running only rewrites those fields (never duplicates a
 * live bin).
 *
 * With `--csv <Transaction_All.csv>` it enriches those seed records with real
 * join dates and messages from a Ko-fi transaction export, and writes a
 * per-currency `supporters:totals` baseline **only when that hash is still
 * empty**, so re-running never clobbers counters the webhook has since
 * incremented. Names are attributed only when they appear in the reconciled
 * public list in `supporters.json`; everyone else is seeded anonymously (date
 * only, no name or message). Messages and emails from the CSV are never written
 * to disk — only into Redis.
 *
 * Usage:
 *   REDIS_URL=rediss://… pnpm seed-supporters [--csv path/to/Transaction_All.csv] [--dry-run]
 */

import { readFileSync } from 'node:fs';
import { Redis } from 'ioredis';
import supporters from '../src/features/supporters/data/supporters.json' with { type: 'json' };
import { supportersDonorsKey, supportersTotalsKey } from '../api/lib/redisKeys.js';
import {
  buildSeedEntries,
  parseTransactionCsv,
  type TransactionRow,
} from './seed-supporters.core.js';

function parseRedisUrl(redisUrl: string) {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 6379,
    password: url.password || undefined,
    username: url.username || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    db: url.pathname ? parseInt(url.pathname.slice(1), 10) || 0 : 0,
  };
}

function readCsvArg(): TransactionRow[] {
  const flag = process.argv.indexOf('--csv');
  if (flag === -1) return [];
  const path = process.argv[flag + 1];
  if (!path || path.startsWith('--')) {
    console.error('--csv needs a path to a Ko-fi Transaction_All export.');
    process.exit(1);
  }
  return parseTransactionCsv(readFileSync(path, 'utf-8'));
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const rows = readCsvArg();

  const publicNames = supporters.supporters
    .map((s) => s.name)
    .filter((name): name is string => !!name);
  const anonCount = supporters.supporters.filter((s) => !s.name).length;

  const { entries, totals, stats } = buildSeedEntries(publicNames, anonCount, rows);
  const totalFields = Object.keys(entries).length;
  console.log(
    `Seeding ${totalFields} supporters (${stats.named} named, ${stats.anon} anonymous)` +
      (rows.length
        ? ` from ${rows.length} transactions: ${stats.withDate} dated, ${stats.withMessage} with a message`
        : ' (names only — pass --csv to backfill dates and messages)')
  );
  if (Object.keys(totals).length) {
    console.log(
      'Totals baseline: ' +
        Object.entries(totals)
          .map(([cur, minor]) => `${cur} ${(minor / 100).toFixed(2)}`)
          .join(', ')
    );
  }

  if (dryRun) {
    console.log('--dry-run: no writes. Fields that would be set:');
    for (const [field, value] of Object.entries(entries)) {
      console.log(`  ${field} = ${value}`);
    }
    return;
  }

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('REDIS_URL is required. Pull it with `vercel env pull` or pass it inline.');
    process.exit(1);
  }

  const redis = new Redis({ ...parseRedisUrl(redisUrl), maxRetriesPerRequest: 2 });
  try {
    const before = await redis.hlen(supportersDonorsKey());
    await redis.hset(supportersDonorsKey(), entries);
    const after = await redis.hlen(supportersDonorsKey());

    // Only seed the totals baseline into an empty hash: the webhook increments
    // this same key with HINCRBY, so overwriting it on a re-run would discard
    // every payment recorded since the first backfill.
    if (Object.keys(totals).length > 0) {
      const existingTotals = await redis.hlen(supportersTotalsKey());
      if (existingTotals === 0) {
        for (const [cur, minor] of Object.entries(totals)) {
          await redis.hset(supportersTotalsKey(), cur, String(minor));
        }
      } else {
        console.log(
          `Skipped totals baseline: ${supportersTotalsKey()} already has ${existingTotals} entr${existingTotals === 1 ? 'y' : 'ies'} (would clobber live counters).`
        );
      }
    }

    console.log(`Done. ${supportersDonorsKey()}: ${before} → ${after} donors.`);
  } finally {
    redis.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
