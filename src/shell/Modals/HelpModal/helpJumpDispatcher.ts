/**
 * Routes a help-entry deep-link to the right surface, awaits the destination
 * DOM node, then focuses + pulses it.
 *
 * Each surface (Sidebar, SettingsModal, BinDesigner, ...) listens for
 * `help-jump:<surface>` window events and handles its own "open + expand
 * sections" logic. This module just fires the event and watches the DOM —
 * it does not import feature stores, keeping coupling unidirectional.
 */

import type { HelpTarget } from './helpEntry';

const PULSE_CLASS = 'help-target-pulse';
const PULSE_DURATION_MS = 1500;
const DEFAULT_TIMEOUT_MS = 2000;

export const HELP_JUMP_EVENT_PREFIX = 'help-jump:';
export const HELP_TARGET_ATTR = 'data-help-target';

export interface HelpJumpEventDetail {
  controlId: string;
}

function helpJumpEvent(surface: string, detail: HelpJumpEventDetail): CustomEvent {
  return new CustomEvent(`${HELP_JUMP_EVENT_PREFIX}${surface}`, { detail });
}

const FOCUSABLE_SELECTOR =
  'button, input, select, textarea, a[href], [role="button"], [tabindex]:not([tabindex="-1"])';

function findFocusTarget(el: HTMLElement): HTMLElement {
  // The marker often wraps the control (e.g., a div around <PrintBedInput>),
  // so look inside before walking outward.
  const descendant = el.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
  if (descendant) return descendant;

  // Fall back to el itself when the marker IS the control (e.g., a tabIndex=0
  // div with role=checkbox), then walk up if neither matches.
  let cursor: HTMLElement | null = el;
  while (cursor) {
    if (cursor.matches(FOCUSABLE_SELECTOR)) return cursor;
    cursor = cursor.parentElement;
  }
  return el;
}

function waitForElement(
  selector: string,
  { timeoutMs = DEFAULT_TIMEOUT_MS }: { timeoutMs?: number } = {}
): Promise<HTMLElement | null> {
  const existing = document.querySelector<HTMLElement>(selector);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      const found = document.querySelector<HTMLElement>(selector);
      if (found) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const timer = window.setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

/**
 * Dispatches the surface-open event, awaits the destination control, then
 * scrolls + focuses + applies a transient pulse class. Idempotent: opening an
 * already-open surface is a no-op at the surface handler level.
 */
export async function jumpToHelpTarget(target: HelpTarget): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  window.dispatchEvent(helpJumpEvent(target.surface, { controlId: target.controlId }));

  const selector = `[${HELP_TARGET_ATTR}="${CSS.escape(target.controlId)}"]`;
  const element = await waitForElement(selector);
  if (!element) return false;

  element.scrollIntoView({ block: 'center', behavior: 'smooth' });

  const focusTarget = findFocusTarget(element);
  focusTarget.focus({ preventScroll: true });

  element.classList.remove(PULSE_CLASS);
  // Force reflow so the animation re-triggers on rapid successive jumps.
  void element.offsetWidth;
  element.classList.add(PULSE_CLASS);
  window.setTimeout(() => element.classList.remove(PULSE_CLASS), PULSE_DURATION_MS);

  return true;
}

export function helpJumpEventName(surface: string): string {
  return `${HELP_JUMP_EVENT_PREFIX}${surface}`;
}
