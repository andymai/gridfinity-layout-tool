/**
 * Predicates and input tracking that let the PWA update flow tell whether the
 * user is actively working, so a reload never interrupts them. Paired with
 * usePWAUpdate; the store-backed checks (interaction, staging, sync) live in the
 * hook, while the DOM/timing checks that don't need store access live here.
 */

let lastInputAt = 0;
let trackerCount = 0;
let detach: (() => void) | null = null;

/**
 * Events that mark the user as present. `pointermove` is included on purpose:
 * a moving cursor (reading, hovering, deciding) is active use we shouldn't
 * reload through, and a resting cursor still ages out after the debounce.
 */
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const;

function handleActivity(): void {
  lastInputAt = Date.now();
}

/**
 * Start tracking user input timestamps. Ref-counted so multiple callers share a
 * single set of listeners; the returned cleanup detaches them when the last
 * caller stops.
 */
export function startActivityTracking(): () => void {
  trackerCount += 1;
  if (!detach) {
    for (const evt of ACTIVITY_EVENTS) {
      window.addEventListener(evt, handleActivity, { passive: true });
    }
    detach = () => {
      for (const evt of ACTIVITY_EVENTS) {
        window.removeEventListener(evt, handleActivity);
      }
    };
  }

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    trackerCount -= 1;
    if (trackerCount <= 0) {
      trackerCount = 0;
      detach?.();
      detach = null;
    }
  };
}

/** True if the user produced input within `windowMs`. */
export function isRecentlyActive(windowMs: number, now: number = Date.now()): boolean {
  return lastInputAt !== 0 && now - lastInputAt < windowMs;
}

/** Reset the input clock and tear down any listeners. Test-only. */
export function resetActivityClock(): void {
  lastInputAt = 0;
  detach?.();
  detach = null;
  trackerCount = 0;
}

/** Input types that don't hold typed text, so focus on them shouldn't block a reload. */
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/**
 * True when focus is in a text-editable element (label/notes field, etc.).
 * Reloading mid-edit would discard whatever the user is typing.
 *
 * Scoped to genuine text entry: a focused checkbox/radio/range/button or a
 * <select> must not count, since focus is sticky (it survives going idle) and
 * would otherwise permanently block the long-idle auto-apply.
 */
export function isEditableElementFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    return !NON_TEXT_INPUT_TYPES.has((el as HTMLInputElement).type);
  }
  if (el.isContentEditable) return true;
  // Attribute fallback: `isContentEditable` (which also resolves inherited
  // editability) isn't implemented in every environment.
  const editable = el.getAttribute('contenteditable');
  return editable === '' || editable === 'true';
}

/**
 * True when a modal dialog is open. The design-system Dialog renders with
 * `role="dialog" aria-modal="true"` via a portal, so this one query covers
 * every modal without enumerating the scattered per-feature open-state flags.
 */
export function isModalOpen(): boolean {
  return document.querySelector('[role="dialog"][aria-modal="true"]') !== null;
}
