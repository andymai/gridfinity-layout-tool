/**
 * Drawer & Layout Metadata Commands
 */

import type { BaseCommand } from '../types';
import type {
  BaseplateDesignId,
  Drawer,
  DrawerOutline,
  MeasuredDrawerMm,
  StoredBaseplateParams,
} from '@/core/types';

/**
 * Drawer updates. `measuredMm: null` clears the stored measurement (the
 * model field itself is `MeasuredDrawerMm | undefined`; null only exists
 * on the command wire, like drawer.setOutline).
 */
export type UpdateDrawerPayload = Partial<Omit<Drawer, 'measuredMm'>> & {
  readonly measuredMm?: MeasuredDrawerMm | null;
};

export type UpdateDrawerCommand = BaseCommand<'drawer.update', UpdateDrawerPayload>;

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

export type SetMagnetAnchorCommand = BaseCommand<
  'layout.setMagnetAnchor',
  { readonly anchor: 'edge' | 'center' }
>;

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
  | SetMagnetAnchorCommand
  | SetHeightUnitMmCommand
  | SetBaseplateParamsCommand
  | SetActiveBaseplateCommand;
