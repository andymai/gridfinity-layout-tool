import { describe, it, expect } from 'vitest';
import { COMMUNITY_CATEGORIES } from '@/shared/types/community';
import en from '@/i18n/locales/en';
import { CATEGORY_LABEL_KEYS } from './categoryLabels';

describe('CATEGORY_LABEL_KEYS', () => {
  it('maps every category to an existing en.ts key', () => {
    for (const category of COMMUNITY_CATEGORIES) {
      const key = CATEGORY_LABEL_KEYS[category];
      expect(key, category).toBeTruthy();
      expect(en[key], key).toBeTruthy();
    }
  });
});
