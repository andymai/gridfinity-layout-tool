import { describe, it, expect } from 'vitest';
import { findClassesWithoutCss } from './tailwindClasses';

describe('findClassesWithoutCss', () => {
  it('passes utilities that the Tailwind theme defines', async () => {
    expect(
      await findClassesWithoutCss([
        'bg-accent',
        'text-on-accent',
        'bg-on-accent/15',
        'hover:bg-surface-hover',
        'w-[42px]',
        'hairline',
      ])
    ).toEqual([]);
  });

  it('passes plain classes that the app stylesheet defines', async () => {
    expect(await findClassesWithoutCss(['animate-fade-in', 'btn'])).toEqual([]);
  });

  it('passes the group and peer markers', async () => {
    expect(await findClassesWithoutCss(['group', 'group/row', 'peer'])).toEqual([]);
  });

  it('reports a color utility whose token is not in the theme', async () => {
    expect(
      await findClassesWithoutCss(['bg-accent', 'bg-primary', 'text-content-primary'])
    ).toEqual(['bg-primary', 'text-content-primary']);
  });

  it('reports a variant on a plain class, which Tailwind cannot generate', async () => {
    expect(await findClassesWithoutCss(['motion-safe:animate-fade-in'])).toEqual([
      'motion-safe:animate-fade-in',
    ]);
  });

  it('reports each missing class once', async () => {
    expect(await findClassesWithoutCss(['bg-primary', 'bg-primary'])).toEqual(['bg-primary']);
  });

  it('returns nothing for no classes', async () => {
    expect(await findClassesWithoutCss([])).toEqual([]);
  });
});
