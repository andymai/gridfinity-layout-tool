/**
 * Library Domain Commands
 *
 * Commands for multi-layout library operations: create, delete, duplicate,
 * switch, rename, cloud share, and import.
 */

import type { BaseCommand } from '../types';
import type { Layout, LayoutId, CloudShareInfo, LayoutPreview } from '@/core/types';

export type CreateEntryCommand = BaseCommand<
  'library.createEntry',
  { readonly name: string; readonly layoutId?: LayoutId; readonly preview?: LayoutPreview }
>;

export type DeleteEntryCommand = BaseCommand<
  'library.deleteEntry',
  { readonly layoutId: LayoutId }
>;

export type DuplicateEntryCommand = BaseCommand<
  'library.duplicateEntry',
  { readonly sourceLayoutId: LayoutId }
>;

export type SwitchActiveCommand = BaseCommand<
  'library.switchActive',
  { readonly layoutId: LayoutId }
>;

export type UpdateEntryCommand = BaseCommand<
  'library.updateEntry',
  {
    readonly layoutId: LayoutId;
    readonly updates: {
      readonly name?: string;
      readonly preview?: LayoutPreview;
      readonly author?: string;
    };
  }
>;

export type SetAuthorNameCommand = BaseCommand<'library.setAuthorName', { readonly name: string }>;

export type SetCloudShareCommand = BaseCommand<
  'library.setCloudShare',
  { readonly layoutId: LayoutId; readonly shareInfo: CloudShareInfo }
>;

export type ClearCloudShareCommand = BaseCommand<
  'library.clearCloudShare',
  { readonly layoutId: LayoutId }
>;

export type RenameEntryCommand = BaseCommand<
  'library.renameEntry',
  { readonly layoutId: LayoutId; readonly name: string }
>;

export type ImportLayoutCommand = BaseCommand<
  'library.importLayout',
  { readonly layout: Layout; readonly name: string }
>;

export type LibraryCommand =
  | CreateEntryCommand
  | DeleteEntryCommand
  | DuplicateEntryCommand
  | SwitchActiveCommand
  | UpdateEntryCommand
  | SetAuthorNameCommand
  | SetCloudShareCommand
  | ClearCloudShareCommand
  | RenameEntryCommand
  | ImportLayoutCommand;
