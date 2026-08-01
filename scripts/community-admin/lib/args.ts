export interface Args {
  command: string;
  positional: string[];
  json: boolean;
  yes: boolean;
  help: boolean;
}

export function parseArgs(argv: readonly string[]): Args {
  const a: Args = {
    command: '',
    positional: [],
    json: false,
    yes: false,
    help: false,
  };
  for (const arg of argv) {
    if (arg === '--json') a.json = true;
    else if (arg === '--yes' || arg === '-y') a.yes = true;
    else if (arg === '--help' || arg === '-h') a.help = true;
    else if (arg.startsWith('--')) throw new Error(`Unknown flag: ${arg}`);
    else if (!a.command) a.command = arg;
    else a.positional.push(arg);
  }
  return a;
}
