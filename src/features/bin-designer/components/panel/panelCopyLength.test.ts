/**
 * Prose the panel shows inline stays short: anything longer belongs behind an
 * info dot, where it costs no height until someone asks for it.
 *
 * Reads the source rather than rendering it, so every branch is checked, not
 * just the states a render happened to reach. A key can reach the panel three
 * ways, and each is followed: a `t('…')` call in the JSX, a `t(TABLE[x])` over
 * a lookup table in the same file, and a key a hook picks as a string literal
 * and hands over as state. A key ending in `Detail` is, by convention, the
 * text behind a dot.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import en from '@/i18n/locales/en';

const MAX_INLINE_CHARS = 90;

const ROOTS = [
  'src/features/bin-designer/components/panel',
  'src/features/bin-designer/components/ParameterPanel',
  'src/features/bin-designer/components/CompartmentEditor',
  'src/features/bin-designer/components/SlotConfigurator',
  'src/shared/components/FeatureToggle',
];

/** Elements whose text renders inline in the panel. */
const INLINE_ELEMENTS = new Set(['Hint', 'p', 'DependencyHint']);
/** Props whose string renders inline under the control. */
const INLINE_PROPS = new Set(['disabledReason', 'hint']);
/** Components whose `info` prints as a line under the label rather than a dot. */
const INLINE_INFO = new Set(['SliderInput']);
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
/** The convention for a key whose text sits behind an info dot. */
const DETAIL_KEY = /Detail$/;

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

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** String values of a same-file `const NAME = { … }` lookup table. */
function tableValues(source: ts.SourceFile, name: string): string[] {
  const values: string[] = [];
  const find = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer !== undefined &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      for (const property of node.initializer.properties) {
        if (ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer)) {
          values.push(property.initializer.text);
        }
      }
    }
    ts.forEachChild(node, find);
  };
  find(source);
  return values;
}

/** The en keys a `t(...)` argument can name. */
function keysFor(arg: ts.Expression, source: ts.SourceFile): string[] {
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return [arg.text];
  if (ts.isTemplateExpression(arg)) {
    const pattern = new RegExp(
      `^${escapeRegExp(arg.head.text)}${arg.templateSpans
        .map((span) => `.*${escapeRegExp(span.literal.text)}`)
        .join('')}$`
    );
    return Object.keys(en).filter((key) => pattern.test(key));
  }
  if (ts.isElementAccessExpression(arg) && ts.isIdentifier(arg.expression)) {
    return tableValues(source, arg.expression.text);
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
  const record = (node: ts.Node, key: string): void => {
    const value = en[key];
    if (value === undefined || DETAIL_KEY.test(key)) return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    found.push({ at: `${relative(process.cwd(), path)}:${line + 1}`, key, length: value.length });
  };

  // A hook hands its keys over as state, which the panel renders inline.
  if (path.endsWith('.ts')) {
    const literal = (node: ts.Node): void => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        record(node, node.text);
      }
      ts.forEachChild(node, literal);
    };
    literal(source);
    return found;
  }

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
      for (const key of keysFor(node.arguments[0], source)) record(node, key);
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
        if (!ts.isJsxAttribute(attribute) || attribute.initializer === undefined) continue;
        const prop = attribute.name.getText();
        if (INLINE_PROPS.has(prop)) collect(attribute.initializer);
        if (prop === ON_DEMAND_PROP && INLINE_INFO.has(name)) {
          ts.forEachChild(attribute.initializer, collect);
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
