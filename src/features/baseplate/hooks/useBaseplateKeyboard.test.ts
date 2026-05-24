import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBaseplateKeyboard } from './useBaseplateKeyboard';

function fireKey(key: string, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: target, configurable: true });
  window.dispatchEvent(event);
  return event;
}

describe('useBaseplateKeyboard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fires onToggleXray for x and X', () => {
    const onToggleXray = vi.fn();
    const onToggleProjection = vi.fn();
    renderHook(() => useBaseplateKeyboard({ onToggleXray, onToggleProjection }));

    fireKey('x');
    fireKey('X');

    expect(onToggleXray).toHaveBeenCalledTimes(2);
    expect(onToggleProjection).not.toHaveBeenCalled();
  });

  it('fires onToggleProjection for p and P', () => {
    const onToggleXray = vi.fn();
    const onToggleProjection = vi.fn();
    renderHook(() => useBaseplateKeyboard({ onToggleXray, onToggleProjection }));

    fireKey('p');
    fireKey('P');

    expect(onToggleProjection).toHaveBeenCalledTimes(2);
    expect(onToggleXray).not.toHaveBeenCalled();
  });

  it('ignores key events when typing in an input', () => {
    const onToggleXray = vi.fn();
    const onToggleProjection = vi.fn();
    renderHook(() => useBaseplateKeyboard({ onToggleXray, onToggleProjection }));

    const input = document.createElement('input');
    document.body.appendChild(input);
    fireKey('x', input);
    fireKey('p', input);

    expect(onToggleXray).not.toHaveBeenCalled();
    expect(onToggleProjection).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('ignores key events when modifier keys are held', () => {
    const onToggleXray = vi.fn();
    const onToggleProjection = vi.fn();
    renderHook(() => useBaseplateKeyboard({ onToggleXray, onToggleProjection }));

    const event = new KeyboardEvent('keydown', { key: 'x', ctrlKey: true });
    window.dispatchEvent(event);

    expect(onToggleXray).not.toHaveBeenCalled();
  });
});
