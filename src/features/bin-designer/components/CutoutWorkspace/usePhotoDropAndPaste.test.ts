import { describe, it, expect, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DragEvent } from 'react';
import { usePhotoDropAndPaste } from './usePhotoDropAndPaste';

const photo = new File(['x'], 'tools.png', { type: 'image/png' });
const outline = new File(['<svg/>'], 'outline.svg', { type: 'image/svg+xml' });

function paste(files: File[], target: EventTarget = document.body): ClipboardEvent {
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', { value: { files } });
  Object.defineProperty(event, 'target', { value: target });
  window.dispatchEvent(event);
  return event;
}

function drag(files: File[]): DragEvent<HTMLElement> {
  return {
    preventDefault: vi.fn(),
    dataTransfer: {
      files,
      types: files.length > 0 ? ['Files'] : [],
      items: files.map((f) => ({ kind: 'file', type: f.type })),
      dropEffect: 'none',
    },
    currentTarget: { contains: () => false },
    relatedTarget: null,
  } as unknown as DragEvent<HTMLElement>;
}

describe('usePhotoDropAndPaste', () => {
  it('hands on a pasted photo, but not a paste into a text field', () => {
    const onPhoto = vi.fn();
    renderHook(() => usePhotoDropAndPaste(true, onPhoto));

    const event = paste([photo]);
    expect(onPhoto).toHaveBeenCalledWith(photo, 'paste');
    expect(event.defaultPrevented).toBe(true);

    const input = document.createElement('input');
    const intoField = paste([photo], input);
    expect(onPhoto).toHaveBeenCalledOnce();
    expect(intoField.defaultPrevented).toBe(false);
  });

  it('leaves a paste made inside another dialog to that dialog', () => {
    const onPhoto = vi.fn();
    renderHook(() => usePhotoDropAndPaste(true, onPhoto));
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    const button = document.createElement('button');
    dialog.appendChild(button);
    document.body.appendChild(dialog);

    paste([photo], button);
    expect(onPhoto).not.toHaveBeenCalled();
    dialog.remove();
  });

  it('ignores a paste while the board sits in an inert subtree', () => {
    const onPhoto = vi.fn();
    const locked = document.createElement('div');
    locked.setAttribute('inert', '');
    const board = document.createElement('div');
    locked.appendChild(board);
    document.body.appendChild(locked);
    renderHook(() => usePhotoDropAndPaste(true, onPhoto, { current: board }));

    paste([photo]);
    expect(onPhoto).not.toHaveBeenCalled();
    locked.remove();
  });

  it('ignores pastes and drops while switched off', () => {
    const onPhoto = vi.fn();
    const { result } = renderHook(() => usePhotoDropAndPaste(false, onPhoto));
    paste([photo]);
    result.current.dropHandlers.onDrop(drag([photo]));
    expect(onPhoto).not.toHaveBeenCalled();
  });

  it('shows the drop target for a photo and hands it on when dropped', () => {
    const onPhoto = vi.fn();
    const { result } = renderHook(() => usePhotoDropAndPaste(true, onPhoto));

    act(() => result.current.dropHandlers.onDragOver(drag([photo])));
    expect(result.current.dragging).toBe(true);

    act(() => result.current.dropHandlers.onDrop(drag([photo])));
    expect(result.current.dragging).toBe(false);
    expect(onPhoto).toHaveBeenCalledWith(photo, 'drop');
  });

  it('refuses an SVG outline without handing it on or letting the browser open it', () => {
    const onPhoto = vi.fn();
    const { result } = renderHook(() => usePhotoDropAndPaste(true, onPhoto));
    act(() => result.current.dropHandlers.onDragOver(drag([outline])));
    expect(result.current.dragging).toBe(false);
    const dropped = drag([outline]);
    act(() => result.current.dropHandlers.onDrop(dropped));
    expect(onPhoto).not.toHaveBeenCalled();
    expect(dropped.preventDefault).toHaveBeenCalled();
  });
});
