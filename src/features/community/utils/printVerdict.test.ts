import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en';
import { COMMUNITY_PRINT_FIT_VERDICTS } from '@/shared/types/communityPrint';
import { PRINT_VERDICT_LABEL_KEYS, PRINT_VERDICT_TONES } from './printVerdict';

describe('print verdict vocabulary', () => {
  it('covers every verdict the type allows', () => {
    for (const verdict of COMMUNITY_PRINT_FIT_VERDICTS) {
      expect(PRINT_VERDICT_LABEL_KEYS[verdict]).toBeDefined();
      expect(PRINT_VERDICT_TONES[verdict]).toBeDefined();
    }
  });

  it('points at label keys that actually resolve', () => {
    // A typo here renders the raw key to the user rather than failing loudly,
    // and the print card and the lightbox both read these maps.
    for (const key of Object.values(PRINT_VERDICT_LABEL_KEYS)) {
      expect(en).toHaveProperty(key);
    }
  });

  it('escalates tone with the severity of the verdict', () => {
    expect(PRINT_VERDICT_TONES['as-designed']).toBe('success');
    expect(PRINT_VERDICT_TONES.adjusted).toBe('warning');
    expect(PRINT_VERDICT_TONES['did-not-fit']).toBe('error');
  });
});
