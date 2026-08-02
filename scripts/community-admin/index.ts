import { denylist } from './commands/denylist.js';
import { feature, unfeature } from './commands/feature.js';
import { hide } from './commands/hide.js';
import { inspect } from './commands/inspect.js';
import { list } from './commands/list.js';
import { purge } from './commands/purge.js';
import { restore } from './commands/restore.js';
import { undenylist } from './commands/undenylist.js';
import { parseArgs, type Args } from './lib/args.js';
import { printBanner } from './lib/banner.js';
import { dispatch } from './lib/dispatch.js';
import { loadEnv, requireEnv } from './lib/env.js';

const COMMANDS: Record<string, (a: Args) => Promise<number>> = {
  list,
  inspect,
  hide,
  restore,
  purge,
  denylist,
  undenylist,
  feature,
  unfeature,
};

const HELP = `community-admin: direct-write moderation CLI for the community showcase

Usage:
  pnpm community-admin <command> [args] [flags]

Commands:
  list [flagged|hidden|all]      List designs with status counts (default: all)
  inspect <id>                   Full record (blob + card) plus report state
  hide <id>                      Set status to hidden and drop it from gallery indexes
  restore <id>                   Set status back to live and re-index it
  purge <id> --yes               Hard-delete blobs and every Redis key for one design
  denylist <userId>              Bar a user from publishing and hide their live designs
  undenylist <userId>            Remove a user from the deny-list (does not restore designs)
  feature <id>                   Set featured=true on the blob and the card hash
  unfeature <id>                 Set featured=false on the blob and the card hash

Flags:
  --json          Machine-readable output (list, inspect)
  --yes           Required to confirm \`purge\` (irreversible)
  --help          Show this message

Examples:
  pnpm community-admin list flagged
  pnpm community-admin inspect abc123DEF456
  pnpm community-admin hide abc123DEF456
  pnpm community-admin purge abc123DEF456 --yes
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
  requireEnv('TOKEN_SALT');
  printBanner();

  const outcome = await dispatch(COMMANDS, args);
  if (outcome.unknownCommand) {
    console.error(`Unknown command: ${outcome.unknownCommand}`);
    process.stdout.write('\n' + HELP);
  }
  return outcome.code;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(err);
    process.exit(2);
  });
