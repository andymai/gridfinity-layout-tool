import { describe, expect, it } from 'vitest';
import { DOCS_NAVIGATION, LLMS_NAVIGATION, ROOT_LLMS_FILES } from './contentRoutes';

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

describe('LLMS_NAVIGATION', () => {
  it('matches each root llms file, with a query or a hash', () => {
    for (const file of ROOT_LLMS_FILES)
      for (const url of [`/${file}`, `/${file}?x=1`, `/${file}#top`])
        expect(LLMS_NAVIGATION.test(url), url).toBe(true);
  });

  it('leaves other paths alone', () => {
    for (const url of ['/', '/llms', '/llms.txtx', '/llms-other.txt', '/docs/llms.txt'])
      expect(LLMS_NAVIGATION.test(url), url).toBe(false);
  });
});
