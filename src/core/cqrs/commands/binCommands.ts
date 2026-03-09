/**
 * Bin Domain Commands
 *
 * Commands for creating, updating, moving, and deleting bins.
 * Each command represents a user intent that will be validated and executed.
 */

import type { BaseCommand } from '../types';
import type { Bin, BinId, LayerId, CategoryId } from '@/core/types';

// === Command Types ===

export type AddBinCommand = BaseCommand<'bin.add', Omit<Bin, 'id'>>;

export type UpdateBinCommand = BaseCommand<
  'bin.update',
  { readonly id: BinId; readonly updates: Partial<Bin> }
>;

export type DeleteBinCommand = BaseCommand<'bin.delete', { readonly id: BinId }>;

export type DeleteBinsCommand = BaseCommand<
  'bin.deleteBatch',
  { readonly ids: ReadonlyArray<BinId> }
>;

export type DuplicateBinCommand = BaseCommand<'bin.duplicate', { readonly id: BinId }>;

export type MoveBinToStagingCommand = BaseCommand<'bin.moveToStaging', { readonly id: BinId }>;

export type MoveBinFromStagingCommand = BaseCommand<
  'bin.moveFromStaging',
  {
    readonly id: BinId;
    readonly layerId: LayerId;
    readonly x: number;
    readonly y: number;
  }
>;

export type FillLayerCommand = BaseCommand<
  'bin.fillLayer',
  {
    readonly layerId: LayerId;
    readonly width: number;
    readonly depth: number;
    readonly categoryId: CategoryId;
    readonly halfBinMode?: boolean;
  }
>;

export type ClearLayerCommand = BaseCommand<'bin.clearLayer', { readonly layerId: LayerId }>;

// === Union ===

export type BinCommand =
  | AddBinCommand
  | UpdateBinCommand
  | DeleteBinCommand
  | DeleteBinsCommand
  | DuplicateBinCommand
  | MoveBinToStagingCommand
  | MoveBinFromStagingCommand
  | FillLayerCommand
  | ClearLayerCommand;
