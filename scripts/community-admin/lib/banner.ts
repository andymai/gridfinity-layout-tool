import { createHash } from 'node:crypto';

export function printBanner(): void {
  const redisUrl = process.env.REDIS_URL ?? '';
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN ?? '';
  const host = redisUrl.match(/@([^:]+)/)?.[1] ?? '<unknown>';
  const tokenFp = blobToken
    ? createHash('sha256').update(blobToken).digest('hex').slice(0, 8)
    : 'n/a';
  const stream = process.stderr;
  stream.write('────────────────────────────────────────────────\n');
  stream.write(`  community-admin\n`);
  stream.write(`  Redis: ${host}\n`);
  stream.write(`  Blob token fingerprint: ${tokenFp}\n`);
  // Unlike sync-admin, every mutating command below writes to production
  // immediately (README.md, "Deviation from sync-admin").
  stream.write('  \x1b[33mDIRECT WRITE: mutations apply immediately, no dry-run\x1b[0m\n');
  stream.write('────────────────────────────────────────────────\n');
}
