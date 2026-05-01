/**
 * Drawer & Layout Metadata Events
 */

import type { BaseDomainEvent } from '../types';
import type { BinId, Drawer, BaseplateParams } from '@/core/types';

// `displacedBinIds` records the exact set of bins displaced by a
// drawer-shrink cascade. Optional only for back-compat with persisted
// events that carried only the count; replay leaves bins untouched
// in that case.
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
