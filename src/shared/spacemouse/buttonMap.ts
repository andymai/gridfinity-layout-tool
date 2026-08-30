import type { SpaceMouseCommand } from './types';

/**
 * Default button-index to command mapping. Tuned so the two buttons every puck
 * has (index 0/1) do the most-used actions, while larger devices
 * (SpaceMouse Pro/Enterprise) reach the view presets and history on the rest.
 */
export const DEFAULT_BUTTON_MAP: readonly SpaceMouseCommand[] = [
  'fit',
  'reset',
  'view-top',
  'view-front',
  'view-right',
  'view-iso',
  'undo',
  'redo',
];

export function resolveButtonCommand(
  buttonIndex: number,
  map: readonly SpaceMouseCommand[] = DEFAULT_BUTTON_MAP
): SpaceMouseCommand | null {
  return map[buttonIndex] ?? null;
}

const GLOBAL_COMMANDS: ReadonlySet<SpaceMouseCommand> = new Set(['undo', 'redo']);

/** True for commands that act on app state rather than a specific canvas. */
export function isGlobalCommand(command: SpaceMouseCommand): boolean {
  return GLOBAL_COMMANDS.has(command);
}
