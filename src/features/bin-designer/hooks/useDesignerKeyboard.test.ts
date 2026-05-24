import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDesignerKeyboard } from './useDesignerKeyboard';

describe('useDesignerKeyboard', () => {
  const onCameraPreset = vi.fn();
  const onResetView = vi.fn();
  const onToggleWireframe = vi.fn();
  const onToggleXray = vi.fn();
  const onToggleProjection = vi.fn();
  const onUndo = vi.fn();
  const onRedo = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function renderKeyboardHook() {
    return renderHook(() =>
      useDesignerKeyboard({
        onCameraPreset,
        onResetView,
        onToggleWireframe,
        onToggleXray,
        onToggleProjection,
        onUndo,
        onRedo,
      })
    );
  }

  function pressKey(key: string, options: Partial<KeyboardEventInit> = {}) {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, ...options });
    window.dispatchEvent(event);
  }

  it('maps key 1 to front preset', () => {
    renderKeyboardHook();
    pressKey('1');
    expect(onCameraPreset).toHaveBeenCalledWith('front');
  });

  it('maps key 2 to side preset', () => {
    renderKeyboardHook();
    pressKey('2');
    expect(onCameraPreset).toHaveBeenCalledWith('side');
  });

  it('maps key 3 to top preset', () => {
    renderKeyboardHook();
    pressKey('3');
    expect(onCameraPreset).toHaveBeenCalledWith('top');
  });

  it('maps key 4 to isometric preset', () => {
    renderKeyboardHook();
    pressKey('4');
    expect(onCameraPreset).toHaveBeenCalledWith('isometric');
  });

  it('maps R key to reset view', () => {
    renderKeyboardHook();
    pressKey('r');
    expect(onResetView).toHaveBeenCalledOnce();
  });

  it('maps uppercase R key to reset view', () => {
    renderKeyboardHook();
    pressKey('R');
    expect(onResetView).toHaveBeenCalledOnce();
  });

  it('maps W key to wireframe toggle', () => {
    renderKeyboardHook();
    pressKey('w');
    expect(onToggleWireframe).toHaveBeenCalledOnce();
  });

  it('maps uppercase W key to wireframe toggle', () => {
    renderKeyboardHook();
    pressKey('W');
    expect(onToggleWireframe).toHaveBeenCalledOnce();
  });

  it('maps X key to xray toggle', () => {
    renderKeyboardHook();
    pressKey('x');
    expect(onToggleXray).toHaveBeenCalledOnce();
  });

  it('maps uppercase X key to xray toggle', () => {
    renderKeyboardHook();
    pressKey('X');
    expect(onToggleXray).toHaveBeenCalledOnce();
  });

  it('maps P key to projection toggle', () => {
    renderKeyboardHook();
    pressKey('p');
    expect(onToggleProjection).toHaveBeenCalledOnce();
  });

  it('maps uppercase P key to projection toggle', () => {
    renderKeyboardHook();
    pressKey('P');
    expect(onToggleProjection).toHaveBeenCalledOnce();
  });

  it('maps Ctrl+Z to undo', () => {
    renderKeyboardHook();
    pressKey('z', { ctrlKey: true });
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('maps Ctrl+Y to redo', () => {
    renderKeyboardHook();
    pressKey('y', { ctrlKey: true });
    expect(onRedo).toHaveBeenCalledOnce();
  });

  it('maps Ctrl+Shift+Z to redo', () => {
    renderKeyboardHook();
    pressKey('z', { ctrlKey: true, shiftKey: true });
    expect(onRedo).toHaveBeenCalledOnce();
  });

  it('maps Meta+Z to undo (macOS)', () => {
    renderKeyboardHook();
    pressKey('z', { metaKey: true });
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('ignores Ctrl+other keys (no undo/redo)', () => {
    renderKeyboardHook();
    pressKey('1', { ctrlKey: true });
    expect(onCameraPreset).not.toHaveBeenCalled();
    expect(onUndo).not.toHaveBeenCalled();
    expect(onRedo).not.toHaveBeenCalled();
  });

  it('ignores Meta+other keys (no undo/redo)', () => {
    renderKeyboardHook();
    pressKey('r', { metaKey: true });
    expect(onResetView).not.toHaveBeenCalled();
  });

  it('ignores keys with Alt modifier', () => {
    renderKeyboardHook();
    pressKey('w', { altKey: true });
    expect(onToggleWireframe).not.toHaveBeenCalled();
  });

  it('ignores keys when target is an input element', () => {
    renderKeyboardHook();

    const input = document.createElement('input');
    document.body.appendChild(input);
    const event = new KeyboardEvent('keydown', { key: '1', bubbles: true });
    Object.defineProperty(event, 'target', { value: input });
    window.dispatchEvent(event);

    expect(onCameraPreset).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('ignores keys when target is a textarea', () => {
    renderKeyboardHook();

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const event = new KeyboardEvent('keydown', { key: 'r', bubbles: true });
    Object.defineProperty(event, 'target', { value: textarea });
    window.dispatchEvent(event);

    expect(onResetView).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('ignores keys when target is contenteditable', () => {
    renderKeyboardHook();

    const div = document.createElement('div');
    div.contentEditable = 'true';
    // jsdom may not compute isContentEditable properly, so set it explicitly
    Object.defineProperty(div, 'isContentEditable', { value: true, configurable: true });
    document.body.appendChild(div);
    const event = new KeyboardEvent('keydown', { key: 'w', bubbles: true });
    Object.defineProperty(event, 'target', { value: div });
    window.dispatchEvent(event);

    expect(onToggleWireframe).not.toHaveBeenCalled();
    document.body.removeChild(div);
  });

  it('ignores unrecognized keys', () => {
    renderKeyboardHook();
    pressKey('x');
    pressKey('5');
    pressKey('Escape');

    expect(onCameraPreset).not.toHaveBeenCalled();
    expect(onResetView).not.toHaveBeenCalled();
    expect(onToggleWireframe).not.toHaveBeenCalled();
  });

  it('removes event listener on unmount', () => {
    const { unmount } = renderKeyboardHook();
    unmount();

    pressKey('1');
    expect(onCameraPreset).not.toHaveBeenCalled();
  });
});
