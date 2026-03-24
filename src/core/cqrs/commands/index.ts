/**
 * Command Types & Factory
 *
 * Re-exports all command types and provides a factory for creating commands
 * with auto-generated metadata.
 */

import { commandId, correlationId } from '../types';
import type { CommandId, CommandMeta, CommandSource, CorrelationId } from '../types';

// Re-export domain command types
export type {
  BinCommand,
  AddBinCommand,
  UpdateBinCommand,
  DeleteBinCommand,
  DeleteBinsCommand,
  DuplicateBinCommand,
  MoveBinToStagingCommand,
  MoveBinFromStagingCommand,
  FillLayerCommand,
  FillLayerGapsCommand,
  ClearLayerCommand,
} from './binCommands';

export type {
  LayerCommand,
  AddLayerCommand,
  UpdateLayerCommand,
  DeleteLayerCommand,
  ReorderLayersCommand,
} from './layerCommands';

export type {
  CategoryCommand,
  AddCategoryCommand,
  UpdateCategoryCommand,
  DeleteCategoryCommand,
} from './categoryCommands';

export type {
  DrawerCommand,
  UpdateDrawerCommand,
  SetNameCommand,
  SetPrintBedSizeCommand,
  SetGridUnitMmCommand,
  SetHeightUnitMmCommand,
  SetBaseplateParamsCommand,
} from './drawerCommands';
import type { BinCommand } from './binCommands';
import type { LayerCommand } from './layerCommands';
import type { CategoryCommand } from './categoryCommands';
import type { DrawerCommand } from './drawerCommands';

export type Command = BinCommand | LayerCommand | CategoryCommand | DrawerCommand;

/** All possible command type strings, derived from the Command union */
export type CommandType = Command['type'];
let commandCounter = 0;
let correlationCounter = 0;

function generateCommandId(): CommandId {
  return commandId(`cmd_${Date.now()}_${++commandCounter}`);
}

function generateCorrelationId(): CorrelationId {
  return correlationId(`cor_${Date.now()}_${++correlationCounter}`);
}
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
  options?: { source?: CommandSource; correlationId?: CorrelationId }
): Extract<Command, { type: TType }> {
  const meta: CommandMeta = {
    id: generateCommandId(),
    timestamp: Date.now(),
    correlationId: options?.correlationId ?? generateCorrelationId(),
    source: options?.source ?? 'user',
  };

  return { type, payload, meta } as Extract<Command, { type: TType }>;
}
