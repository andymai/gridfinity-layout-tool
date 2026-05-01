/**
 * Restore Commands
 *
 * Commands for undo/redo layout restoration via the CQRS pipeline.
 */

import type { BaseCommand } from '../types';
import type { Layout } from '@/core/types';
import type { SelectionSnapshot } from '../undo/historyStore';

/**
 * `selection` carries the user's selection state at the moment the
 * snapshot was captured. When present, the handler restores the exact
 * selection (active layer/category + selected/focused bins). When absent,
 * the handler falls back to pruning stale references against the
 * restored layout.
 */
export type RestoreLayoutCommand = BaseCommand<
  'layout.restore',
  {
    readonly layout: Layout;
    readonly direction: 'undo' | 'redo';
    readonly selection?: SelectionSnapshot;
  }
>;

export type RestoreCommand = RestoreLayoutCommand;
