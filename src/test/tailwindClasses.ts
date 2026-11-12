import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
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
  const plainClasses = new Set<string>();
  const read = (path: string): string => {
    const content = readFileSync(path, 'utf8');
    if (path.startsWith(SRC_DIR)) collectPlainClasses(content, plainClasses);
    return content;
  };

  const designSystem = await __unstable__loadDesignSystem(read(APP_STYLESHEET), {
    base: dirname(APP_STYLESHEET),
    loadStylesheet: async (id, base) => {
      const path =
        id === 'tailwindcss' ? require.resolve('tailwindcss/index.css') : resolve(base, id);
      return { path, base: dirname(path), content: read(path) };
    },
  });
  return { designSystem, plainClasses };
}

/**
 * The classes that the app's stylesheet (`src/index.css`, its Tailwind theme
 * and its imports) gives no rule. Tailwind drops an unknown utility without a
 * warning, so a class such as `bg-primary` renders as nothing.
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
