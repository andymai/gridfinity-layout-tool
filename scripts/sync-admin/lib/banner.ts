export function printBanner(): void {
  const redisUrl = process.env.REDIS_URL ?? '';
  const blobToken = process.env.BLOB_READ_WRITE_TOKEN ?? '';
  const host = redisUrl.match(/@([^:]+)/)?.[1] ?? '<unknown>';
  const tokenPrefix = blobToken.slice(0, 28);
  const stream = process.stderr;
  stream.write('────────────────────────────────────────────────\n');
  stream.write(`  sync-admin\n`);
  stream.write(`  Redis: ${host}\n`);
  stream.write(`  Blob token: ${tokenPrefix}…\n`);
  stream.write('────────────────────────────────────────────────\n');
}
