import { describe, it, expect } from 'vitest';
import { isWasmTrap } from './wasmTrap';

describe('isWasmTrap', () => {
  it('recognises a WebAssembly.RuntimeError instance', () => {
    expect(isWasmTrap(new WebAssembly.RuntimeError('table index is out of bounds'))).toBe(true);
  });

  it.each([
    'table index is out of bounds',
    'memory access out of bounds',
    'RuntimeError: memory access out of bounds',
    'Out of bounds memory access',
    'index out of bounds',
    'null function or function signature mismatch',
    'indirect call to null',
    'unreachable',
    'unreachable executed',
  ])('recognises the trap text %j on a plain Error', (message) => {
    expect(isWasmTrap(new Error(message))).toBe(true);
  });

  it('follows the cause chain a kernel wrapper adds around the trap', () => {
    const trap = new WebAssembly.RuntimeError('table index is out of bounds');
    const wrapped = new Error('[KERNEL_OPERATION] CUT_FAILED: cut failed', { cause: trap });
    const outer = new Error('Combined export failed', { cause: wrapped });
    expect(isWasmTrap(outer)).toBe(true);
  });

  it('does not classify ordinary kernel failures as traps', () => {
    expect(isWasmTrap(new Error('BRep boolean operation failed'))).toBe(false);
    expect(isWasmTrap(new Error('Invalid param: width <= 0'))).toBe(false);
    expect(isWasmTrap(new Error('Export timed out'))).toBe(false);
    expect(isWasmTrap(new Error('value out of range'))).toBe(false);
    expect(isWasmTrap(new Error('unreachable branch in planner'))).toBe(false);
    expect(isWasmTrap(null)).toBe(false);
    expect(isWasmTrap(undefined)).toBe(false);
  });

  it('inspects non-Error throwables by their text', () => {
    expect(isWasmTrap('memory access out of bounds')).toBe(true);
    expect(isWasmTrap(42)).toBe(false);
  });
});
