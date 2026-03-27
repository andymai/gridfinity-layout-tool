/**
 * Restore Commands
 *
 * Commands for undo/redo layout restoration via the CQRS pipeline.
 */

import type { BaseCommand } from '../types';
import type { Layout } from '@/core/types';

export type RestoreLayoutCommand = BaseCommand<
  'layout.restore',
  { readonly layout: Layout; readonly direction: 'undo' | 'redo' }
>;

export type RestoreCommand = RestoreLayoutCommand;
