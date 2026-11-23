// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { isFormControlTarget, isTextEntryTarget } from './formControlTarget';

function input(type: string): HTMLInputElement {
  const el = document.createElement('input');
  el.type = type;
  return el;
}

describe('formControlTarget', () => {
  // jsdom leaves isContentEditable undefined, so a no is falsy rather than false.
  it('counts switches, sliders and text fields as form controls, and buttons as not', () => {
    expect(isFormControlTarget(input('checkbox'))).toBe(true);
    expect(isFormControlTarget(input('range'))).toBe(true);
    expect(isFormControlTarget(document.createElement('textarea'))).toBe(true);
    expect(isFormControlTarget(document.createElement('button'))).toBeFalsy();
    expect(isFormControlTarget(window)).toBeFalsy();
  });

  it('keeps text undo only for fields that take typed text', () => {
    expect(isTextEntryTarget(input('text'))).toBe(true);
    expect(isTextEntryTarget(input('number'))).toBe(true);
    expect(isTextEntryTarget(document.createElement('textarea'))).toBe(true);
    expect(isTextEntryTarget(document.createElement('select'))).toBe(true);
    expect(isTextEntryTarget(input('checkbox'))).toBeFalsy();
    expect(isTextEntryTarget(input('range'))).toBeFalsy();
    expect(isTextEntryTarget(document.createElement('button'))).toBeFalsy();
  });

  it('treats an editable element as text entry', () => {
    const div = document.createElement('div');
    // jsdom does not compute isContentEditable from the attribute.
    Object.defineProperty(div, 'isContentEditable', { value: true });
    expect(isTextEntryTarget(div)).toBe(true);
    expect(isFormControlTarget(div)).toBe(true);
  });
});
