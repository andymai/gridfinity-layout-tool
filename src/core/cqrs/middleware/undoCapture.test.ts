import { describe, it, expect, beforeEach } from 'vitest';
import { ok, err } from '@/core/result';
import { layoutInvalidOperation } from '@/core/result/constructors';
import { useLayoutStore } from '@/core/store/layout';
import { useHistoryStore } from '@/core/store/history';
import { resetLayoutStore, resetHistoryStore, createTestLayout } from '@/test/testUtils';
import { undoCaptureMiddleware, batch, _resetUndoCaptureState } from './undoCapture';
import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { CommandResult, NextFn } from '../types';

/** Create a minimal command for testing */
function createTestCommand(
  overrides: Partial<{ source: Command['meta']['source'] }> = {}
): Command {
  return {
    type: 'bin.add',
    payload: {
      layerId: 'layer1',
      x: 0,
      y: 0,
      width: 1,
      depth: 1,
      height: 3,
      category: 'cat1',
    },
    meta: {
      id: 'cmd_test_1',
      timestamp: Date.now(),
      correlationId: 'cor_test_1',
      source: overrides.source ?? 'user',
    },
  } as unknown as Command;
}

/** Create a next function that succeeds with empty events */
function successNext(): NextFn<Command, DomainEvent> {
  return () => ok({ value: undefined, events: [] }) as CommandResult<unknown, DomainEvent>;
}

/** Create a next function that returns an error */
function failureNext(): NextFn<Command, DomainEvent> {
  return () =>
    err(layoutInvalidOperation('bin.add', 'test failure')) as CommandResult<unknown, DomainEvent>;
}

describe('undoCaptureMiddleware', () => {
  beforeEach(() => {
    resetLayoutStore();
    resetHistoryStore();
    _resetUndoCaptureState();
  });

  it('pushes undo entry on successful command', () => {
    const layout = createTestLayout({ name: 'Before mutation' });
    useLayoutStore.setState({ layout });

    const command = createTestCommand();
    const result = undoCaptureMiddleware(command, successNext());

    expect(result.ok).toBe(true);

    const history = useHistoryStore.getState();
    expect(history.past).toHaveLength(1);
    expect(history.past[0].name).toBe('Before mutation');
    expect(history.canUndo).toBe(true);
  });

  it('does not push undo entry on failed command', () => {
    const layout = createTestLayout();
    useLayoutStore.setState({ layout });

    const command = createTestCommand();
    const result = undoCaptureMiddleware(command, failureNext());

    expect(result.ok).toBe(false);

    const history = useHistoryStore.getState();
    expect(history.past).toHaveLength(0);
    expect(history.canUndo).toBe(false);
  });

  it('skips undo capture for replay commands', () => {
    const layout = createTestLayout();
    useLayoutStore.setState({ layout });

    const command = createTestCommand({ source: 'replay' });
    const result = undoCaptureMiddleware(command, successNext());

    expect(result.ok).toBe(true);

    const history = useHistoryStore.getState();
    expect(history.past).toHaveLength(0);
  });

  it('batch() groups multiple dispatches into one undo snapshot', () => {
    const layout = createTestLayout({ name: 'Original' });
    useLayoutStore.setState({ layout });

    // successNext that mutates state so batch detects the change
    const mutatingNext: NextFn<Command, DomainEvent> = () => {
      useLayoutStore.setState({
        layout: { ...useLayoutStore.getState().layout, name: 'Changed' },
      });
      return ok({ value: undefined, events: [] }) as CommandResult<unknown, DomainEvent>;
    };

    batch(() => {
      undoCaptureMiddleware(createTestCommand(), mutatingNext);
      undoCaptureMiddleware(createTestCommand(), mutatingNext);
    });

    const history = useHistoryStore.getState();
    expect(history.past).toHaveLength(1);
    expect(history.past[0].name).toBe('Original');
  });

  it('resets re-entrancy guard after command completes', () => {
    const layout = createTestLayout({ name: 'First' });
    useLayoutStore.setState({ layout });

    // First command
    undoCaptureMiddleware(createTestCommand(), successNext());

    // Update layout for second command
    const layout2 = createTestLayout({ name: 'Second' });
    useLayoutStore.setState({ layout: layout2 });

    // Second command should also capture (guard was released)
    undoCaptureMiddleware(createTestCommand(), successNext());

    const history = useHistoryStore.getState();
    expect(history.past).toHaveLength(2);
    expect(history.past[0].name).toBe('First');
    expect(history.past[1].name).toBe('Second');
  });

  it('resets re-entrancy guard even when command throws', () => {
    const layout = createTestLayout();
    useLayoutStore.setState({ layout });

    const throwingNext: NextFn<Command, DomainEvent> = () => {
      throw new Error('Handler exploded');
    };

    expect(() => undoCaptureMiddleware(createTestCommand(), throwingNext)).toThrow(
      'Handler exploded'
    );

    // Guard should be reset — next call should work normally
    const layout2 = createTestLayout({ name: 'After error' });
    useLayoutStore.setState({ layout: layout2 });

    const result = undoCaptureMiddleware(createTestCommand(), successNext());
    expect(result.ok).toBe(true);

    const history = useHistoryStore.getState();
    expect(history.past).toHaveLength(1);
    expect(history.past[0].name).toBe('After error');
  });

  it('snapshots layout before handler mutates it', () => {
    const layout = createTestLayout({ name: 'Before' });
    useLayoutStore.setState({ layout });

    // next() mutates the store, simulating what a real handler does
    const mutatingNext: NextFn<Command, DomainEvent> = () => {
      useLayoutStore.setState({ layout: createTestLayout({ name: 'After' }) });
      return ok({ value: undefined, events: [] }) as CommandResult<unknown, DomainEvent>;
    };

    undoCaptureMiddleware(createTestCommand(), mutatingNext);

    const history = useHistoryStore.getState();
    expect(history.past).toHaveLength(1);
    // The snapshot should be the state BEFORE the handler ran
    expect(history.past[0].name).toBe('Before');
  });
});
