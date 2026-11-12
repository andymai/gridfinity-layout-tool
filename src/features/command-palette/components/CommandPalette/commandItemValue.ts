import type { CommandDefinition } from '../../commands';

export type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The cmdk value of a command's row: its id, then the text the search matches. */
export function commandItemValue(command: CommandDefinition, t: Translate): string {
  return `${command.id}::${[t(command.labelKey), ...(command.keywords ?? [])].join(' ')}`;
}
