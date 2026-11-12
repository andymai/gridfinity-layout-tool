import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { __unstable__loadDesignSystem } from 'tailwindcss';

type DesignSystem = Awaited<ReturnType<typeof __unstable__loadDesignSystem>>;

interface AppStyles {
  readonly designSystem: DesignSystem;
  readonly plainClasses: ReadonlySet<string>;
}

const SRC_DIR = resolve(import.meta.dirname, '..');
const APP_STYLESHEET = resolve(SRC_DIR, 'index.css');
const require = createRequire(import.meta.url);
// `group` and `peer` carry no CSS of their own: `group-hover:` and similar
// variants select on them.
const VARIANT_MARKER = /^(group|peer)(\/[\w-]+)?$/;

let appStyles: Promise<AppStyles> | undefined;

function collectPlainClasses(css: string, into: Set<string>): void {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selector] of withoutComments.matchAll(/([^{};]+)\{/g)) {
    for (const [, name] of selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) into.add(name);
  }
}

async function loadAppStyles(): Promise<AppStyles> {
  const designSystem = await __unstable__loadDesignSystem(readFileSync(APP_STYLESHEET, 'utf8'), {
    base: dirname(APP_STYLESHEET),
    loadStylesheet: async (id, base) => {
      const path =
        id === 'tailwindcss' ? require.resolve('tailwindcss/index.css') : resolve(base, id);
      return { path, base: dirname(path), content: readFileSync(path, 'utf8') };
    },
  });
  // Read every stylesheet, not only index.css and its imports: some
  // components import their own (print.css).
  const plainClasses = new Set<string>();
  for (const entry of readdirSync(SRC_DIR, { recursive: true, encoding: 'utf8' })) {
    if (entry.endsWith('.css')) {
      collectPlainClasses(readFileSync(join(SRC_DIR, entry), 'utf8'), plainClasses);
    }
  }
  return { designSystem, plainClasses };
}

/**
 * The classes that the app's stylesheets give no rule: `src/index.css` with
 * its Tailwind theme and imports, and every other stylesheet under `src`.
 * Tailwind drops an unknown utility without a warning, so a class such as
 * `bg-primary` renders as nothing.
 */
export async function findClassesWithoutCss(classNames: Iterable<string>): Promise<string[]> {
  appStyles ??= loadAppStyles();
  const { designSystem, plainClasses } = await appStyles;
  const unique = [...new Set(classNames)].filter(
    (name) => !plainClasses.has(name) && !VARIANT_MARKER.test(name)
  );
  const css = designSystem.candidatesToCss(unique);
  return unique.filter((_, index) => css[index] === null);
}
