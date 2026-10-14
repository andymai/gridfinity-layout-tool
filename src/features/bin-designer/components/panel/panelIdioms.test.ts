/**
 * The sidebar says each kind of thing one way: an on/off setting is a toggle
 * row (`FeatureToggle`), a choice of wall is the spatial cross
 * (`SideSelector`), and a fold is the label-and-summary row
 * (`MoreDisclosure`). A second idiom for either reads as a different kind of
 * control, which is how the panel drifted before.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const ROOTS = [
  'src/features/bin-designer/components/panel',
  'src/features/bin-designer/components/ParameterPanel',
  'src/features/bin-designer/components/CompartmentEditor',
  'src/features/bin-designer/components/SlotConfigurator',
];

const BOOLEAN_PRIMITIVES = new Set(['Checkbox', 'CheckboxRow', 'Switch', 'ToggleRow']);
const CHOICE_CONTROLS = new Set(['SegmentedControl', 'SegmentGrid']);
/** Wall-name keys: a control labelled with these is picking a wall. */
const WALL_KEY = /^binDesigner\.(lid\.side|overhang\.side|wallCutouts\.side|handles\.side)\./;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [path] : [];
  });
}

function tagName(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
  return (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText();
}

function keyText(arg: ts.Expression): string | undefined {
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text;
  if (ts.isTemplateExpression(arg)) return arg.head.text;
  return undefined;
}

function namesAWall(node: ts.Node): boolean {
  let found = false;
  const walk = (child: ts.Node): void => {
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      child.expression.text === 't' &&
      child.arguments.length > 0
    ) {
      const key = keyText(child.arguments[0]);
      if (key !== undefined && WALL_KEY.test(key)) found = true;
    }
    ts.forEachChild(child, walk);
  };
  walk(node);
  return found;
}

function violations(path: string): string[] {
  const source = ts.createSourceFile(
    path,
    readFileSync(path, 'utf-8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const found: string[] = [];
  const at = (node: ts.Node): string => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    return `${relative(process.cwd(), path)}:${line + 1}`;
  };

  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = tagName(node);
      if (BOOLEAN_PRIMITIVES.has(name)) {
        found.push(`${at(node)} <${name}>: use FeatureToggle for an on/off setting`);
      }
      if (name === 'Collapsible') {
        found.push(`${at(node)} <Collapsible>: use MoreDisclosure for a fold`);
      }
      if (CHOICE_CONTROLS.has(name) && namesAWall(node)) {
        found.push(`${at(node)} <${name}> lists walls: use SideSelector`);
      }
    }
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText() === 'role' &&
      node.initializer !== undefined &&
      ts.isStringLiteral(node.initializer) &&
      node.initializer.text === 'checkbox'
    ) {
      found.push(`${at(node)} role="checkbox": use FeatureToggle for an on/off setting`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('panel idioms', () => {
  it('uses one control per kind of setting', () => {
    expect(ROOTS.flatMap(sourceFiles).flatMap(violations)).toEqual([]);
  });
});
