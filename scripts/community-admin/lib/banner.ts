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
  const warning = 'DIRECT WRITE: mutations apply immediately, no dry-run';
  const color = stream.isTTY === true && process.env.NO_COLOR === undefined;
  stream.write(color ? `  \x1b[33m${warning}\x1b[0m\n` : `  ${warning}\n`);
  stream.write('────────────────────────────────────────────────\n');
}
