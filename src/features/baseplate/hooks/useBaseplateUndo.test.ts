// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLayoutStore } from '@/core/store/layout';
import { useHistoryStore } from '@/core/cqrs/undo/historyStore';
import { _resetUndoCaptureState } from '@/core/cqrs';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { mm } from '@/core/types';
import type { StoredBaseplateParams } from '@/core/types';
import { resetAllStores } from '@/test/testUtils';
import {
  previewBaseplateParam,
  updateBaseplateParams,
} from '../components/BaseplatePanel/panelState';
import { useBaseplateUndo } from './useBaseplateUndo';

vi.mock('@/shared/analytics/posthog/conversionEvents', () => ({
  trackToolActivated: vi.fn(),
}));

function params(): StoredBaseplateParams {
  return useLayoutStore.getState().layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS;
}

function paddingLeft(): number {
  return params().paddingLeft;
}

function press(target: EventTarget, init: KeyboardEventInit): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function mount<T extends HTMLElement>(element: T): T {
  document.body.appendChild(element);
  return element;
}

function input(type: string): HTMLInputElement {
  const el = document.createElement('input');
  el.type = type;
  return mount(el);
}

beforeEach(() => {
  resetAllStores();
  useHistoryStore.getState().clear();
  _resetUndoCaptureState();
  updateBaseplateParams({ paddingLeft: mm(7) });
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('useBaseplateUndo', () => {
  it('undoes with Ctrl+Z and redoes with Ctrl+Shift+Z and Ctrl+Y', () => {
    renderHook(() => useBaseplateUndo());

    const undoEvent = press(window, { key: 'z', ctrlKey: true });
    expect(undoEvent.defaultPrevented).toBe(true);
    expect(paddingLeft()).toBe(DEFAULT_BASEPLATE_PARAMS.paddingLeft);

    press(window, { key: 'Z', ctrlKey: true, shiftKey: true });
    expect(paddingLeft()).toBe(7);

    press(window, { key: 'z', ctrlKey: true });
    press(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(paddingLeft()).toBe(7);

    press(window, { key: 'z', metaKey: true });
    expect(paddingLeft()).toBe(DEFAULT_BASEPLATE_PARAMS.paddingLeft);

    press(window, { key: 'y', ctrlKey: true });
    expect(paddingLeft()).toBe(7);
  });

  it('undoes while focus stays on a switch, checkbox or slider', () => {
    renderHook(() => useBaseplateUndo());
    const toggle = mount(document.createElement('button'));
    toggle.setAttribute('role', 'switch');

    press(toggle, { key: 'z', ctrlKey: true });
    expect(paddingLeft()).toBe(DEFAULT_BASEPLATE_PARAMS.paddingLeft);

    press(input('checkbox'), { key: 'y', ctrlKey: true });
    expect(paddingLeft()).toBe(7);

    press(input('range'), { key: 'z', ctrlKey: true });
    expect(paddingLeft()).toBe(DEFAULT_BASEPLATE_PARAMS.paddingLeft);
  });

  it('leaves Ctrl+Z to the browser in a field that takes typed text', () => {
    renderHook(() => useBaseplateUndo());

    for (const target of [
      input('number'),
      input('text'),
      mount(document.createElement('textarea')),
    ]) {
      const event = press(target, { key: 'z', ctrlKey: true });
      expect(event.defaultPrevented).toBe(false);
    }
    expect(paddingLeft()).toBe(7);
  });

  it('ignores Ctrl+Alt+Z, which some keyboards send to type a character', () => {
    renderHook(() => useBaseplateUndo());

    press(window, { key: 'z', ctrlKey: true, altKey: true });

    expect(paddingLeft()).toBe(7);
  });

  it('takes back an open slider drag on its own, before older edits', () => {
    const { result } = renderHook(() => useBaseplateUndo());
    const depthBefore = params().magnetDepth;
    previewBaseplateParam('magnetDepth', mm(3));

    act(() => result.current.undo());

    expect(params().magnetDepth).toBe(depthBefore);
    expect(paddingLeft()).toBe(7);
  });

  it('keeps an open drag as its own step when the page closes', () => {
    const { unmount } = renderHook(() => useBaseplateUndo());
    previewBaseplateParam('magnetDepth', mm(3));

    unmount();

    expect(useHistoryStore.getState().past).toHaveLength(2);
    useHistoryStore.getState().undo();
    expect(paddingLeft()).toBe(7);
  });

  it('reports whether there is a step to undo or redo', () => {
    const { result } = renderHook(() => useBaseplateUndo());
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => result.current.undo());

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });
});
