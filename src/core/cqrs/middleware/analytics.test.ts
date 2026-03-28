import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyticsMiddleware } from './analytics';
import { ok, err } from '@/core/result';
import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { CommandResult, NextFn, CommandMeta } from '../types';

vi.mock('@/shared/analytics/posthog', () => ({
  trackEvent: vi.fn(),
}));

function makeCommand(type: string, source: CommandMeta['source'] = 'user'): Command {
  return {
    type,
    payload: {},
    meta: {
      id: 'cmd-1' as CommandMeta['id'],
      timestamp: Date.now(),
      correlationId: 'corr-1' as CommandMeta['correlationId'],
      source,
    },
  } as Command;
}

function makeSuccessResult(events: DomainEvent[] = []): CommandResult<unknown, DomainEvent> {
  return ok({ value: undefined, events });
}

describe('analyticsMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('passes command to next and returns result', () => {
    const expected = makeSuccessResult();
    const next: NextFn<Command, DomainEvent> = vi.fn(() => expected);
    const cmd = makeCommand('bin.add');

    const result = analyticsMiddleware(cmd, next);
    expect(next).toHaveBeenCalledWith(cmd);
    expect(result).toBe(expected);
  });

  it('does not track analytics for replay commands', async () => {
    const { trackEvent } = await import('@/shared/analytics/posthog');
    vi.mocked(trackEvent).mockClear();

    const next: NextFn<Command, DomainEvent> = vi.fn(() => makeSuccessResult());
    const cmd = makeCommand('bin.add', 'replay');

    analyticsMiddleware(cmd, next);
    // Allow any pending microtasks (dynamic import) to settle
    await vi.waitFor(() => {
      expect(trackEvent).not.toHaveBeenCalled();
    });
  });

  it('returns error result unchanged', () => {
    const errorResult = err({ code: 'LAYOUT_INVALID_OPERATION', message: 'test' });
    const next: NextFn<Command, DomainEvent> = vi.fn(() => errorResult);
    const cmd = makeCommand('bin.add');

    const result = analyticsMiddleware(cmd, next);
    expect(result).toBe(errorResult);
  });
});
