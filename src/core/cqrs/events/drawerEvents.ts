/**
 * Drawer & Layout Metadata Events
 */

import type { BaseDomainEvent } from '../types';
import type { Drawer, BaseplateParams } from '@/core/types';

export type DrawerUpdatedEvent = BaseDomainEvent<
  'drawer.updated',
  {
    readonly changes: Partial<Drawer>;
    readonly previous: Partial<Drawer>;
    readonly binsDisplacedToStaging: number;
  }
>;

export type LayoutNameSetEvent = BaseDomainEvent<
  'layout.nameSet',
  { readonly name: string; readonly previousName: string }
>;

export type PrintBedSizeSetEvent = BaseDomainEvent<
  'layout.printBedSizeSet',
  { readonly size: number; readonly previousSize: number }
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
