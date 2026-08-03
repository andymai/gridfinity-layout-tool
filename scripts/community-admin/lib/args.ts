export interface Args {
  command: string;
  positional: string[];
  json: boolean;
  yes: boolean;
  help: boolean;
  /** `--reason <value>`; the only valued flag today, used by `feature`. */
  reason: string | null;
}

export function parseArgs(argv: readonly string[]): Args {
  const a: Args = {
    command: '',
    positional: [],
    json: false,
    yes: false,
    help: false,
    reason: null,
  };
  // Index-based rather than for-of: `--reason` consumes the next argv entry,
  // which a value-only iterator cannot reach.
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--json') a.json = true;
    else if (arg === '--yes' || arg === '-y') a.yes = true;
    else if (arg === '--help' || arg === '-h') a.help = true;
    else if (arg === '--reason') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new Error('--reason requires a value');
      }
      a.reason = value;
      i += 1;
    } else if (arg.startsWith('--')) throw new Error(`Unknown flag: ${arg}`);
    else if (!a.command) a.command = arg;
    else a.positional.push(arg);
  }
  return a;
}
