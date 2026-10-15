import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from './contentFrontmatter';
import { resolvePageLastmod } from './contentLastmod';

const FALLBACK = '2026-10-15';

function lastmodOf(value: string): unknown {
  return parseFrontmatter(`---\ntitle: Page\nlastmod: ${value}\n---\nBody\n`).data.lastmod;
}

describe('parseFrontmatter', () => {
  it('keeps an unquoted lastmod date as the string the author wrote', () => {
    expect(lastmodOf('2026-08-09')).toBe('2026-08-09');
    expect(resolvePageLastmod(lastmodOf('2026-08-09'), FALLBACK).own).toBe('2026-08-09');
  });

  it('passes an impossible unquoted date through for validation to reject', () => {
    expect(lastmodOf('2026-02-30')).toBe('2026-02-30');
    expect(resolvePageLastmod(lastmodOf('2026-02-30'), FALLBACK).invalid).toBe(true);
  });

  it('returns the body after the closing fence', () => {
    expect(parseFrontmatter('---\ntitle: Page\n---\nBody\n')).toEqual({
      data: { title: 'Page' },
      content: 'Body\n',
    });
  });

  it('treats a file without frontmatter as all body', () => {
    expect(parseFrontmatter('Body\n')).toEqual({ data: {}, content: 'Body\n' });
  });

  it('rejects frontmatter that is not a mapping', () => {
    expect(() => parseFrontmatter('---\n- a\n- b\n---\nBody\n')).toThrow('YAML mapping');
  });
});
