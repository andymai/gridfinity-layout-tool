import { beforeAll, describe, it, expect } from 'vitest';
import { collectRenderedClasses, readAppSources } from './renderedClasses';
import type { RenderedClass } from './renderedClasses';
import { findClassesWithoutCss } from './tailwindClasses';
import { timeLimitMs } from '@/test/timeLimit';

const SRC = '/app/src';

function collect(files: Record<string, string>): RenderedClass[] {
  const sources = new Map(Object.entries(files).map(([path, text]) => [`${SRC}/${path}`, text]));
  return collectRenderedClasses(sources, SRC);
}

function names(files: Record<string, string>): string[] {
  return collect(files).map((c) => c.name);
}

async function classesWithoutCss(rendered: readonly RenderedClass[]): Promise<string[]> {
  const missing = new Set(await findClassesWithoutCss(rendered.map((c) => c.name)));
  return rendered.filter((c) => missing.has(c.name)).map((c) => `${c.location} ${c.name}`);
}

const KEYED_LOOKUP = [
  `const SIZES = {`,
  `  sm: { box: 'w-6 h-6', px: 24, badge: 'top-0' },`,
  `  md: { box: 'w-8 h-8x', px: 32, badge: 'top-1' },`,
  `};`,
  `export const Avatar = ({ size }: Props) => {`,
  `  const config = SIZES[size];`,
  `  return (`,
  `    <div className={\`rounded \${config.box}\`}>`,
  `      <span className={cn('absolute', SIZES['sm'].badge)} />`,
  `    </div>`,
  `  );`,
  `};`,
].join('\n');

const DESTRUCTURING = [
  `const STATUS = {`,
  `  ok: { bg: 'bg-success', ring: 'ring-success', pulse: false },`,
  `  bad: { bg: 'bg-errorx', ring: 'ring-error', pulse: true },`,
  `};`,
  `const BADGE = { tone: 'text-accent', shape: { corner: 'rounded-full' } };`,
  `const WEIGHTS = ['font-medium', 'font-semibold'];`,
  `export const Dot = ({ status }: Props) => {`,
  `  const { bg, ring: outline = 'ring-accent', pulse } = STATUS[status];`,
  `  const { tone, shape: { corner }, gap = 'gap-1' } = BADGE;`,
  `  const [weight] = WEIGHTS;`,
  `  return (`,
  `    <span className={cn('inline-block', bg, outline, pulse && 'animate-pulse')}>`,
  `      <i className={\`\${tone} \${corner} \${gap} \${weight}\`} />`,
  `    </span>`,
  `  );`,
  `};`,
].join('\n');

const JSX_SPREAD = [
  `const common = {`,
  `  className: 'h-3.5 w-3.5 text-accentx',`,
  `  viewBox: '0 0 14 14',`,
  `  stroke: 'currentColor',`,
  `} as const;`,
  `export const Glyph = (props: Props) => {`,
  `  const iconClass = 'text-content';`,
  `  return (`,
  `    <div {...props}>`,
  `      <svg {...common} />`,
  `      <Icon {...{ iconClass, label: 'Close the panel' }} />`,
  `    </div>`,
  `  );`,
  `};`,
].join('\n');

const HELPER_RETURN = [
  `function noticeCopy(reason: Reason): NoticeCopy {`,
  `  switch (reason) {`,
  `    case 'restricted':`,
  `      return { tone: 'error', frameClass: 'border-error/30 bg-error/5' };`,
  `    default:`,
  `      return { tone: 'warning', frameClass: 'border-warning/30 bg-warning-mutedx' };`,
  `  }`,
  `}`,
  `function loop(): Style {`,
  `  return loop();`,
  `}`,
  `const rowProps = (id: string) => ({ id, className: 'flex items-center', role: 'row' });`,
  `export const Notice = ({ reason }: Props) => {`,
  `  const copy = noticeCopy(reason);`,
  `  const { badgeClass } = badgeStyle();`,
  `  return (`,
  `    <div className={cn('rounded-lg border', copy.frameClass)} data-tone={copy.tone}>`,
  `      <span className={badgeClass} />`,
  `      <i className={loop().icon} {...rowProps('a')} />`,
  `    </div>`,
  `  );`,
  `};`,
].join('\n');

const RECURSIVE_RETURN = [
  `function props(n: number): Props {`,
  `  if (n === 0) return { inner: { className: 'gap-2 p-2x', cell: 'rounded-sm' } };`,
  `  return { inner: props(n - 1).inner };`,
  `}`,
  `export const Grid = () => (`,
  `  <div className={props(3).inner.cell}>`,
  `    <i {...props(2).inner} />`,
  `  </div>`,
  `);`,
].join('\n');

const SHORTHAND_RETURN = [
  `const frameClass = 'border-warning/30 bg-warning-mutedx';`,
  `function copy() {`,
  `  const iconClass = 'h-4 w-4';`,
  `  return { frameClass, iconClass, label: 'Hidden' };`,
  `}`,
  `export const Notice = () => {`,
  `  const { iconClass } = copy();`,
  `  return (`,
  `    <div className={copy().frameClass}>`,
  `      <i className={iconClass} />`,
  `    </div>`,
  `  );`,
  `};`,
].join('\n');

const DOM_ASSIGNMENT = [
  `const PULSE = 'animate-pulse';`,
  `export function showError(root: HTMLElement, visible: boolean): void {`,
  `  const wrap = document.createElement('div');`,
  `  wrap.className =`,
  `    'flex min-h-screen items-centerx';`,
  `  wrap.title = 'Reload the page';`,
  `  wrap.classList.add('gap-4', PULSE);`,
  `  wrap.classList.toggle('hidden', !visible);`,
  `  wrap.classList.replace('old-class', 'p-6');`,
  `  wrap.classList.remove('not-rendered');`,
  `  root.append(wrap);`,
  `}`,
].join('\n');

describe('collectRenderedClasses', () => {
  it('reads className, *ClassName and *Class attributes, and no other text', () => {
    expect(
      names({
        'A.tsx': `
          export const A = () => (
            <div className="flex gap-2" title="Close the panel" aria-label={t('common.close')}>
              <Icon iconClassName="h-4 w-4" colorClass="text-accent" />
              <p>Some words here</p>
            </div>
          );
        `,
      })
    ).toEqual(['flex', 'gap-2', 'h-4', 'w-4', 'text-accent']);
  });

  it('returns nothing for a file without classes', () => {
    expect(names({ 'b.ts': `export const label = 'Rows and columns';` })).toEqual([]);
  });

  it('reads the arguments of cn, clsx and twMerge, and only the classes of a condition', () => {
    expect(
      names({
        'a.ts': `
          const a = cn(
            'p-2',
            isOpen && 'block',
            isOpen ? 'text-content' : 'text-content-tertiary',
            size ?? 'h-6',
            ['m-1', ...extra],
            { 'opacity-50': disabled, hidden: !open }
          );
          const b = clsx('flex');
          const c = twMerge('grid');
          const d = format('not-a-class');
        `,
      })
    ).toEqual([
      'p-2',
      'block',
      'text-content',
      'text-content-tertiary',
      'h-6',
      'm-1',
      'opacity-50',
      'hidden',
      'flex',
      'grid',
    ]);
  });

  it('skips the fragments of a class that a template or + builds at runtime', () => {
    expect(
      names({
        'A.tsx': `
          export const A = () => (
            <div className={\`rounded bg-\${tone}-500 \${active ? 'ring-2' : ''} shadow-sm\`}>
              <span className={'text-' + tone + ' font-medium'} />
            </div>
          );
        `,
      })
    ).toEqual(['rounded', 'ring-2', 'shadow-sm', 'font-medium']);
  });

  it('reads the list that join, trim and filter pass through', () => {
    expect(
      names({
        'A.tsx': `
          export const A = () => (
            <div className={\`px-2 \${extra}\`.trim()}>
              <span className={['grid', 'gap-2'].join(' ')} />
            </div>
          );
        `,
      })
    ).toEqual(['px-2', 'grid', 'gap-2']);
  });

  it('follows constants, object maps, helper functions and parameter defaults in one file', () => {
    expect(
      names({
        'Row.tsx': `
          const ROW = 'flex items-center';
          const SIZE = { sm: 'h-6', md: 'h-8' } as const;
          const TONE = { quiet: 'text-content-tertiary', loud: 'text-accent' };
          const LABEL = 'Rows';
          function stateClass(active: boolean): string {
            const items = ['ignored'].map((x) => {
              return 'not-returned';
            });
            if (active) return 'bg-accent';
            return 'bg-surface';
          }
          export const Row = ({ size, active, colorClass = 'text-content' }: Props) => (
            <div className={cn(ROW, SIZE[size], TONE.quiet, stateClass(active))} title={LABEL}>
              <span className={colorClass} />
            </div>
          );
        `,
      })
    ).toEqual([
      'flex',
      'items-center',
      'h-6',
      'h-8',
      'text-content-tertiary',
      'bg-accent',
      'bg-surface',
      'text-content',
    ]);
  });

  it('reads a property from every entry that a keyed lookup can return', () => {
    expect(names({ 'Avatar.tsx': KEYED_LOOKUP })).toEqual([
      'rounded',
      'w-6',
      'h-6',
      'w-8',
      'h-8x',
      'absolute',
      'top-0',
    ]);
  });

  it('reports a misspelled class behind a keyed lookup where it is written', async () => {
    expect(await classesWithoutCss(collect({ 'Avatar.tsx': KEYED_LOOKUP }))).toEqual([
      'src/Avatar.tsx:3 h-8x',
    ]);
  });

  it('reads the classes that destructuring takes from a map, with renames and defaults', () => {
    expect(names({ 'Dot.tsx': DESTRUCTURING })).toEqual([
      'inline-block',
      'bg-success',
      'bg-errorx',
      'ring-success',
      'ring-error',
      'ring-accent',
      'animate-pulse',
      'text-accent',
      'rounded-full',
      'gap-1',
      'font-medium',
      'font-semibold',
    ]);
  });

  it('reports a misspelled class that destructuring takes where it is written', async () => {
    expect(await classesWithoutCss(collect({ 'Dot.tsx': DESTRUCTURING }))).toEqual([
      'src/Dot.tsx:3 bg-errorx',
    ]);
  });

  it('reads the class props of an object that a JSX spread passes', () => {
    expect(names({ 'Glyph.tsx': JSX_SPREAD })).toEqual([
      'h-3.5',
      'w-3.5',
      'text-accentx',
      'text-content',
    ]);
  });

  it('reports a misspelled class behind a JSX spread where it is written', async () => {
    expect(await classesWithoutCss(collect({ 'Glyph.tsx': JSX_SPREAD }))).toEqual([
      'src/Glyph.tsx:2 text-accentx',
    ]);
  });

  it('reads a property from every object that a helper returns', () => {
    expect(
      names({
        'badgeStyle.ts': `export const badgeStyle = () => ({ badgeClass: 'px-2 py-0.5', label: 'New' });`,
        'Notice.tsx': `import { badgeStyle } from './badgeStyle';\n${HELPER_RETURN}`,
      })
    ).toEqual([
      'rounded-lg',
      'border',
      'border-error/30',
      'bg-error/5',
      'border-warning/30',
      'bg-warning-mutedx',
      'px-2',
      'py-0.5',
      'flex',
      'items-center',
    ]);
  });

  it('reports a misspelled class that a helper returns where it is written', async () => {
    expect(await classesWithoutCss(collect({ 'Notice.tsx': HELPER_RETURN }))).toEqual([
      'src/Notice.tsx:6 bg-warning-mutedx',
    ]);
  });

  it('stops at a helper that returns a member of its own call, and keeps its base case', () => {
    expect(names({ 'Grid.tsx': RECURSIVE_RETURN })).toEqual(['rounded-sm', 'gap-2', 'p-2x']);
  });

  it('reports a misspelled class in the base case of a recursive helper where it is written', async () => {
    expect(await classesWithoutCss(collect({ 'Grid.tsx': RECURSIVE_RETURN }))).toEqual([
      'src/Grid.tsx:2 p-2x',
    ]);
  });

  it('reads a shorthand property through a member read and destructuring', () => {
    expect(names({ 'Notice.tsx': SHORTHAND_RETURN })).toEqual([
      'border-warning/30',
      'bg-warning-mutedx',
      'h-4',
      'w-4',
    ]);
  });

  it('reports a misspelled class behind a shorthand property where it is written', async () => {
    expect(await classesWithoutCss(collect({ 'Notice.tsx': SHORTHAND_RETURN }))).toEqual([
      'src/Notice.tsx:1 bg-warning-mutedx',
    ]);
  });

  it('reads the classes that plain code puts on a DOM element', () => {
    expect(names({ 'boot.ts': DOM_ASSIGNMENT })).toEqual([
      'flex',
      'min-h-screen',
      'items-centerx',
      'gap-4',
      'animate-pulse',
      'hidden',
      'p-6',
    ]);
  });

  it('reports a misspelled class on a DOM element where it is written', async () => {
    expect(await classesWithoutCss(collect({ 'boot.ts': DOM_ASSIGNMENT }))).toEqual([
      'src/boot.ts:5 items-centerx',
    ]);
  });

  it('follows an import through the @/ alias, a relative path and a barrel', () => {
    expect(
      names({
        'design-system/variants.ts': `
          export const focusRing = ['outline-2', 'outline-accent'] as const;
          export const typeRamp = { label: 'text-label', title: 'text-title' } as const;
        `,
        'design-system/surface.ts': `export const RAW = 'bg-surface-elevated';`,
        'design-system/index.ts': `
          export * from './variants';
          export { RAW as surfaceClass } from './surface';
        `,
        'shared/chip.ts': `export const CHIP = 'rounded-full px-2';`,
        'features/a/A.tsx': `
          import { focusRing, typeRamp, surfaceClass } from '@/design-system';
          import { CHIP } from '../../shared/chip';
          export const A = () => (
            <div className={cn(...focusRing, typeRamp.title, surfaceClass, CHIP)} />
          );
        `,
      })
    ).toEqual([
      'outline-2',
      'outline-accent',
      'text-title',
      'bg-surface-elevated',
      'rounded-full',
      'px-2',
    ]);
  });

  it('reads the base and variant classes of cva, and not its variant names or defaults', () => {
    expect(
      names({
        'button.ts': `
          const sizes = { sm: 'h-6 px-2', md: 'h-8 px-3' };
          const button = cva(['inline-flex', 'rounded-md'], {
            variants: {
              size: sizes,
              tone: { primary: 'bg-accent text-on-accent', ghost: 'bg-transparent' },
            },
            compoundVariants: [{ tone: 'ghost', size: 'sm', class: 'px-1' }],
            defaultVariants: { size: 'md', tone: 'primary' },
          });
        `,
      })
    ).toEqual([
      'inline-flex',
      'rounded-md',
      'h-6',
      'px-2',
      'h-8',
      'px-3',
      'bg-accent',
      'text-on-accent',
      'bg-transparent',
      'px-1',
    ]);
  });

  it('reports each class where its string is written', () => {
    expect(
      collect({
        'row.ts': `export const ROW = 'grid';`,
        'A.tsx': [
          `import { ROW } from './row';`,
          `export const A = () => (`,
          `  <div`,
          `    className="flex"`,
          `  >`,
          `    <span className={ROW} />`,
          `  </div>`,
          `);`,
        ].join('\n'),
      })
    ).toEqual([
      { name: 'flex', location: 'src/A.tsx:4' },
      { name: 'grid', location: 'src/row.ts:1' },
    ]);
  });
});

describe('the app source', () => {
  let rendered: RenderedClass[] = [];
  // Coverage slows this parse of every app file past the default hook timeout.
  beforeAll(() => {
    rendered = collectRenderedClasses(readAppSources());
  }, timeLimitMs(10_000));

  it('is read in full', () => {
    expect(rendered.length).toBeGreaterThan(10_000);
    expect(rendered).toContainEqual({
      name: 'cursor-pointer',
      location: expect.stringMatching(
        /^src\/shared\/components\/FeatureToggle\/FeatureToggle\.tsx:/
      ),
    });
  });

  it('gives every class that it renders a CSS rule', async () => {
    expect(await classesWithoutCss(rendered)).toEqual([]);
  });
});
