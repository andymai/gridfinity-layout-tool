/**
 * Library Domain Events
 *
 * Events produced by library command handlers. Persisted to IndexedDB
 * for audit trail. Used by subscribers for cross-feature communication.
 */

import type { BaseDomainEvent } from '../types';
import type { LayoutEntry, LayoutId, CloudShareInfo } from '@/core/types';

// `entry` carries the full LayoutEntry so apply() can push
// deterministically. Optional only for back-compat with persisted
// events that carried only {layoutId, name}.
export type LibraryEntryCreatedEvent = BaseDomainEvent<
  'library.entryCreated',
  { readonly layoutId: LayoutId; readonly name: string; readonly entry?: LayoutEntry }
>;

export type LibraryEntryDeletedEvent = BaseDomainEvent<
  'library.entryDeleted',
  { readonly layoutId: LayoutId }
>;

// `entry` carries the duplicated LayoutEntry so apply() can push it
// deterministically. Optional only for back-compat with persisted
// events that carried only the ids.
export type LibraryEntryDuplicatedEvent = BaseDomainEvent<
  'library.entryDuplicated',
  {
    readonly sourceLayoutId: LayoutId;
    readonly newLayoutId: LayoutId;
    readonly entry?: LayoutEntry;
  }
>;

export type LibraryActiveSwitchedEvent = BaseDomainEvent<
  'library.activeLayoutSwitched',
  { readonly previousLayoutId: LayoutId; readonly newLayoutId: LayoutId }
>;

export type LibraryEntryUpdatedEvent = BaseDomainEvent<
  'library.entryUpdated',
  { readonly layoutId: LayoutId; readonly changes: Record<string, unknown> }
>;

export type LibraryAuthorNameSetEvent = BaseDomainEvent<
  'library.authorNameSet',
  { readonly name: string; readonly previousName: string }
>;

export type LibraryCloudShareUpdatedEvent = BaseDomainEvent<
  'library.cloudShareUpdated',
  { readonly layoutId: LayoutId; readonly shareInfo: CloudShareInfo }
>;

export type LibraryCloudShareClearedEvent = BaseDomainEvent<
  'library.cloudShareCleared',
  { readonly layoutId: LayoutId }
>;

export type LibraryEntryRenamedEvent = BaseDomainEvent<
  'library.entryRenamed',
  { readonly layoutId: LayoutId; readonly name: string; readonly previousName: string }
>;

export type LibraryEvent =
  | LibraryEntryCreatedEvent
  | LibraryEntryDeletedEvent
  | LibraryEntryDuplicatedEvent
  | LibraryActiveSwitchedEvent
  | LibraryEntryUpdatedEvent
  | LibraryAuthorNameSetEvent
  | LibraryCloudShareUpdatedEvent
  | LibraryCloudShareClearedEvent
  | LibraryEntryRenamedEvent;
