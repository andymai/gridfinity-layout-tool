/**
 * createRegistry — assembles a typed registry of v2 command definitions.
 *
 * Takes an `as const` tuple of command defs and returns a registry that
 * preserves each command's full type, plus a `byType` lookup keyed by
 * the command's literal `type` string.
 *
 * Explicit array assembly (not auto-discovery) so the dependency graph
 * is greppable and tree-shakeable.
 */

import type { AnyCommandDef } from './types';

/**
 * Lookup map keyed by each command's literal `type`, preserving the
 * command's full inferred type.
 */
export type RegistryByType<T extends readonly AnyCommandDef[]> = {
  readonly [K in T[number] as K['type']]: K;
};

export interface Registry<T extends readonly AnyCommandDef[]> {
  readonly commands: T;
  readonly byType: RegistryByType<T>;
}

export function createRegistry<const T extends readonly AnyCommandDef[]>(commands: T): Registry<T> {
  const seen = new Set<string>();
  for (const command of commands) {
    if (seen.has(command.type)) {
      throw new Error(
        `createRegistry: duplicate command type "${command.type}" — every command must register a unique type`
      );
    }
    seen.add(command.type);
  }
  const byType = Object.fromEntries(commands.map((c) => [c.type, c])) as RegistryByType<T>;
  return { commands, byType };
}
