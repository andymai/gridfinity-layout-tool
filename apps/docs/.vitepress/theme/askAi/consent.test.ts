import { describe, expect, it } from 'vitest';
import { readerSettings } from './consent';

const stored = (value: unknown): Pick<Storage, 'getItem'> => ({
  getItem: () => (value === undefined ? null : JSON.stringify(value)),
});

describe('readerSettings', () => {
  it('follows the switch that the reader set in the app', () => {
    expect(readerSettings(stored({ analyticsEnabled: false }), () => false).analytics).toBe(false);
    expect(readerSettings(stored({ analyticsEnabled: true }), () => true).analytics).toBe(true);
  });

  it('without a stored switch, turns analytics off for a GPC or DNT signal', () => {
    expect(readerSettings(stored(undefined), () => true).analytics).toBe(false);
    expect(readerSettings(stored({}), () => false).analytics).toBe(true);
    expect(readerSettings(null, () => true).analytics).toBe(false);
  });

  it('takes the app language, or the browser one for auto', () => {
    expect(
      readerSettings(
        stored({ locale: 'de' }),
        () => false,
        () => 'fr'
      ).locale
    ).toBe('de');
    expect(
      readerSettings(
        stored({ locale: 'auto' }),
        () => false,
        () => 'fr'
      ).locale
    ).toBe('fr');
  });

  it('survives a broken settings entry', () => {
    const broken = { getItem: () => '{oops' };
    expect(
      readerSettings(
        broken,
        () => false,
        () => 'en'
      )
    ).toEqual({ analytics: true, locale: 'en' });
  });
});
