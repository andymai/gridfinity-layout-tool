/**
 * Key events from form controls. A switch, checkbox or slider keeps focus after
 * a click, so a shortcut handler that skips every input also loses undo there.
 */

// Inputs that take no typed text, so the browser keeps no text undo for them.
const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

/** Focus is in a form control, whose plain keys (arrows, Space) belong to it. */
export function isFormControlTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/** A field that takes typed text, which keeps the browser's own Ctrl+Z. */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLElement && target.isContentEditable;
}
