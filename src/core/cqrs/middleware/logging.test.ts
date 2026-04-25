import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loggingMiddleware } from './logging';
import { ok, err } from '@/core/result';
import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { NextFn, CommandMeta } from '../types';

function makeCommand(type: string): Command {
  return {
    type,
    payload: { x: 1 },
    meta: {
      id: 'cmd-1' as CommandMeta['id'],
      timestamp: Date.now(),
      correlationId: 'corr-1' as CommandMeta['correlationId'],
      source: 'user',
    },
  } as Command;
}

function makeEvent(type: string): DomainEvent {
  return {
    type,
    payload: {},
    meta: {
      id: 'evt-1',
      timestamp: Date.now(),
      correlationId: 'corr-1',
      commandId: 'cmd-1',
      aggregateId: 'layout-1',
      version: 1,
      schemaVersion: 1,
    },
  } as unknown as DomainEvent;
}

describe('loggingMiddleware', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    debugSpy.mockRestore();
  });

  it('passes command through and returns result', () => {
    const expected = ok({ value: undefined, events: [] as DomainEvent[] });
    const next: NextFn<Command, DomainEvent> = vi.fn(() => expected);
    const cmd = makeCommand('bin.add');

    const result = loggingMiddleware(cmd, next);
    expect(next).toHaveBeenCalledWith(cmd);
    expect(result).toBe(expected);
  });

  it('handles error results without crashing', () => {
    const errorResult = err({ code: 'TEST_ERROR', message: 'fail' });
    const next: NextFn<Command, DomainEvent> = vi.fn(() => errorResult);
    const cmd = makeCommand('bin.add');

    const result = loggingMiddleware(cmd, next);
    expect(result).toBe(errorResult);
  });

  it('handles success with events', () => {
    const events = [makeEvent('bin.added'), makeEvent('bin.added')];
    const successResult = ok({ value: 'test-id', events });
    const next: NextFn<Command, DomainEvent> = vi.fn(() => successResult);
    const cmd = makeCommand('bin.add');

    const result = loggingMiddleware(cmd, next);
    expect(result).toBe(successResult);
  });
});
