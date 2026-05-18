import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { jumpToHelpTarget, helpJumpEventName, HELP_TARGET_ATTR } from './helpJumpDispatcher';

function clearBody(): void {
  while (document.body.firstChild) {
    document.body.removeChild(document.body.firstChild);
  }
}

describe('helpJumpDispatcher', () => {
  beforeEach(() => {
    clearBody();
    // jsdom does not implement scrollIntoView; stub it on the prototype.
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds surface event names with the expected prefix', () => {
    expect(helpJumpEventName('sidebar:physical-units')).toBe('help-jump:sidebar:physical-units');
  });

  it('fires the surface-open event before searching for the control', async () => {
    const handler = vi.fn();
    window.addEventListener('help-jump:sidebar:grid-size', handler);

    const button = document.createElement('button');
    button.setAttribute(HELP_TARGET_ATTR, 'half-bin-mode');
    document.body.appendChild(button);

    const ok = await jumpToHelpTarget({
      surface: 'sidebar:grid-size',
      controlId: 'half-bin-mode',
    });

    window.removeEventListener('help-jump:sidebar:grid-size', handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(ok).toBe(true);
  });

  it('focuses a focusable descendant when the marker wraps the control', async () => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute(HELP_TARGET_ATTR, 'print-bed-size');
    const input = document.createElement('input');
    input.type = 'number';
    wrapper.appendChild(input);
    document.body.appendChild(wrapper);

    await jumpToHelpTarget({
      surface: 'sidebar:physical-units',
      controlId: 'print-bed-size',
    });

    expect(document.activeElement).toBe(input);
    expect(wrapper.classList.contains('help-target-pulse')).toBe(true);
  });

  it('focuses the target control and applies the pulse class', async () => {
    const button = document.createElement('button');
    button.setAttribute(HELP_TARGET_ATTR, 'print-bed-size');
    button.scrollIntoView = vi.fn();
    document.body.appendChild(button);

    await jumpToHelpTarget({
      surface: 'sidebar:physical-units',
      controlId: 'print-bed-size',
    });

    expect(document.activeElement).toBe(button);
    expect(button.classList.contains('help-target-pulse')).toBe(true);
    expect(button.scrollIntoView).toHaveBeenCalled();
  });

  it('waits for late-mounted elements via MutationObserver', async () => {
    const surface = helpJumpEventName('sidebar:late');
    window.addEventListener(surface, () => {
      setTimeout(() => {
        const el = document.createElement('div');
        el.setAttribute(HELP_TARGET_ATTR, 'late-mount');
        el.scrollIntoView = vi.fn();
        document.body.appendChild(el);
      }, 5);
    });

    const ok = await jumpToHelpTarget({ surface: 'sidebar:late', controlId: 'late-mount' });
    expect(ok).toBe(true);
    expect(document.querySelector(`[${HELP_TARGET_ATTR}="late-mount"]`)).not.toBeNull();
  });

  it('returns false when the target never appears within timeout', async () => {
    vi.useFakeTimers();
    const promise = jumpToHelpTarget({ surface: 'never', controlId: 'missing' });
    await vi.advanceTimersByTimeAsync(2500);
    const ok = await promise;
    expect(ok).toBe(false);
  });
});
