// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { isOk } from '@/core/result';
import { buildDrawerLinkLayout, parseDrawerLink } from '@/shared/utils/drawerLink';
import { createTestLayout } from '@/test/testUtils';

const source = readFileSync(resolve(import.meta.dirname, '../public/calculator.js'), 'utf8');

function mount(): void {
  document.body.innerHTML = `
    <input id="calc-width"><input id="calc-depth"><input id="calc-height">
    <span id="calc-grid"></span><span id="calc-half"></span><span id="calc-gap"></span>
    <span id="calc-height-units"></span>
    <a id="planner" href="/" data-drawer-link="planner"></a>
    <a id="baseplate" href="/baseplate" data-drawer-link="baseplate"></a>`;
  new Function(source)();
}

function enter(width: string, depth: string, height = ''): void {
  const values: Record<string, string> = {
    'calc-width': width,
    'calc-depth': depth,
    'calc-height': height,
  };
  for (const [id, value] of Object.entries(values)) {
    const input = document.getElementById(id) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }
}

const href = (id: string): string | null =>
  document.getElementById(id)?.getAttribute('href') ?? null;

describe('calculator drawer links', () => {
  beforeEach(mount);

  it('opens the plain tools before any size is entered', () => {
    expect(href('planner')).toBe('/');
    expect(href('baseplate')).toBe('/baseplate');
  });

  it('carries the typed drawer into both links', () => {
    enter('297', '525', '60');
    expect(href('planner')).toBe('/?drawer=297x525x60');
    expect(href('baseplate')).toBe('/baseplate?drawer=297x525x60');
  });

  it('leaves the height off when none is entered', () => {
    enter('297.5', '525');
    expect(href('planner')).toBe('/?drawer=297.5x525');
  });

  it.each(['0.5', '6000'])('leaves off a height of %s mm, which the app would reject', (height) => {
    enter('297', '525', height);
    expect(href('planner')).toBe('/?drawer=297x525');
  });

  it.each([
    ['41', '525'],
    ['297', '2101'],
    ['', '525'],
  ])('falls back to the plain tools for %s × %s mm', (width, depth) => {
    enter('297', '525');
    enter(width, depth);
    expect(href('planner')).toBe('/');
    expect(href('baseplate')).toBe('/baseplate');
  });

  it.each([
    ['42', '42', ''],
    ['2100', '2100', '400'],
    ['297.5', '525.25', '61.5'],
  ])('produces a link the app opens (%s × %s × %s)', (width, depth, height) => {
    enter(width, depth, height);
    const link = href('planner') ?? '';
    const parsed = parseDrawerLink(link.slice(link.indexOf('?')));
    expect(parsed !== null && isOk(parsed)).toBe(true);
    if (parsed === null || !isOk(parsed)) return;
    expect(isOk(buildDrawerLinkLayout(createTestLayout(), parsed.value, 'Drawer'))).toBe(true);
  });
});
