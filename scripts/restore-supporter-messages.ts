/**
 * Restore supporter messages that the old 140-character cap cut short, from a
 * Ko-fi transaction export. Only fields whose stored message is a cut of a
 * message in the export change. Messages are written only into Redis and never
 * printed, so the output is safe to share.
 *
 * Usage:
 *   REDIS_URL=rediss://… pnpm restore-supporter-messages --csv path/to/Transaction_All.csv [--dry-run]
 */

import { readFileSync } from 'node:fs';
import { Redis } from 'ioredis';
import { supportersDonorsKey } from '../api/lib/redisKeys.js';
import { parseTransactionCsv } from './seed-supporters.core.js';
import { planMessageRestores } from './restore-supporter-messages.core.js';

async function main(): Promise<void> {
  const flag = process.argv.indexOf('--csv');
  const path = flag === -1 ? undefined : process.argv[flag + 1];
  if (!path || path.startsWith('--')) {
    console.error('--csv needs a path to a Ko-fi Transaction_All export.');
    process.exit(1);
  }
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.error('REDIS_URL is required. Pull it with `vercel env pull` or pass it inline.');
    process.exit(1);
  }
  const dryRun = process.argv.includes('--dry-run');
  const rows = parseTransactionCsv(readFileSync(path, 'utf-8'));

  const redis = new Redis(redisUrl, { maxRetriesPerRequest: 2 });
  try {
    const donors = await redis.hgetall(supportersDonorsKey());
    const { restores, unmatched } = planMessageRestores(donors, rows);
    console.log(
      `${restores.length} cut message(s) to restore from ${rows.length} transactions` +
        (unmatched ? `; ${unmatched} at the old cap with no single match, left as they are` : '')
    );
    for (const r of restores) {
      const kind = r.field.startsWith('seed:') ? 'seed' : 'live';
      console.log(`  ${kind} record: ${r.storedLength} -> ${r.restoredLength} characters`);
    }
    if (dryRun || restores.length === 0) {
      if (dryRun) console.log('--dry-run: no writes.');
      return;
    }
    await redis.hset(
      supportersDonorsKey(),
      Object.fromEntries(restores.map((r) => [r.field, r.value]))
    );
    console.log('Done.');
  } finally {
    redis.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Restore failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
