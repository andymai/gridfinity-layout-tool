import { describe, it, expect } from 'vitest';
import type { CommandDefinition } from '../../commands';
import { commandItemValue } from './commandItemValue';

const t = (key: string) => `label of ${key}`;

describe('commandItemValue', () => {
  it('joins the id, the label and the keywords', () => {
    const command: CommandDefinition = {
      id: 'undo',
      labelKey: 'commandPalette.undo',
      category: 'edit',
      keywords: ['revert', 'back'],
    };
    expect(commandItemValue(command, t)).toBe('undo::label of commandPalette.undo revert back');
  });

  it('ends with the label when a command has no keywords', () => {
    const command: CommandDefinition = {
      id: 'redo',
      labelKey: 'commandPalette.redo',
      category: 'edit',
    };
    expect(commandItemValue(command, t)).toBe('redo::label of commandPalette.redo');
  });
});
