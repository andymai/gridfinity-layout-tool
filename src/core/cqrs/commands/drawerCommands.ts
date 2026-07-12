/**
 * Drawer & Layout Metadata Commands
 */

import type { BaseCommand } from '../types';
import type { BaseplateDesignId, Drawer, DrawerOutline, StoredBaseplateParams } from '@/core/types';

export type UpdateDrawerCommand = BaseCommand<'drawer.update', Partial<Drawer>>;

/** Set or clear (null) the drawer's non-rectangular boundary. */
export type SetDrawerOutlineCommand = BaseCommand<
  'drawer.setOutline',
  { readonly outline: DrawerOutline | null }
>;

export type SetNameCommand = BaseCommand<'layout.setName', { readonly name: string }>;

export type SetPrintBedSizeCommand = BaseCommand<
  'layout.setPrintBedSize',
  { readonly size: number; readonly depth?: number }
>;

export type SetGridUnitMmCommand = BaseCommand<'layout.setGridUnitMm', { readonly mm: number }>;

export type SetHeightUnitMmCommand = BaseCommand<'layout.setHeightUnitMm', { readonly mm: number }>;

export type SetBaseplateParamsCommand = BaseCommand<
  'layout.setBaseplateParams',
  { readonly params: StoredBaseplateParams }
>;

export type SetActiveBaseplateCommand = BaseCommand<
  'layout.setActiveBaseplate',
  { readonly designId: BaseplateDesignId | null; readonly params: StoredBaseplateParams }
>;

export type DrawerCommand =
  | UpdateDrawerCommand
  | SetDrawerOutlineCommand
  | SetNameCommand
  | SetPrintBedSizeCommand
  | SetGridUnitMmCommand
  | SetHeightUnitMmCommand
  | SetBaseplateParamsCommand
  | SetActiveBaseplateCommand;
