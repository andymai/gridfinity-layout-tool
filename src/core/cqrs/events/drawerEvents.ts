/**
 * Drawer & Layout Metadata Events
 */

import type { BaseDomainEvent } from '../types';
import type { BinId, Drawer, BaseplateParams } from '@/core/types';

/**
 * `displacedBinIds` was added in the v2 migration so apply() can target
 * the exact bins displaced by the drawer-shrink cascade. v1-era persisted
 * events have only the `binsDisplacedToStaging` count — replay against
 * those falls back to leaving bins untouched (matches prior behavior).
 */
export type DrawerUpdatedEvent = BaseDomainEvent<
  'drawer.updated',
  {
    readonly changes: Partial<Drawer>;
    readonly previous: Partial<Drawer>;
    readonly binsDisplacedToStaging: number;
    readonly displacedBinIds?: ReadonlyArray<BinId>;
  }
>;

export type LayoutNameSetEvent = BaseDomainEvent<
  'layout.nameSet',
  { readonly name: string; readonly previousName: string }
>;

export type PrintBedSizeSetEvent = BaseDomainEvent<
  'layout.printBedSizeSet',
  {
    readonly size: number;
    readonly previousSize: number;
    readonly depth?: number;
    readonly previousDepth?: number;
  }
>;

export type GridUnitMmSetEvent = BaseDomainEvent<
  'layout.gridUnitMmSet',
  { readonly mm: number; readonly previousMm: number }
>;

export type HeightUnitMmSetEvent = BaseDomainEvent<
  'layout.heightUnitMmSet',
  { readonly mm: number; readonly previousMm: number }
>;

export type BaseplateParamsSetEvent = BaseDomainEvent<
  'layout.baseplateParamsSet',
  { readonly params: BaseplateParams; readonly previousParams?: BaseplateParams }
>;

export type DrawerEvent =
  | DrawerUpdatedEvent
  | LayoutNameSetEvent
  | PrintBedSizeSetEvent
  | GridUnitMmSetEvent
  | HeightUnitMmSetEvent
  | BaseplateParamsSetEvent;
