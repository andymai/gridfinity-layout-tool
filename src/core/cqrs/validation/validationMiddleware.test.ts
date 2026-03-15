/**
 * Tests for validation middleware.
 */

import { describe, it, expect, vi } from 'vitest';
import { isOk, isErr, ok } from '@/core/result';
import { validationMiddleware } from './validationMiddleware';
import { createCommand } from '../commands';
import type { Command } from '../commands';
import type { DomainEvent } from '../events';
import type { NextFn } from '../types';

/** Stub next function that always succeeds */
function createSuccessNext(): NextFn<Command, DomainEvent> {
  return vi.fn(() => ok({ value: undefined, events: [] as ReadonlyArray<DomainEvent> }));
}

describe('validationMiddleware', () => {
  it('passes valid bin.add command to next', () => {
    const next = createSuccessNext();
    const cmd = createCommand('bin.add', {
      layerId: 'layer-1' as never,
      x: 0 as never,
      y: 0 as never,
      width: 2 as never,
      depth: 2 as never,
      height: 3 as never,
      category: 'cat-1' as never,
      label: 'Test' as never,
      notes: '' as never,
    });

    const result = validationMiddleware(cmd, next);

    expect(isOk(result)).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects bin.add with invalid payload', () => {
    const next = createSuccessNext();
    const cmd = createCommand('bin.add', {
      layerId: '' as never, // empty ID
      x: -1 as never, // negative
      y: 0 as never,
      width: 0 as never, // zero width
      depth: 1 as never,
      height: 1 as never, // below MIN_BIN_HEIGHT
      category: 'cat-1' as never,
      label: '' as never,
      notes: '' as never,
    });

    const result = validationMiddleware(cmd, next);

    expect(isErr(result)).toBe(true);
    expect(next).not.toHaveBeenCalled();
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('LAYOUT_INVALID_OPERATION');
  });

  it('includes descriptive error reason on validation failure', () => {
    const next = createSuccessNext();
    const cmd = createCommand('bin.delete', {
      id: '' as never, // empty ID
    });

    const result = validationMiddleware(cmd, next);

    expect(isErr(result)).toBe(true);
    if (result.error.code === 'LAYOUT_INVALID_OPERATION') {
      expect(result.error.reason).toContain('Invalid payload');
    }
  });

  it('passes valid layer.add command (empty payload)', () => {
    const next = createSuccessNext();
    const cmd = createCommand('layer.add', {} as never);

    const result = validationMiddleware(cmd, next);

    expect(isOk(result)).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('passes valid drawer.update command', () => {
    const next = createSuccessNext();
    const cmd = createCommand('drawer.update', {
      width: 10 as never,
      depth: 8 as never,
    });

    const result = validationMiddleware(cmd, next);

    expect(isOk(result)).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects drawer.update with out-of-range width', () => {
    const next = createSuccessNext();
    const cmd = createCommand('drawer.update', {
      width: 100 as never, // exceeds GRID_MAX
    });

    const result = validationMiddleware(cmd, next);

    expect(isErr(result)).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes valid layout.setName command', () => {
    const next = createSuccessNext();
    const cmd = createCommand('layout.setName', { name: 'My Layout' });

    const result = validationMiddleware(cmd, next);

    expect(isOk(result)).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects layout.setName with empty name', () => {
    const next = createSuccessNext();
    const cmd = createCommand('layout.setName', { name: '' });

    const result = validationMiddleware(cmd, next);

    expect(isErr(result)).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes valid category.add command', () => {
    const next = createSuccessNext();
    const cmd = createCommand('category.add', {
      name: 'Tools' as never,
      color: '#ff0000' as never,
    });

    const result = validationMiddleware(cmd, next);

    expect(isOk(result)).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('passes valid layer.reorder command', () => {
    const next = createSuccessNext();
    const cmd = createCommand('layer.reorder', { fromIndex: 0, toIndex: 2 });

    const result = validationMiddleware(cmd, next);

    expect(isOk(result)).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects layer.reorder with negative index', () => {
    const next = createSuccessNext();
    const cmd = createCommand('layer.reorder', { fromIndex: -1, toIndex: 0 });

    const result = validationMiddleware(cmd, next);

    expect(isErr(result)).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through unregistered command types', () => {
    const next = createSuccessNext();
    // Simulate an unknown command type
    const cmd = {
      type: 'unknown.future' as never,
      payload: { anything: true },
      meta: createCommand('bin.delete', { id: 'x' as never }).meta,
    } as unknown as Command;

    const result = validationMiddleware(cmd, next);

    expect(isOk(result)).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('passes valid bin.fillLayer command', () => {
    const next = createSuccessNext();
    const cmd = createCommand('bin.fillLayer', {
      layerId: 'layer-1' as never,
      width: 1,
      depth: 1,
      categoryId: 'cat-1' as never,
    });

    const result = validationMiddleware(cmd, next);

    expect(isOk(result)).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('passes valid layout.setBaseplateParams command', () => {
    const next = createSuccessNext();
    const cmd = createCommand('layout.setBaseplateParams', {
      params: {
        magnetHoles: false,
        magnetDiameter: 6.5 as never,
        magnetDepth: 2 as never,
        paddingLeft: 0 as never,
        paddingRight: 0 as never,
        paddingFront: 0 as never,
        paddingBack: 0 as never,
      },
    });

    const result = validationMiddleware(cmd, next);

    expect(isOk(result)).toBe(true);
    expect(next).toHaveBeenCalledOnce();
  });

  it('error result has the command type as operation name', () => {
    const next = createSuccessNext();
    const cmd = createCommand('bin.delete', { id: '' as never });

    const result = validationMiddleware(cmd, next);

    expect(isErr(result)).toBe(true);
    if (result.error.code === 'LAYOUT_INVALID_OPERATION') {
      expect(result.error.operation).toBe('bin.delete');
    }
  });
});
