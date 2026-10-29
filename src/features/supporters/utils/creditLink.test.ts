import { describe, expect, it } from 'vitest';
import { creditFromSearch, creditLinkFor, isCreditFor } from './creditLink';

describe('credit links', () => {
  it('round-trips a name with spaces and accents', () => {
    const link = creditLinkFor('Chloé Ferreira & co', 'https://example.test');
    expect(link).toBe('https://example.test/supporters?credit=Chlo%C3%A9%20Ferreira%20%26%20co');
    expect(creditFromSearch(new URL(link).search)).toBe('Chloé Ferreira & co');
  });

  it('survives a stored name that ends in half an emoji, and still finds it', () => {
    const broken = 'Sam \uD83D';
    const link = creditLinkFor(broken, 'https://example.test');
    const linked = creditFromSearch(new URL(link).search) ?? '';
    expect(isCreditFor(linked, broken)).toBe(true);
    expect(isCreditFor(linked, 'Sam')).toBe(false);
  });

  it('matches whole names only, ignoring case', () => {
    expect(isCreditFor('grace', 'Grace')).toBe(true);
    expect(isCreditFor('Gra', 'Grace')).toBe(false);
  });

  it('ignores a missing, blank or overlong name', () => {
    expect(creditFromSearch('')).toBeNull();
    expect(creditFromSearch('?credit=%20%20')).toBeNull();
    expect(creditFromSearch(`?credit=${'x'.repeat(65)}`)).toBeNull();
  });
});
