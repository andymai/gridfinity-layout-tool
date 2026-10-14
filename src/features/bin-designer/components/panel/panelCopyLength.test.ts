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

/** Modules outside the sidebar whose keys it renders inline as blocked reasons. */
const PRODUCERS = ['src/shared/utils/pullTabPlan.ts', 'src/shared/constraints'];

const INLINE_ELEMENTS = new Set(['Hint', 'p', 'DependencyHint']);
const INLINE_PROPS = new Set(['disabledReason', 'hint']);
/** Components whose `info` prints as a line under the label rather than a dot. */
const INLINE_INFO = new Set(['SliderInput']);
const ON_DEMAND_PROP = 'info';
const ON_DEMAND = new Set([
  'InfoDot',
  'LabelInfo',
  'OptionNotes',
  'Dialog',
  'Popover',
  'FieldLabel',
]);
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

function inlineCopy(path: string, text = readFileSync(path, 'utf-8')): InlineCopy[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found: InlineCopy[] = [];
  const record = (node: ts.Node, key: string): void => {
    const value = en[key];
    if (value === undefined || DETAIL_KEY.test(key)) return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    found.push({ at: `${relative(process.cwd(), path)}:${line + 1}`, key, length: value.length });
  };

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
    if (isT(node)) {
      for (const key of keysFor(node.arguments[0], source)) record(node, key);
    }
    ts.forEachChild(node, collect);
  };

  const isT = (node: ts.Node): node is ts.CallExpression =>
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 't' &&
    node.arguments.length > 0;

  // The longest text a node can render: alternatives count once, siblings add up.
  const rendered = (node: ts.Node): number => {
    if (onDemand(node)) return 0;
    if (ts.isJsxText(node)) return node.text.trim().length;
    if (ts.isStringLiteral(node)) return node.text.length;
    if (ts.isJsxExpression(node)) return node.expression ? rendered(node.expression) : 0;
    if (ts.isParenthesizedExpression(node)) return rendered(node.expression);
    if (ts.isConditionalExpression(node)) {
      return Math.max(rendered(node.whenTrue), rendered(node.whenFalse));
    }
    if (ts.isBinaryExpression(node)) {
      return node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        ? rendered(node.right)
        : Math.max(rendered(node.left), rendered(node.right));
    }
    if (isT(node)) {
      return Math.max(0, ...keysFor(node.arguments[0], source).map((key) => en[key]?.length ?? 0));
    }
    if (ts.isJsxElement(node)) {
      return node.children.reduce((sum, child) => sum + rendered(child), 0);
    }
    return 0;
  };

  const visit = (node: ts.Node): void => {
    if (onDemand(node)) return;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = tagName(node);
      if (ts.isJsxElement(node) && INLINE_ELEMENTS.has(name)) {
        node.children.forEach(collect);
        const length = node.children.reduce((sum, child) => sum + rendered(child), 0);
        const { line } = source.getLineAndCharacterOfPosition(node.getStart());
        found.push({
          at: `${relative(process.cwd(), path)}:${line + 1}`,
          key: `<${name}>`,
          length,
        });
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
  it('adds up a paragraph built from several strings, counting a choice once', () => {
    const paragraph = (extra: string): string => `
      export const Notice = ({ t, on }) => (
        <p>
          {t('binDesigner.overhang.placement.prints')}${extra}
          {on ? t('binDesigner.lid.fill') : t('binDesigner.lid.magnetHoles')}
        </p>
      );`;
    const measured = (extra: string): number =>
      inlineCopy('Notice.tsx', paragraph(extra)).find((copy) => copy.key === '<p>')?.length ?? 0;

    expect(measured('')).toBeLessThanOrEqual(MAX_INLINE_CHARS);
    expect(measured(" {t('binDesigner.overhang.placement.changeInLayout')}")).toBeGreaterThan(
      MAX_INLINE_CHARS
    );
  });

  it(`keeps inline prose to ${MAX_INLINE_CHARS} characters`, () => {
    const producers = PRODUCERS.flatMap((path) =>
      statSync(path).isDirectory() ? sourceFiles(path) : [path]
    );
    const tooLong = [...ROOTS.flatMap(sourceFiles), ...producers]
      .flatMap((path) => inlineCopy(path))
      .filter((copy) => copy.length > MAX_INLINE_CHARS)
      .map((copy) => `${copy.at} ${copy.key} (${copy.length})`);
    expect(tooLong).toEqual([]);
  });
});
