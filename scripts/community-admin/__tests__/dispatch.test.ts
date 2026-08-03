import { describe, it, expect, vi } from 'vitest';
import { dispatch } from '../lib/dispatch';
import type { Args } from '../lib/args';

function baseArgs(command: string, positional: string[] = []): Args {
  return { command, positional, json: false, yes: false, help: false, reason: null };
}

describe('dispatch', () => {
  it('routes a known command to its handler and returns the handler result', async () => {
    const hide = vi.fn().mockResolvedValue(0);
    const purge = vi.fn().mockResolvedValue(1);
    const outcome = await dispatch({ hide, purge }, baseArgs('hide', ['abc123DEF456']));

    expect(outcome).toEqual({ code: 0, unknownCommand: null });
    expect(hide).toHaveBeenCalledTimes(1);
    expect(hide).toHaveBeenCalledWith(baseArgs('hide', ['abc123DEF456']));
    expect(purge).not.toHaveBeenCalled();
  });

  it('propagates the handler exit code unchanged', async () => {
    const denylist = vi.fn().mockResolvedValue(2);
    const outcome = await dispatch({ denylist }, baseArgs('denylist'));
    expect(outcome.code).toBe(2);
  });

  it('reports an unknown command without calling any handler', async () => {
    const list = vi.fn().mockResolvedValue(0);
    const outcome = await dispatch({ list }, baseArgs('bogus'));

    expect(outcome).toEqual({ code: 2, unknownCommand: 'bogus' });
    expect(list).not.toHaveBeenCalled();
  });

  it('treats the empty command table the same as no match', async () => {
    const outcome = await dispatch({}, baseArgs('list'));
    expect(outcome).toEqual({ code: 2, unknownCommand: 'list' });
  });
});
