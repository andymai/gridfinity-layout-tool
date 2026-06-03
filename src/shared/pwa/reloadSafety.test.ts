// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  startActivityTracking,
  isRecentlyActive,
  resetActivityClock,
  isEditableElementFocused,
  isModalOpen,
} from './reloadSafety';

describe('reloadSafety', () => {
  beforeEach(() => {
    resetActivityClock();
    document.body.replaceChildren();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  describe('isRecentlyActive', () => {
    it('is false before any input', () => {
      expect(isRecentlyActive(30_000)).toBe(false);
    });

    it('is true immediately after input and false once the window elapses', () => {
      vi.useFakeTimers();
      const stop = startActivityTracking();

      window.dispatchEvent(new Event('keydown'));
      expect(isRecentlyActive(30_000)).toBe(true);

      vi.advanceTimersByTime(30_001);
      expect(isRecentlyActive(30_000)).toBe(false);

      stop();
    });

    it('stops updating after the tracker is detached', () => {
      vi.useFakeTimers();
      const stop = startActivityTracking();
      stop();

      window.dispatchEvent(new Event('keydown'));
      expect(isRecentlyActive(30_000)).toBe(false);
    });

    it('keeps tracking while any caller is still active (ref-counted)', () => {
      const stopA = startActivityTracking();
      const stopB = startActivityTracking();
      stopA();

      window.dispatchEvent(new Event('pointerdown'));
      expect(isRecentlyActive(30_000)).toBe(true);

      stopB();
    });
  });

  describe('isEditableElementFocused', () => {
    it('detects a focused input', () => {
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      expect(isEditableElementFocused()).toBe(true);
    });

    it('detects a focused textarea', () => {
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();
      expect(isEditableElementFocused()).toBe(true);
    });

    it('detects a focused numeric input', () => {
      const input = document.createElement('input');
      input.type = 'number';
      document.body.appendChild(input);
      input.focus();
      expect(isEditableElementFocused()).toBe(true);
    });

    it('ignores a focused non-text input (checkbox)', () => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      document.body.appendChild(checkbox);
      checkbox.focus();
      expect(isEditableElementFocused()).toBe(false);
    });

    it('ignores a focused select', () => {
      const select = document.createElement('select');
      document.body.appendChild(select);
      select.focus();
      expect(isEditableElementFocused()).toBe(false);
    });

    it('detects a contenteditable element', () => {
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      // jsdom only focuses elements that are natively focusable or tabbable.
      div.tabIndex = 0;
      document.body.appendChild(div);
      div.focus();
      expect(isEditableElementFocused()).toBe(true);
    });

    it('is false for a non-editable focused element', () => {
      const button = document.createElement('button');
      document.body.appendChild(button);
      button.focus();
      expect(isEditableElementFocused()).toBe(false);
    });
  });

  describe('isModalOpen', () => {
    it('is false with no dialog present', () => {
      expect(isModalOpen()).toBe(false);
    });

    it('is true when an aria-modal dialog is present', () => {
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      document.body.appendChild(dialog);
      expect(isModalOpen()).toBe(true);
    });

    it('ignores a non-modal dialog', () => {
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      document.body.appendChild(dialog);
      expect(isModalOpen()).toBe(false);
    });
  });
});
