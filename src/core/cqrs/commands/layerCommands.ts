/**
 * Layer Domain Commands
 */

import type { BaseCommand } from '../types';
import type { Layer, LayerId } from '@/core/types';

export type AddLayerCommand = BaseCommand<'layer.add', Record<string, never>>;

export type UpdateLayerCommand = BaseCommand<
  'layer.update',
  { readonly id: LayerId; readonly updates: Partial<Layer> }
>;

export type DeleteLayerCommand = BaseCommand<'layer.delete', { readonly id: LayerId }>;

export type ReorderLayersCommand = BaseCommand<
  'layer.reorder',
  { readonly fromIndex: number; readonly toIndex: number }
>;

export type LayerCommand =
  | AddLayerCommand
  | UpdateLayerCommand
  | DeleteLayerCommand
  | ReorderLayersCommand;
