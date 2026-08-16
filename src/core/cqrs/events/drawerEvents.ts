/**
 * Drawer & Layout Metadata Events
 */

import type { BaseDomainEvent } from '../types';
import type {
  BaseplateDesignId,
  BinId,
  Drawer,
  DrawerOutline,
  StoredBaseplateParams,
} from '@/core/types';

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

export type DrawerOutlineSetEvent = BaseDomainEvent<
  'drawer.outlineSet',
  {
    /** undefined = shape cleared back to the plain rectangle. */
    readonly outline: DrawerOutline | undefined;
    readonly previousOutline: DrawerOutline | undefined;
    readonly binsDisplacedToStaging: number;
    readonly displacedBinIds: ReadonlyArray<BinId>;
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

/** Non-square depth-axis pitch. `null` = square (Y pitch cleared). */
export type GridUnitMmYSetEvent = BaseDomainEvent<
  'layout.gridUnitMmYSet',
  { readonly mm: number | null; readonly previousMmY: number | null }
>;

export type MagnetAnchorSetEvent = BaseDomainEvent<
  'layout.magnetAnchorSet',
  { readonly anchor: 'edge' | 'center'; readonly previousAnchor: 'edge' | 'center' }
>;

export type HeightUnitMmSetEvent = BaseDomainEvent<
  'layout.heightUnitMmSet',
  { readonly mm: number; readonly previousMm: number }
>;

// Padding participates in the grid↔perimeter frame, so a params
// change can move the registered frame and displace bins exactly like a
// resize. `displacedBinIds` is optional for back-compat with persisted
// events that predate the field; replay leaves bins untouched then.
export type BaseplateParamsSetEvent = BaseDomainEvent<
  'layout.baseplateParamsSet',
  {
    readonly params: StoredBaseplateParams;
    readonly previousParams?: StoredBaseplateParams;
    readonly displacedBinIds?: ReadonlyArray<BinId>;
  }
>;

export type ActiveBaseplateSetEvent = BaseDomainEvent<
  'layout.activeBaseplateSet',
  {
    readonly designId: BaseplateDesignId | null;
    readonly params: StoredBaseplateParams;
    readonly previousActiveBaseplateId: BaseplateDesignId | null;
    readonly previousParams?: StoredBaseplateParams;
    readonly displacedBinIds?: ReadonlyArray<BinId>;
  }
>;

export type DrawerEvent =
  | DrawerUpdatedEvent
  | DrawerOutlineSetEvent
  | LayoutNameSetEvent
  | PrintBedSizeSetEvent
  | GridUnitMmSetEvent
  | GridUnitMmYSetEvent
  | MagnetAnchorSetEvent
  | HeightUnitMmSetEvent
  | BaseplateParamsSetEvent
  | ActiveBaseplateSetEvent;
