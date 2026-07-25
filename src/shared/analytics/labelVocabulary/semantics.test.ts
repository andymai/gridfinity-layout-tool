import { describe, it, expect } from 'vitest';
import { conceptDomain, relatedTerms, relatedTermsForQuery, termsInDomain } from './semantics';

describe('conceptDomain', () => {
  it('maps umbrella words to their domain', () => {
    expect(conceptDomain('fasteners')).toBe('fasteners');
    expect(conceptDomain('hardware')).toBe('fasteners');
    expect(conceptDomain('electronics')).toBe('electronics');
  });

  it('is case- and whitespace-insensitive and multilingual', () => {
    expect(conceptDomain('  Werkzeug ')).toBe('tools');
    expect(conceptDomain('herramientas')).toBe('tools');
  });

  it('recognizes both spaced and unspaced 3D-printing concepts', () => {
    expect(conceptDomain('3d printing')).toBe('printing_3d');
    expect(conceptDomain('3dprinting')).toBe('printing_3d');
    expect(conceptDomain('3d print')).toBe('printing_3d');
  });

  it('returns null for a specific item or unknown word', () => {
    expect(conceptDomain('screw')).toBeNull();
    expect(conceptDomain('banana')).toBeNull();
  });
});

describe('relatedTerms / relatedTermsForQuery', () => {
  it('lists related canonical terms', () => {
    expect(relatedTerms('screwdriver')).toContain('screw');
    expect(relatedTerms('wrench')).toContain('bolt');
  });

  it('resolves a free-text query to related terms via its canonical', () => {
    expect(relatedTermsForQuery('screwdriver')).toContain('screw');
    // A non-English alias still resolves (FR "tournevis" → screwdriver).
    expect(relatedTermsForQuery('tournevis')).toContain('screw');
  });

  it('returns nothing for an unrelated query', () => {
    expect(relatedTermsForQuery('banana')).toEqual([]);
  });
});

describe('termsInDomain', () => {
  it('returns catalog terms within a domain only', () => {
    const fasteners = termsInDomain('fasteners');
    expect(fasteners).toContain('screw');
    expect(fasteners).toContain('bolt');
    expect(fasteners).not.toContain('screwdriver');
  });
});
