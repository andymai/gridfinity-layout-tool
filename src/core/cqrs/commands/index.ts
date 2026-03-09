/**
 * Command Types & Factory
 *
 * Re-exports all command types and provides a factory for creating commands
 * with auto-generated metadata.
 */

import { commandId, correlationId } from '../types';
import type { CommandMeta, CommandSource, BaseCommand } from '../types';

// Re-export domain commands
export type { BinCommand } from './binCommands';
export type {
  AddBinCommand,
  UpdateBinCommand,
  DeleteBinCommand,
  DeleteBinsCommand,
  DuplicateBinCommand,
  MoveBinToStagingCommand,
  MoveBinFromStagingCommand,
  FillLayerCommand,
  ClearLayerCommand,
} from './binCommands';

export type { LayerCommand } from './layerCommands';
export type {
  AddLayerCommand,
  UpdateLayerCommand,
  DeleteLayerCommand,
  ReorderLayersCommand,
} from './layerCommands';

export type { CategoryCommand } from './categoryCommands';
export type {
  AddCategoryCommand,
  UpdateCategoryCommand,
  DeleteCategoryCommand,
} from './categoryCommands';

export type { DrawerCommand } from './drawerCommands';
export type {
  UpdateDrawerCommand,
  SetNameCommand,
  SetPrintBedSizeCommand,
  SetGridUnitMmCommand,
  SetHeightUnitMmCommand,
  SetBaseplateParamsCommand,
} from './drawerCommands';

// === Union of all commands ===

import type { BinCommand } from './binCommands';
import type { LayerCommand } from './layerCommands';
import type { CategoryCommand } from './categoryCommands';
import type { DrawerCommand } from './drawerCommands';

export type Command = BinCommand | LayerCommand | CategoryCommand | DrawerCommand;

/** All possible command type strings, derived from the Command union */
export type CommandType = Command['type'];

// === ID Generation ===

let commandCounter = 0;
let correlationCounter = 0;

function generateCommandId(): ReturnType<typeof commandId> {
  return commandId(`cmd_${Date.now()}_${++commandCounter}`);
}

function generateCorrelationId(): ReturnType<typeof correlationId> {
  return correlationId(`cor_${Date.now()}_${++correlationCounter}`);
}

// === Factory ===

/**
 * Create a command with auto-generated metadata.
 *
 * @example
 * ```ts
 * const cmd = createCommand('bin.add', { layerId, x: 0, y: 0, width: 1, depth: 1, ... });
 * commandBus.dispatch(cmd);
 * ```
 */
export function createCommand<TType extends CommandType>(
  type: TType,
  payload: Extract<Command, { type: TType }>['payload'],
  options?: { source?: CommandSource; correlationId?: ReturnType<typeof correlationId> }
): Extract<Command, { type: TType }> {
  const meta: CommandMeta = {
    id: generateCommandId(),
    timestamp: Date.now(),
    correlationId: options?.correlationId ?? generateCorrelationId(),
    source: options?.source ?? 'user',
  };

  return { type, payload, meta } as BaseCommand<TType, typeof payload> &
    Extract<Command, { type: TType }>;
}
