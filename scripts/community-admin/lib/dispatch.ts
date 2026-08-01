import type { Args } from './args.js';

export type CommandTable = Record<string, (a: Args) => Promise<number>>;

export interface DispatchOutcome {
  code: number;
  /** Set when args.command didn't match any entry in the table; null otherwise. */
  unknownCommand: string | null;
}

/**
 * Resolve args.command against the table and run it. Kept separate from
 * index.ts's main() so command routing is testable without env vars, Redis,
 * or Blob credentials.
 */
export async function dispatch(commands: CommandTable, args: Args): Promise<DispatchOutcome> {
  const handler = commands[args.command];
  if (!handler) {
    return { code: 2, unknownCommand: args.command };
  }
  return { code: await handler(args), unknownCommand: null };
}
