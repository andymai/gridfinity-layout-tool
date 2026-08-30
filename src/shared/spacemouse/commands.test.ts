import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { runGlobalCommand } from './commands';

describe('runGlobalCommand', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('undoes only when there is history to undo', () => {
    const undo = vi.fn();
    vi.spyOn(useHistoryStore, 'getState').mockReturnValue({
      canUndo: true,
      canRedo: false,
      undo,
      redo: vi.fn(),
    } as unknown as ReturnType<typeof useHistoryStore.getState>);
    runGlobalCommand('undo');
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('does not undo when the stack is empty', () => {
    const undo = vi.fn();
    vi.spyOn(useHistoryStore, 'getState').mockReturnValue({
      canUndo: false,
      canRedo: false,
      undo,
      redo: vi.fn(),
    } as unknown as ReturnType<typeof useHistoryStore.getState>);
    runGlobalCommand('undo');
    expect(undo).not.toHaveBeenCalled();
  });

  it('redoes when possible', () => {
    const redo = vi.fn();
    vi.spyOn(useHistoryStore, 'getState').mockReturnValue({
      canUndo: false,
      canRedo: true,
      undo: vi.fn(),
      redo,
    } as unknown as ReturnType<typeof useHistoryStore.getState>);
    runGlobalCommand('redo');
    expect(redo).toHaveBeenCalledTimes(1);
  });

  it('ignores camera commands', () => {
    const undo = vi.fn();
    const redo = vi.fn();
    vi.spyOn(useHistoryStore, 'getState').mockReturnValue({
      canUndo: true,
      canRedo: true,
      undo,
      redo,
    } as unknown as ReturnType<typeof useHistoryStore.getState>);
    runGlobalCommand('fit');
    expect(undo).not.toHaveBeenCalled();
    expect(redo).not.toHaveBeenCalled();
  });
});
