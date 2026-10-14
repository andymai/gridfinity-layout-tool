/**
 * Prose the panel shows inline stays short: anything longer belongs behind an
 * info dot, where it costs no height until someone asks for it.
 *
 * Reads the JSX rather than rendering it, so every branch is checked, not just
 * the states a render happened to reach.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en';

const MAX_INLINE_CHARS = 90;

const ROOTS = ['src/features/bin-designer/components/panel', 'src/shared/components/FeatureToggle'];

/** Elements whose text renders inline in the panel. */
const INLINE_ELEMENTS = new Set(['Hint', 'p', 'DependencyHint']);
/** Props whose string renders inline under the control. */
const INLINE_PROPS = new Set(['disabledReason', 'hint']);
/** A prop holding prose shown on demand, behind an info dot. */
const ON_DEMAND_PROP = 'info';
/** Containers whose prose is shown on demand, not inline. */
const ON_DEMAND = new Set([
  'InfoDot',
  'LabelInfo',
  'OptionNotes',
  'Dialog',
  'Popover',
  'FieldLabel',
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    // A dialog's prose is on demand: it only shows once the dialog is opened.
    return /\.tsx?$/.test(name) && !/(\.test\.tsx?|Dialog\.tsx)$/.test(name) ? [path] : [];
  });
}

function tagName(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
  const tag = ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
  return tag.getText();
}

/** The en keys a `t(...)` argument can name: one literal, or every key a template matches. */
function keysFor(arg: ts.Expression): string[] {
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return [arg.text];
  if (ts.isTemplateExpression(arg)) {
    const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `^${escape(arg.head.text)}${arg.templateSpans.map((span) => `.*${escape(span.literal.text)}`).join('')}$`
    );
    return Object.keys(en).filter((key) => pattern.test(key));
  }
  return [];
}

interface InlineCopy {
  readonly at: string;
  readonly key: string;
  readonly length: number;
}

function inlineCopy(path: string): InlineCopy[] {
  const text = readFileSync(path, 'utf-8');
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: InlineCopy[] = [];

  const onDemand = (node: ts.Node): boolean =>
    ((ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) && ON_DEMAND.has(tagName(node))) ||
    (ts.isJsxAttribute(node) && node.name.getText() === ON_DEMAND_PROP);

  const collect = (node: ts.Node): void => {
    if (onDemand(node)) return;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 't' &&
      node.arguments.length > 0
    ) {
      for (const key of keysFor(node.arguments[0])) {
        const value = en[key];
        if (value === undefined) continue;
        const { line } = source.getLineAndCharacterOfPosition(node.getStart());
        found.push({
          at: `${relative(process.cwd(), path)}:${line + 1}`,
          key,
          length: value.length,
        });
      }
    }
    ts.forEachChild(node, collect);
  };

  const visit = (node: ts.Node): void => {
    if (onDemand(node)) return;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = tagName(node);
      if (ts.isJsxElement(node) && INLINE_ELEMENTS.has(name)) {
        node.children.forEach(collect);
      }
      const attributes = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
      for (const attribute of attributes.properties) {
        if (
          ts.isJsxAttribute(attribute) &&
          INLINE_PROPS.has(attribute.name.getText()) &&
          attribute.initializer
        ) {
          collect(attribute.initializer);
        }
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(source);
  return found;
}

describe('panel copy length', () => {
  it(`keeps inline prose to ${MAX_INLINE_CHARS} characters`, () => {
    const tooLong = ROOTS.flatMap(sourceFiles)
      .flatMap(inlineCopy)
      .filter((copy) => copy.length > MAX_INLINE_CHARS)
      .map((copy) => `${copy.at} ${copy.key} (${copy.length})`);
    expect(tooLong).toEqual([]);
  });
});
