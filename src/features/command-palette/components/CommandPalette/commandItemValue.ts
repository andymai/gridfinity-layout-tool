import type { CommandDefinition } from '../../commands';

export type Translate = (key: string, values?: Record<string, string | number>) => string;

export function commandItemValue(command: CommandDefinition, t: Translate): string {
  return `${command.id}::${[t(command.labelKey), ...(command.keywords ?? [])].join(' ')}`;
}
