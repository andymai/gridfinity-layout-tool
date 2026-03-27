/**
 * Library Domain Events
 *
 * Events produced by library command handlers. Persisted to IndexedDB
 * for audit trail. Used by subscribers for cross-feature communication.
 */

import type { BaseDomainEvent } from '../types';
import type { LayoutId, CloudShareInfo } from '@/core/types';

export type LibraryEntryCreatedEvent = BaseDomainEvent<
  'library.entryCreated',
  { readonly layoutId: LayoutId; readonly name: string }
>;

export type LibraryEntryDeletedEvent = BaseDomainEvent<
  'library.entryDeleted',
  { readonly layoutId: LayoutId }
>;

export type LibraryEntryDuplicatedEvent = BaseDomainEvent<
  'library.entryDuplicated',
  { readonly sourceLayoutId: LayoutId; readonly newLayoutId: LayoutId }
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
