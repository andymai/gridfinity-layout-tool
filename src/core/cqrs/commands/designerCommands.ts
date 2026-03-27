/**
 * Designer Domain Commands
 *
 * Commands for bin designer persistence operations.
 */

import type { BaseCommand } from '../types';

export type DesignerSaveCommand = BaseCommand<
  'designer.save',
  { readonly designId: string; readonly data: unknown }
>;

export type DesignerCommand = DesignerSaveCommand;
