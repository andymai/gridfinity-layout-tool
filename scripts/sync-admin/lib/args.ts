import type { Kind } from './types.js';

export interface Args {
  command: string;
  positional: string[];
  json: boolean;
  strict: boolean;
  suggest: boolean;
  noPayloadFetch: boolean;
  kind?: Kind;
  user?: string;
  olderThanMs?: number;
  help: boolean;
}

const KINDS: Kind[] = ['layouts', 'designs'];

function parseOlderThan(v: string): number {
  const m = v.match(/^(\d+)d$/);
  if (!m) throw new Error(`--older-than expects e.g. 90d, got "${v}"`);
  return parseInt(m[1], 10) * 24 * 60 * 60 * 1000;
}

export function parseArgs(argv: readonly string[]): Args {
  const a: Args = {
    command: '',
    positional: [],
    json: false,
    strict: false,
    suggest: false,
    noPayloadFetch: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') a.json = true;
    else if (arg === '--strict') a.strict = true;
    else if (arg === '--suggest') a.suggest = true;
    else if (arg === '--no-payload-fetch') a.noPayloadFetch = true;
    else if (arg === '--help' || arg === '-h') a.help = true;
    else if (arg.startsWith('--kind=')) {
      const v = arg.slice('--kind='.length);
      if (!KINDS.includes(v as Kind)) throw new Error(`--kind must be one of ${KINDS.join('|')}`);
      a.kind = v as Kind;
    } else if (arg.startsWith('--user=')) {
      const v = arg.slice('--user='.length);
      if (!v) throw new Error('--user= cannot be empty — omit the flag to scan all users');
      a.user = v;
    } else if (arg.startsWith('--older-than='))
      a.olderThanMs = parseOlderThan(arg.slice('--older-than='.length));
    else if (arg.startsWith('--')) throw new Error(`Unknown flag: ${arg}`);
    else if (!a.command) a.command = arg;
    else a.positional.push(arg);
  }
  return a;
}
