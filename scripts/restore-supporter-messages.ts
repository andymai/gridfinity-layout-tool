/**
 * Usage:
 *   REDIS_URL=rediss://… TOKEN_SALT=… pnpm restore-supporter-messages --csv path/to/Transaction_All.csv [--dry-run]
 *
 * Prints lengths only, never message text.
 */

import { readFileSync } from 'node:fs';
import { Redis } from 'ioredis';
import { supportersDonorsKey } from '../api/lib/redisKeys.js';
import { deriveDonorId } from '../api/lib/supporters.js';
import { parseTransactionCsv } from './seed-supporters.core.js';
import { planMessageRestores } from './restore-supporter-messages.core.js';

// Writes only if the field still holds what was read, so a supporter's edit
// (or going anonymous) between the read and the write is never undone.
const COMPARE_AND_SET = `
if redis.call('HGET', KEYS[1], ARGV[1]) == ARGV[2] then
  redis.call('HSET', KEYS[1], ARGV[1], ARGV[3])
  return 1
end
return 0`;

const say = (line: string): void => void process.stdout.write(`${line}\n`);

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

  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
  try {
    const donors = await redis.hgetall(supportersDonorsKey());
    const { restores, unmatched } = planMessageRestores(donors, rows, deriveDonorId);
    say(
      `${restores.length} cut message(s) to restore from ${rows.length} transactions` +
        (unmatched ? `; ${unmatched} at the old cap with no single match, left as they are` : '')
    );
    for (const r of restores) {
      const kind = r.field.startsWith('seed:') ? 'seed' : 'live';
      say(`  ${kind} record: ${r.storedLength} -> ${r.restoredLength} characters`);
    }
    if (dryRun) {
      say('--dry-run: no writes.');
      return;
    }
    let written = 0;
    for (const r of restores) {
      written += Number(
        await redis.eval(COMPARE_AND_SET, 1, supportersDonorsKey(), r.field, r.previous, r.value)
      );
    }
    const changed = restores.length - written;
    say(`Restored ${written}.` + (changed ? ` Skipped ${changed} edited since the read.` : ''));
  } finally {
    redis.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Restore failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
