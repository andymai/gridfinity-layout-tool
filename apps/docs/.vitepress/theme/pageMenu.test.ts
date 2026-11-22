import { describe, expect, it } from 'vitest';
import { pageLinks } from './pageMenu';

describe('pageLinks', () => {
  it('points the chat apps at the public Markdown copy of the page', () => {
    const links = pageLinks('designer/lids.md');
    expect(links.markdown).toBe('https://gridfinitylayouttool.com/docs/designer/lids.md');
    expect(links.localMarkdown).toBe('/docs/designer/lids.md');
    for (const link of [links.claude, links.chatgpt]) {
      const prompt = new URL(link).searchParams.get('q');
      expect(prompt).toContain('https://gridfinitylayouttool.com/docs/designer/lids.md');
    }
    expect(new URL(links.claude).origin + new URL(links.claude).pathname).toBe(
      'https://claude.ai/new'
    );
    expect(new URL(links.chatgpt).searchParams.get('hints')).toBe('search');
  });

  it('keeps the index page and the site base', () => {
    const links = pageLinks('index.md', '/');
    expect(links.markdown).toBe('https://gridfinitylayouttool.com/docs/index.md');
    expect(links.localMarkdown).toBe('/index.md');
  });
});
