import { describe, it, expect, vi } from 'vitest';
import { runPipeline } from './runner';
import type { PipelineContext, PipelineStage } from './types';

function createMockContext(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    params: {} as PipelineContext['params'],
    dimensions: {} as PipelineContext['dimensions'],
    forExport: false,
    solid: null,
    originToTag: new Map(),
    fuseTargets: [],
    cutTargets: [],
    mesh: null,
    ...overrides,
  };
}

function createMockStage(overrides?: Partial<PipelineStage>): PipelineStage {
  return {
    name: 'test',
    progressValue: 0.5,
    shouldRun: () => true,
    execute: (ctx) => ctx,
    ...overrides,
  };
}

describe('runPipeline', () => {
  it('returns initial context when no stages', () => {
    const ctx = createMockContext();
    const result = runPipeline([], ctx);
    expect(result).toBe(ctx);
  });

  it('executes stages in order', () => {
    const order: string[] = [];
    const stage1 = createMockStage({
      name: 'first',
      execute: (ctx) => {
        order.push('first');
        return ctx;
      },
    });
    const stage2 = createMockStage({
      name: 'second',
      execute: (ctx) => {
        order.push('second');
        return ctx;
      },
    });

    runPipeline([stage1, stage2], createMockContext());
    expect(order).toEqual(['first', 'second']);
  });

  it('skips stages where shouldRun returns false', () => {
    const executed: string[] = [];
    const skipStage = createMockStage({
      name: 'skip',
      shouldRun: () => false,
      execute: (ctx) => {
        executed.push('skip');
        return ctx;
      },
    });
    const runStage = createMockStage({
      name: 'run',
      execute: (ctx) => {
        executed.push('run');
        return ctx;
      },
    });

    runPipeline([skipStage, runStage], createMockContext());
    expect(executed).toEqual(['run']);
  });

  it('threads context through stages', () => {
    const stage = createMockStage({
      execute: (ctx) => ({ ...ctx, forExport: true }),
    });

    const result = runPipeline([stage], createMockContext({ forExport: false }));
    expect(result.forExport).toBe(true);
  });

  it('calls onProgress with stage name and value', () => {
    const onProgress = vi.fn();
    const stage = createMockStage({ name: 'testStage', progressValue: 0.42 });

    runPipeline([stage], createMockContext({ onProgress }));
    expect(onProgress).toHaveBeenCalledWith('testStage', 0.42);
  });
});
