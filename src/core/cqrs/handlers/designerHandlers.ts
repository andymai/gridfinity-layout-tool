/**
 * Designer Command Handlers
 *
 * Handles bin designer persistence operations through the CQRS pipeline.
 */

import { ok } from '@/core/result';
import type { CommandResult } from '../types';
import type { DomainEvent } from '../events';
import type { DesignerSaveCommand } from '../commands';
import { createEventMeta } from './shared';

export function handleDesignerSave(command: DesignerSaveCommand): CommandResult<void, DomainEvent> {
  // The actual IndexedDB persistence is handled by the caller (useAutoSave hook)
  // before or after dispatching this command. The command's purpose is to flow
  // through the middleware pipeline (analytics, logging) and emit a domain event
  // that cross-feature subscribers can react to (e.g., design-linking).

  return ok({
    value: undefined,
    events: [
      {
        type: 'designer.saved' as const,
        payload: { designId: command.payload.designId },
        meta: createEventMeta(command.meta, 'designer.saved'),
      },
    ],
  });
}

export const designerHandlers = {
  'designer.save': handleDesignerSave,
} as const;
