import { audit } from './commands/audit.js';
import { suggest } from './commands/suggest.js';
import { tombstones } from './commands/tombstones.js';
import { user } from './commands/user.js';
import { users } from './commands/users.js';
import { parseArgs, type Args } from './lib/args.js';
import { printBanner } from './lib/banner.js';
import { loadEnv, requireEnv } from './lib/env.js';

const COMMANDS: Record<string, (a: Args) => Promise<number>> = {
  audit,
  user,
  users,
  tombstones,
  suggest,
};

const HELP = `sync-admin — operator toolkit for the cloud-sync subsystem

Usage:
  pnpm sync-admin <command> [flags]

Commands:
  audit                  Integrity check: reconcile blobs ↔ index, validate envelopes, detect drift
  user <uid>             Inspect one user's blobs, index entries, and findings
  users                  Table of all users sorted by total bytes
  tombstones             List tombstones with age and stale status
  suggest <category>     Emit shell commands for: drift | orphans | stale-tombstones | malformed

Flags:
  --json                 Machine-readable output
  --strict               Exit non-zero if any error/warning finding present
  --kind=layouts|designs Restrict to one item kind
  --user=<uid>           Restrict to one user (audit/tombstones/suggest)
  --no-payload-fetch     Skip per-blob HTTP fetch (faster; envelope checks skipped)
  --suggest              For \`audit\`: inline fix commands beneath each finding
  --older-than=Nd        For \`tombstones\` / \`suggest stale-tombstones\`: age threshold (default 90d)
  --help                 Show this message

Examples:
  pnpm sync-admin audit
  pnpm sync-admin audit --suggest --strict
  pnpm sync-admin user 589314dfbe7f...
  pnpm sync-admin users --json | jq '.[0]'
  pnpm sync-admin tombstones --older-than=180d
  pnpm sync-admin suggest drift > fixes.sh
`;

async function main(): Promise<number> {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    return 2;
  }

  if (args.help || !args.command) {
    process.stdout.write(HELP);
    return 0;
  }

  loadEnv();
  requireEnv('REDIS_URL');
  requireEnv('BLOB_READ_WRITE_TOKEN');
  printBanner();

  const handler = COMMANDS[args.command];
  if (!handler) {
    console.error(`Unknown command: ${args.command}`);
    process.stdout.write('\n' + HELP);
    return 2;
  }
  return handler(args);
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(2);
  });
