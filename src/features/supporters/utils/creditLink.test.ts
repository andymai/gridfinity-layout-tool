import { describe, expect, it } from 'vitest';
import { creditFromSearch, creditLinkFor } from './creditLink';

describe('credit links', () => {
  it('round-trips a name with spaces and accents', () => {
    const link = creditLinkFor('Chloé Ferreira & co', 'https://example.test');
    expect(link).toBe('https://example.test/supporters?credit=Chlo%C3%A9%20Ferreira%20%26%20co');
    expect(creditFromSearch(new URL(link).search)).toBe('Chloé Ferreira & co');
  });

  it('ignores a missing, blank or overlong name', () => {
    expect(creditFromSearch('')).toBeNull();
    expect(creditFromSearch('?credit=%20%20')).toBeNull();
    expect(creditFromSearch(`?credit=${'x'.repeat(65)}`)).toBeNull();
  });
});
