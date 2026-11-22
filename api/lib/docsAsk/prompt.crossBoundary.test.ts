/**
 * LOCALE_NAMES is hand-kept beside the app's locale list, since api/ cannot
 * import src/ at runtime. A locale missing here falls back to English, so its
 * readers would get English labels and replies.
 */
import { describe, expect, it } from 'vitest';
import { LOCALE_NAMES } from './prompt.js';
import { SUPPORTED_LOCALES } from '@/i18n/types';

describe('LOCALE_NAMES', () => {
  it('has the same locales as the app', () => {
    expect(Object.keys(LOCALE_NAMES).sort()).toEqual(SUPPORTED_LOCALES.map((l) => l.code).sort());
  });
});
