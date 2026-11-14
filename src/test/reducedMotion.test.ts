import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss from 'postcss';
import type { Rule } from 'postcss';
import { describe, it, expect } from 'vitest';

const SRC_DIR = resolve(import.meta.dirname, '..');

function findRule(file: string, matches: (rule: Rule) => boolean): Rule {
  const root = postcss.parse(readFileSync(resolve(SRC_DIR, file), 'utf8'));
  const found: Rule[] = [];
  root.walkRules((rule) => {
    if (matches(rule)) found.push(rule);
  });
  expect(found).toHaveLength(1);
  const [rule] = found;
  if (rule === undefined) throw new Error(`no matching rule in ${file}`);
  return rule;
}

function declarations(rule: Rule): Record<string, string> {
  const values: Record<string, string> = {};
  rule.walkDecls((decl) => {
    values[decl.prop] = `${decl.value}${decl.important ? ' !important' : ''}`;
  });
  return values;
}

const isInReducedMotionQuery = (rule: Rule): boolean =>
  rule.parent?.type === 'atrule' &&
  rule.parent.toString().startsWith('@media (prefers-reduced-motion: reduce)');

describe('the reduced-motion rules', () => {
  it.each([
    {
      path: 'the OS setting',
      file: 'index.css',
      matches: (rule: Rule) => isInReducedMotionQuery(rule) && rule.selectors.includes('*'),
    },
    {
      path: 'the app setting',
      file: 'shell/styles/themes.css',
      matches: (rule: Rule) => rule.selectors.includes("html[data-reduce-motion='true'] *"),
    },
  ])('end every animation at once for $path, with no delay', ({ file, matches }) => {
    // A staggered card fills backwards through its inline animationDelay,
    // so a delay that survives keeps the card hidden.
    expect(declarations(findRule(file, matches))).toMatchObject({
      'animation-duration': '0.01ms !important',
      'animation-delay': '0s !important',
    });
  });
});
