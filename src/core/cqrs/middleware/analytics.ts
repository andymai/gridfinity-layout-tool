/**
 * Analytics Middleware
 *
 * Bridges CQRS commands to existing PostHog/ML tracking.
 */

import { isOk } from '@/core/result';
import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { CommandResult, NextFn } from '../types';

export function analyticsMiddleware(
  command: Command,
  next: NextFn<Command, DomainEvent>
): CommandResult<unknown, DomainEvent> {
  const result = next(command);

  if (isOk(result) && command.meta.source !== 'replay') {
    // Lazy import to avoid circular deps and keep analytics optional
    void import('@/shared/analytics/posthog').then(({ trackEvent }) => {
      trackEvent('cqrs_command_executed', {
        command_type: command.type,
        event_count: result.value.events.length,
        source: command.meta.source,
      });
    });
  }

  return result;
}
