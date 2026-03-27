/**
 * UI Command Handlers
 *
 * No-op handlers for UI analytics commands. These produce no domain events
 * and perform no store mutations. Their sole purpose is existing in the
 * handler registry so the command bus doesn't throw "no handler registered".
 *
 * Analytics tracking happens in the analytics middleware, which runs for
 * all commands regardless of their handler output.
 */

import { ok } from '@/core/result';
import type { CommandResult } from '../types';
import type { DomainEvent } from '../events';
import type { Command } from '../commands';

function handleUiCommand(_command: Command): CommandResult<void, DomainEvent> {
  return ok({ value: undefined, events: [] });
}

export const uiHandlers = {
  'ui.pageView': handleUiCommand,
  'ui.modalOpen': handleUiCommand,
  'ui.modalClose': handleUiCommand,
  'ui.featureUsed': handleUiCommand,
  'ui.shareAttempt': handleUiCommand,
  'ui.shareComplete': handleUiCommand,
  'ui.shareFailed': handleUiCommand,
  'ui.onboardingStep': handleUiCommand,
  'ui.templateApplied': handleUiCommand,
  'ui.layoutExported': handleUiCommand,
} as const;
