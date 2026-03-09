/**
 * Drawer & Layout Metadata Commands
 */

import type { BaseCommand } from '../types';
import type { Drawer, BaseplateParams } from '@/core/types';

export type UpdateDrawerCommand = BaseCommand<'drawer.update', Partial<Drawer>>;

export type SetNameCommand = BaseCommand<'layout.setName', { readonly name: string }>;

export type SetPrintBedSizeCommand = BaseCommand<
  'layout.setPrintBedSize',
  { readonly size: number }
>;

export type SetGridUnitMmCommand = BaseCommand<'layout.setGridUnitMm', { readonly mm: number }>;

export type SetHeightUnitMmCommand = BaseCommand<'layout.setHeightUnitMm', { readonly mm: number }>;

export type SetBaseplateParamsCommand = BaseCommand<
  'layout.setBaseplateParams',
  { readonly params: BaseplateParams }
>;

export type DrawerCommand =
  | UpdateDrawerCommand
  | SetNameCommand
  | SetPrintBedSizeCommand
  | SetGridUnitMmCommand
  | SetHeightUnitMmCommand
  | SetBaseplateParamsCommand;
