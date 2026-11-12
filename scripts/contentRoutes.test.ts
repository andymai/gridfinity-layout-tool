import { describe, expect, it } from 'vitest';
import { DOCS_NAVIGATION } from './contentRoutes';

describe('DOCS_NAVIGATION', () => {
  it('matches every docs navigation, with a query or a hash', () => {
    for (const url of [
      '/docs',
      '/docs/',
      '/docs/introduction/gridfinity-basics',
      '/docs?utm_source=help',
      '/docs#top',
    ])
      expect(DOCS_NAVIGATION.test(url), url).toBe(true);
  });

  it('leaves other app routes alone', () => {
    for (const url of ['/', '/designer', '/docsx', '/documents', '/s/docs'])
      expect(DOCS_NAVIGATION.test(url), url).toBe(false);
  });
});
