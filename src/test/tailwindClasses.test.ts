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
    expect(await findClassesWithoutCss(['animate-settle-in', 'btn'])).toEqual([]);
  });

  it('passes plain classes from a stylesheet that a component imports', async () => {
    expect(await findClassesWithoutCss(['no-print', 'print-portal'])).toEqual([]);
  });

  it('passes the theme animations and the elevated shadow, with variants', async () => {
    expect(
      await findClassesWithoutCss([
        'motion-safe:animate-fade-in',
        'animate-fade-in-up',
        'animate-slide-down',
        'max-md:animate-slide-up',
        'shadow-elevated',
      ])
    ).toEqual([]);
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
    expect(await findClassesWithoutCss(['motion-safe:animate-settle-in'])).toEqual([
      'motion-safe:animate-settle-in',
    ]);
  });

  it('reports each missing class once', async () => {
    expect(await findClassesWithoutCss(['bg-primary', 'bg-primary'])).toEqual(['bg-primary']);
  });

  it('returns nothing for no classes', async () => {
    expect(await findClassesWithoutCss([])).toEqual([]);
  });
});
