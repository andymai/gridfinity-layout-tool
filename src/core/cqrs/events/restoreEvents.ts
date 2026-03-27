/**
 * Restore Domain Events
 */

import type { BaseDomainEvent } from '../types';

export type LayoutRestoredEvent = BaseDomainEvent<
  'layout.restored',
  { readonly direction: 'undo' | 'redo' }
>;

export type RestoreEvent = LayoutRestoredEvent;
