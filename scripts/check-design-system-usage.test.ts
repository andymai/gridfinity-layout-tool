import { describe, it, expect } from 'vitest';
import { findViolations, shouldExclude } from './check-design-system-usage';
import type { Violation } from './check-design-system-usage';

function find(source: string): Violation[] {
  return findViolations('src/features/x/X.tsx', source);
}

describe('findViolations', () => {
  describe('the multi-line blind spot this checker was rewritten for', () => {
    it('catches a checkbox whose tag and type land on different lines', () => {
      // Exactly how Prettier formats a checkbox with a few props, and exactly
      // what the previous line-by-line grep could never see.
      const found = find(`
        export function X() {
          return (
            <label>
              <input
                type="checkbox"
                checked={on}
                onChange={set}
              />
              Flat bottom
            </label>
          );
        }
      `);

      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({ found: '<input type="checkbox">', use: '<Checkbox>' });
    });

    it('still catches the single-line form', () => {
      const found = find('const a = <input type="checkbox" checked={on} />;');

      expect(found[0]?.use).toBe('<Checkbox>');
    });

    it('reports the whole tag, not just the line it starts on', () => {
      const found = find(`
        const a = (
          <input
            type="checkbox"
            checked={on}
          />
        );
      `);

      // A bare "<input" tells the reader nothing about which element it is.
      expect(found[0].lineContent).toContain('type="checkbox"');
      expect(found[0].lineContent).toContain('checked={on}');
    });

    it('points at the line the element opens on', () => {
      const found = find(['const a = (', '  <button', '    onClick={f}', '  />', ');'].join('\n'));

      expect(found[0].line).toBe(2);
    });
  });

  describe('what counts as a violation', () => {
    it('flags raw button and select', () => {
      const found = find('const a = <><button /><select /></>;');

      expect(found.map((v) => v.use)).toEqual(['<Button>', '<Select>']);
    });

    it('leaves design system components alone', () => {
      const found = find('const a = <><Button /><Select /><Checkbox /><Input /></>;');

      expect(found).toEqual([]);
    });

    it('leaves namespaced components alone', () => {
      expect(find('const a = <Dialog.Root><Menu.Item /></Dialog.Root>;')).toEqual([]);
    });

    it('treats a text input as reportable but not blocking', () => {
      const found = find('const a = <input type="text" />;');

      expect(found[0]).toMatchObject({ use: '<Input>', blocking: false });
    });

    it('blocks on a checkbox, which has always been enforced', () => {
      expect(find('const a = <input type="checkbox" />;')[0].blocking).toBe(true);
    });

    it('ignores a hidden input, which renders nothing to style', () => {
      expect(find('const a = <input type="hidden" value="x" />;')).toEqual([]);
    });

    it('ignores a file input, which is a mechanism rather than a styled control', () => {
      expect(find('const a = <input type="file" onChange={f} />;')).toEqual([]);
    });

    it('points a range at Slider, not Input', () => {
      expect(find('const a = <input type="range" />;')[0].use).toBe('<Slider>');
    });

    it('points a colour at ColorSwatch, not Input', () => {
      expect(find('const a = <input type="color" />;')[0].use).toBe('<ColorSwatch>');
    });

    it('names the type it found, so the report says which input it means', () => {
      expect(find('const a = <input type="search" />;')[0].found).toBe('<input type="search">');
    });

    it('does not assume a computed type is safe', () => {
      // Could be "checkbox" at runtime, so it is still surfaced.
      const found = find('const a = <input type={kind} />;');

      expect(found).toHaveLength(1);
    });
  });

  describe('things a regex got wrong', () => {
    it('ignores an element named in a comment', () => {
      expect(find('// prefer <Button> over <button>\nconst a = <Button />;')).toEqual([]);
    });

    it('ignores an element named in a string', () => {
      expect(find(`const help = 'use <Button> not <button>';`)).toEqual([]);
    });

    it('flags a raw button even when the line also mentions Button', () => {
      // The old grep dropped any line containing "<Button", so this hid.
      const found = find('const a = <div>{ok ? <Button /> : <button onClick={f} />}</div>;');

      expect(found).toHaveLength(1);
      expect(found[0].use).toBe('<Button>');
    });
  });
});

describe('shouldExclude', () => {
  it.each([
    'src/design-system/Button/Button.tsx',
    'src/features/x/X.test.tsx',
    'src/features/x/X.spec.tsx',
    'src/features/x/X.stories.tsx',
    'src/test/helpers.tsx',
    'e2e/foo.tsx',
  ])('skips %s', (file) => {
    expect(shouldExclude(file)).toBe(true);
  });

  it('checks ordinary feature code', () => {
    expect(shouldExclude('src/features/x/X.tsx')).toBe(false);
  });
});
