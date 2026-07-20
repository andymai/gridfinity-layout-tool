/**
 * Tests for the GENERATE_ITEM handler's async prepare pre-pass: prepare must
 * complete before the synchronous generation starts, and a prepare failure
 * must respond ERROR (nothing downstream would — the bridge would hang until
 * its generation timeout hard-resets the worker).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GridfinityItem } from '@/shared/types/item';
import type { GenerateItemMessage } from '../../bridge/types';

const runGeneration = vi.fn();
const respond = vi.fn();
const getItemGenerator = vi.fn();

vi.mock('./workerContext', () => ({
  runGeneration: (...args: unknown[]) => runGeneration(...args),
  respond: (...args: unknown[]) => respond(...args),
  formatError: (e: unknown) => (e instanceof Error ? e.message : String(e)),
  reportProgress: vi.fn(),
  getActiveRequestId: () => 'req-1',
  runExport: vi.fn(),
  classifyExportError: vi.fn(),
}));

vi.mock('../items/generatorRegistry', () => ({
  getItemGenerator: (...args: unknown[]) => getItemGenerator(...args),
}));

import { handleGenerateItem } from './generateItemHandler';

function message(): GenerateItemMessage {
  return {
    type: 'GENERATE_ITEM',
    payload: {
      requestId: 'req-1',
      item: { structure: { kind: 'importedMesh' } } as GridfinityItem,
    },
  };
}

describe('handleGenerateItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('awaits prepare() before starting the synchronous generation', async () => {
    const order: string[] = [];
    getItemGenerator.mockReturnValue({
      prepare: vi.fn(async () => {
        await new Promise((r) => setTimeout(r, 10));
        order.push('prepare');
      }),
      generate: vi.fn(),
    });
    runGeneration.mockImplementation(() => order.push('generate'));

    await handleGenerateItem(message());

    expect(order).toEqual(['prepare', 'generate']);
    expect(respond).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'ERROR' }));
  });

  it('works for modules without a prepare hook', async () => {
    getItemGenerator.mockReturnValue({ generate: vi.fn() });

    await handleGenerateItem(message());

    expect(runGeneration).toHaveBeenCalledTimes(1);
  });

  it('responds ERROR (keyed to the request) when prepare throws, without generating', async () => {
    getItemGenerator.mockReturnValue({
      prepare: vi.fn(async () => {
        throw new Error('asset failed to decode');
      }),
      generate: vi.fn(),
    });

    await handleGenerateItem(message());

    expect(respond).toHaveBeenCalledWith({
      type: 'ERROR',
      requestId: 'req-1',
      error: 'asset failed to decode',
    });
    expect(runGeneration).not.toHaveBeenCalled();
  });
});
