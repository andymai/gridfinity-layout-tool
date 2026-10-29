/**
 * Usage:
 *   REDIS_URL=rediss://… TOKEN_SALT=… pnpm restore-supporter-messages --csv path/to/Transaction_All.csv [--dry-run]
 *
 * Prints counts only, never message text.
 */

import { readFileSync } from 'node:fs';
import { Redis } from 'ioredis';
import supporters from '../src/features/supporters/data/supporters.json' with { type: 'json' };
import { supportersDonorsKey } from '../api/lib/redisKeys.js';
import { deriveDonorId, parseDonorRecord } from '../api/lib/supporters.js';
import { buildSeedEntries, parseTransactionCsv } from './seed-supporters.core.js';
import { planBackfill, type RecordFix } from './restore-supporter-messages.core.js';

// Writes only if the field still holds what was read, so a supporter's edit
// (or going anonymous) between the read and the write is never undone.
const COMPARE_AND_SET = `
if redis.call('HGET', KEYS[1], ARGV[1]) == ARGV[2] then
  redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
  return 1
end
return 0`;

interface BackfillRedis extends Redis {
  compareAndSet(key: string, field: string, expected: string, value: string): Promise<number>;
}

const say = (line: string): void => void process.stdout.write(`${line}\n`);

/** The seed's own date assignment for `seed:anon:*`, recomputed from the export. */
function seedAnonDates(rows: ReturnType<typeof parseTransactionCsv>): Record<string, string> {
  const names = supporters.supporters.map((s) => s.name).filter((n): n is string => !!n);
  const anonCount = supporters.supporters.length - names.length;
  const dates: Record<string, string> = {};
  for (const [field, raw] of Object.entries(buildSeedEntries(names, anonCount, rows).entries)) {
    const joinedAt = parseDonorRecord(raw).joinedAt;
    if (field.startsWith('seed:anon:') && joinedAt) dates[field] = joinedAt;
  }
  return dates;
}

function summarize(fixes: RecordFix[], rows: number, unmatched: number): void {
  const count = (pick: (f: RecordFix) => boolean): number => fixes.filter(pick).length;
  const kind = (f: RecordFix): string => (f.field.startsWith('seed:') ? 'seed' : 'live');
  say(`${fixes.length} record(s) to update from ${rows} transactions:`);
  say(`  cut messages restored: ${count((f) => f.message === 'restored')}`);
  say(
    `  missing messages added: ${count((f) => f.message === 'added')}` +
      ` (seed ${count((f) => f.message === 'added' && kind(f) === 'seed')},` +
      ` live ${count((f) => f.message === 'added' && kind(f) === 'live')})`
  );
  say(`  missing join dates added: ${count((f) => f.date === 'added')}`);
  say(`  join dates moved back to the first tip: ${count((f) => f.date === 'moved')}`);
  if (unmatched) say(`  ${unmatched} at the old cap with no single match, left as they are`);
}

async function main(): Promise<void> {
  const flag = process.argv.indexOf('--csv');
  const path = flag === -1 ? undefined : process.argv[flag + 1];
  if (!path || path.startsWith('--')) {
    console.error('--csv needs a path to a Ko-fi Transaction_All export.');
    process.exit(1);
  }
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || !process.env.TOKEN_SALT) {
    console.error(
      'REDIS_URL and TOKEN_SALT are required (TOKEN_SALT ties a webhook record to its own transactions). Pull them with `vercel env pull`.'
    );
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');
  const rows = parseTransactionCsv(readFileSync(path, 'utf-8'));

  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2 }) as BackfillRedis;
  redis.defineCommand('compareAndSet', { numberOfKeys: 1, lua: COMPARE_AND_SET });
  try {
    const donors = await redis.hgetall(supportersDonorsKey());
    const { fixes, unmatched } = planBackfill(donors, rows, deriveDonorId, {
      seedAnonDates: seedAnonDates(rows),
    });
    summarize(fixes, rows.length, unmatched);
    if (dryRun) {
      say('--dry-run: no writes.');
      return;
    }
    let written = 0;
    for (const f of fixes) {
      written += await redis.compareAndSet(supportersDonorsKey(), f.field, f.previous, f.value);
    }
    const changed = fixes.length - written;
    say(`Updated ${written}.` + (changed ? ` Skipped ${changed} edited since the read.` : ''));
  } finally {
    redis.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Backfill failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
