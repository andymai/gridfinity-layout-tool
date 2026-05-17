import { createHash } from 'node:crypto';

export function printBanner(): void {
  const redisUrl = process.env.REDIS_URL ?? '';
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN ?? '';
  const host = redisUrl.match(/@([^:]+)/)?.[1] ?? '<unknown>';
  // Short non-reversible fingerprint so the operator can verify they're
  // pointed at the expected token without leaking any of it into logs.
  const tokenFp = blobToken
    ? createHash('sha256').update(blobToken).digest('hex').slice(0, 8)
    : '—';
  const stream = process.stderr;
  stream.write('────────────────────────────────────────────────\n');
  stream.write(`  sync-admin\n`);
  stream.write(`  Redis: ${host}\n`);
  stream.write(`  Blob token fingerprint: ${tokenFp}\n`);
  stream.write('────────────────────────────────────────────────\n');
}
