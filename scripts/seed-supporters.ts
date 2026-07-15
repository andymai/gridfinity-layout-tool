/**
 * One-time seed of the backfilled Ko-fi supporters into Redis.
 *
 * The Ko-fi webhook is a push-only feed with no replay or backfill, so it can
 * only ever record supporters who pay *after* it goes live. The 45 people
 * already in `supporters.json` predate it and have no email on file, so they
 * get synthetic donor ids (`seed:*`) that no webhook delivery can collide with.
 *
 * Idempotent: re-running rewrites the same fields to the same values. Safe to
 * run against a store that already has live webhook entries — it only touches
 * `seed:*` fields.
 *
 * Usage:
 *   REDIS_URL=rediss://… pnpm seed-supporters [--dry-run]
 */

import { Redis } from 'ioredis';
import supporters from '../src/features/supporters/data/supporters.json' with { type: 'json' };

const SUPPORTERS_DONORS_KEY = 'supporters:donors';

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

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  // Field name → display name ('' means anonymous), matching the webhook's shape.
  const entries: Record<string, string> = {};
  supporters.named.forEach((name, i) => {
    entries[`seed:named:${i}`] = name;
  });
  for (let i = 0; i < supporters.anonymousCount; i++) {
    entries[`seed:anon:${i}`] = '';
  }

  const total = Object.keys(entries).length;
  console.log(
    `Seeding ${total} supporters (${supporters.named.length} named, ${supporters.anonymousCount} anonymous)`
  );

  if (dryRun) {
    console.log('--dry-run: no writes. Fields that would be set:');
    for (const [field, name] of Object.entries(entries)) {
      console.log(`  ${field} = ${name || '(anonymous)'}`);
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
    const before = await redis.hlen(SUPPORTERS_DONORS_KEY);
    await redis.hset(SUPPORTERS_DONORS_KEY, entries);
    const after = await redis.hlen(SUPPORTERS_DONORS_KEY);
    console.log(`Done. ${SUPPORTERS_DONORS_KEY}: ${before} → ${after} donors.`);
  } finally {
    redis.disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
