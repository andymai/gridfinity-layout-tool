import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

export interface RenderedClass {
  readonly name: string;
  readonly location: string;
}

interface SourceUnit {
  readonly path: string;
  readonly source: ts.SourceFile;
}

type Declaration =
  | { readonly kind: 'value'; readonly unit: SourceUnit; readonly node: ts.Expression }
  | {
      readonly kind: 'function';
      readonly unit: SourceUnit;
      readonly node: ts.FunctionLikeDeclaration;
    };

interface Located<T extends ts.Node> {
  readonly unit: SourceUnit;
  readonly node: T;
}

type ObjectOrArray = ts.ObjectLiteralExpression | ts.ArrayLiteralExpression;

const SRC_DIR = resolve(import.meta.dirname, '..');
const CLASS_ATTRIBUTE = /(^c|C)lass(Name)?$/;
const CLASS_FUNCTIONS = new Set(['cn', 'clsx', 'twMerge']);
/** Methods that pass a class list through: `[a, b].join(' ')`, `` `…`.trim() ``. */
const CLASS_LIST_METHODS = new Set(['join', 'trim', 'filter']);
const MODULE_SUFFIXES = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
const SKIPPED_FILE = /\.(test|spec|bench)\.tsx?$|\.d\.ts$/;

/** The app's `.ts`/`.tsx` files under `src`, without tests, keyed by absolute path. */
export function readAppSources(): Map<string, string> {
  const sources = new Map<string, string>();
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'test' && !entry.name.startsWith('__')) walk(path);
      } else if (/\.tsx?$/.test(entry.name) && !SKIPPED_FILE.test(entry.name)) {
        sources.set(path, readFileSync(path, 'utf8'));
      }
    }
  };
  walk(SRC_DIR);
  return sources;
}

function unwrap(node: ts.Expression): ts.Expression {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function literalKey(node: ts.Expression): string | undefined {
  const expression = unwrap(node);
  if (
    ts.isStringLiteral(expression) ||
    ts.isNoSubstitutionTemplateLiteral(expression) ||
    ts.isNumericLiteral(expression)
  ) {
    return expression.text;
  }
  return undefined;
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  );
}

/**
 * Collects the class names that the given sources render: the values of
 * `className` (and `*ClassName`, `*Class`) JSX attributes, the arguments of
 * `cn`/`clsx`/`twMerge`, and the base and variant classes of `cva`. A constant,
 * object map or helper function that one of those positions names is followed,
 * in the same file or through `@/` and relative imports. Other strings are not
 * read, so prose and option values never count as classes.
 *
 * `@/` resolves against `srcDir`, and each location is relative to its parent.
 */
export function collectRenderedClasses(
  sources: ReadonlyMap<string, string>,
  srcDir: string = SRC_DIR
): RenderedClass[] {
  const units = new Map<string, SourceUnit>();
  for (const [path, text] of sources) {
    const kind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    units.set(path, {
      path,
      source: ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind),
    });
  }

  const found: RenderedClass[] = [];
  const seen = new Set<ts.Node>();

  const locate = (unit: SourceUnit, node: ts.Node): string => {
    const { line } = unit.source.getLineAndCharacterOfPosition(node.getStart(unit.source));
    return `${relative(dirname(srcDir), unit.path)}:${line + 1}`;
  };

  const addText = (
    unit: SourceUnit,
    node: ts.Node,
    text: string,
    joinsBefore = false,
    joinsAfter = false
  ): void => {
    const tokens = text.split(/\s+/);
    // A token touching a `${…}` or `+` boundary is a fragment of a class
    // built at runtime (`bg-${tone}`), not a whole class.
    const first = joinsBefore ? 1 : 0;
    const last = joinsAfter ? tokens.length - 1 : tokens.length;
    for (const token of tokens.slice(first, last)) {
      if (token !== '') found.push({ name: token, location: locate(unit, node) });
    }
  };

  const resolveModule = (specifier: string, fromPath: string): SourceUnit | undefined => {
    let base: string;
    if (specifier.startsWith('@/')) base = join(srcDir, specifier.slice(2));
    else if (specifier.startsWith('.')) base = resolve(dirname(fromPath), specifier);
    else return undefined;
    for (const suffix of MODULE_SUFFIXES) {
      const unit = units.get(`${base}${suffix}`);
      if (unit !== undefined) return unit;
    }
    return undefined;
  };

  const findExport = (
    unit: SourceUnit,
    name: string,
    visited: Set<string>
  ): Declaration | undefined => {
    const key = `${unit.path}#${name}`;
    if (visited.has(key)) return undefined;
    visited.add(key);
    for (const statement of unit.source.statements) {
      if (ts.isExportDeclaration(statement) && !statement.isTypeOnly) {
        const target =
          statement.moduleSpecifier !== undefined && ts.isStringLiteral(statement.moduleSpecifier)
            ? resolveModule(statement.moduleSpecifier.text, unit.path)
            : undefined;
        const clause = statement.exportClause;
        if (clause === undefined) {
          const declaration = target && findExport(target, name, visited);
          if (declaration !== undefined) return declaration;
        } else if (ts.isNamedExports(clause)) {
          const element = clause.elements.find((e) => e.name.text === name);
          if (element !== undefined) {
            const original = element.propertyName?.text ?? name;
            if (statement.moduleSpecifier === undefined) {
              return lookupInStatements(unit, unit.source.statements, original, visited);
            }
            return target && findExport(target, original, visited);
          }
        }
      } else if (hasExportModifier(statement)) {
        const declaration = declarationIn(unit, statement, name);
        if (declaration !== undefined && declaration !== 'shadowed') return declaration;
      }
    }
    return undefined;
  };

  const bindingDefault = (
    unit: SourceUnit,
    pattern: ts.BindingName,
    name: string
  ): Declaration | 'shadowed' | undefined => {
    if (ts.isIdentifier(pattern)) return pattern.text === name ? 'shadowed' : undefined;
    for (const element of pattern.elements) {
      if (ts.isOmittedExpression(element)) continue;
      if (ts.isIdentifier(element.name) && element.name.text === name) {
        return element.initializer !== undefined
          ? { kind: 'value', unit, node: element.initializer }
          : 'shadowed';
      }
      const nested = bindingDefault(unit, element.name, name);
      if (nested !== undefined) return nested;
    }
    return undefined;
  };

  const declarationIn = (
    unit: SourceUnit,
    statement: ts.Statement,
    name: string
  ): Declaration | 'shadowed' | undefined => {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) {
          if (declaration.name.text !== name) continue;
          if (declaration.initializer === undefined) return 'shadowed';
          const value = unwrap(declaration.initializer);
          return ts.isArrowFunction(value) || ts.isFunctionExpression(value)
            ? { kind: 'function', unit, node: value }
            : { kind: 'value', unit, node: declaration.initializer };
        }
        const fromPattern = bindingDefault(unit, declaration.name, name);
        if (fromPattern !== undefined) return fromPattern;
      }
    }
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) {
      return { kind: 'function', unit, node: statement };
    }
    return undefined;
  };

  const lookupInStatements = (
    unit: SourceUnit,
    statements: ts.NodeArray<ts.Statement>,
    name: string,
    visited: Set<string>
  ): Declaration | undefined => {
    for (const statement of statements) {
      if (ts.isImportDeclaration(statement)) {
        const bindings = statement.importClause?.namedBindings;
        if (
          statement.importClause?.isTypeOnly !== true &&
          bindings !== undefined &&
          ts.isNamedImports(bindings) &&
          ts.isStringLiteral(statement.moduleSpecifier)
        ) {
          const element = bindings.elements.find((e) => e.name.text === name);
          if (element !== undefined) {
            const target = resolveModule(statement.moduleSpecifier.text, unit.path);
            return target && findExport(target, element.propertyName?.text ?? name, visited);
          }
        }
        continue;
      }
      const declaration = declarationIn(unit, statement, name);
      if (declaration === 'shadowed') return undefined;
      if (declaration !== undefined) return declaration;
    }
    return undefined;
  };

  const resolveIdentifier = (
    unit: SourceUnit,
    identifier: ts.Identifier
  ): Declaration | undefined => {
    const name = identifier.text;
    for (let scope: ts.Node | undefined = identifier.parent; scope; scope = scope.parent) {
      if (ts.isFunctionLike(scope)) {
        for (const parameter of scope.parameters) {
          const fromParameter = bindingDefault(unit, parameter.name, name);
          if (fromParameter === 'shadowed') return undefined;
          if (fromParameter !== undefined) return fromParameter;
        }
      }
      if (ts.isSourceFile(scope) || ts.isBlock(scope) || ts.isModuleBlock(scope)) {
        const declaration = lookupInStatements(unit, scope.statements, name, new Set());
        if (declaration !== undefined) return declaration;
      }
    }
    return undefined;
  };

  const resolveObjects = (unit: SourceUnit, node: ts.Expression): Located<ObjectOrArray>[] => {
    const expression = unwrap(node);
    if (ts.isObjectLiteralExpression(expression) || ts.isArrayLiteralExpression(expression)) {
      return [{ unit, node: expression }];
    }
    if (ts.isIdentifier(expression)) {
      const declaration = resolveIdentifier(unit, expression);
      return declaration?.kind === 'value'
        ? resolveObjects(declaration.unit, declaration.node)
        : [];
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      return resolveMembers(unit, expression).flatMap((m) => resolveObjects(m.unit, m.node));
    }
    return [];
  };

  // A key known only at runtime (`SIZES[size]`) can select any entry, so the
  // lookup stands for all of them.
  const resolveMembers = (
    unit: SourceUnit,
    access: ts.PropertyAccessExpression | ts.ElementAccessExpression
  ): Located<ts.Expression>[] => {
    const key = ts.isPropertyAccessExpression(access)
      ? access.name.text
      : literalKey(access.argumentExpression);
    return resolveObjects(unit, access.expression).flatMap((owner): Located<ts.Expression>[] => {
      if (ts.isArrayLiteralExpression(owner.node)) {
        if (ts.isPropertyAccessExpression(access)) return [];
        return owner.node.elements
          .filter((e) => !ts.isOmittedExpression(e))
          .map((e) => ({ unit: owner.unit, node: ts.isSpreadElement(e) ? e.expression : e }));
      }
      return owner.node.properties
        .filter(
          (p): p is ts.PropertyAssignment =>
            ts.isPropertyAssignment(p) && (key === undefined || propertyName(p.name) === key)
        )
        .map((p) => ({ unit: owner.unit, node: p.initializer }));
    });
  };

  const scanReturns = (unit: SourceUnit, fn: ts.FunctionLikeDeclaration): void => {
    if (fn.body === undefined) return;
    if (!ts.isBlock(fn.body)) {
      scanClasses(unit, fn.body);
      return;
    }
    const visit = (node: ts.Node): void => {
      if (ts.isFunctionLike(node)) return;
      if (ts.isReturnStatement(node) && node.expression !== undefined) {
        scanClasses(unit, node.expression);
      }
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(fn.body, visit);
  };

  const scanDeclaration = (declaration: Declaration | undefined): void => {
    if (declaration === undefined) return;
    if (declaration.kind === 'value') scanClasses(declaration.unit, declaration.node);
    else scanReturns(declaration.unit, declaration.node);
  };

  const scanValues = (unit: SourceUnit, node: ts.Expression): void => {
    for (const container of resolveObjects(unit, node)) {
      if (ts.isArrayLiteralExpression(container.node)) {
        scanClasses(container.unit, container.node);
        continue;
      }
      for (const property of container.node.properties) {
        if (ts.isPropertyAssignment(property)) scanClasses(container.unit, property.initializer);
      }
    }
  };

  const scanConcatenation = (unit: SourceUnit, parts: readonly ts.Expression[]): void => {
    parts.forEach((part, index) => {
      const expression = unwrap(part);
      if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
        if (seen.has(expression)) return;
        seen.add(expression);
        const text = expression.text;
        addText(
          unit,
          expression,
          text,
          index > 0 && !/^\s/.test(text),
          index < parts.length - 1 && !/\s$/.test(text)
        );
      } else {
        scanClasses(unit, expression);
      }
    });
  };

  const flattenConcatenation = (node: ts.Expression): ts.Expression[] => {
    const expression = unwrap(node);
    if (
      ts.isBinaryExpression(expression) &&
      expression.operatorToken.kind === ts.SyntaxKind.PlusToken
    ) {
      return [...flattenConcatenation(expression.left), ...flattenConcatenation(expression.right)];
    }
    return [expression];
  };

  const scanCva = (unit: SourceUnit, call: ts.CallExpression): void => {
    const [base, config] = call.arguments;
    if (base !== undefined) scanClasses(unit, base);
    if (config === undefined) return;
    for (const options of resolveObjects(unit, config)) {
      if (!ts.isObjectLiteralExpression(options.node)) continue;
      for (const property of options.node.properties) {
        if (!ts.isPropertyAssignment(property)) continue;
        const key = propertyName(property.name);
        if (key === 'variants') {
          for (const groups of resolveObjects(options.unit, property.initializer)) {
            if (!ts.isObjectLiteralExpression(groups.node)) continue;
            for (const group of groups.node.properties) {
              if (ts.isPropertyAssignment(group)) scanValues(groups.unit, group.initializer);
              else if (ts.isShorthandPropertyAssignment(group)) scanValues(groups.unit, group.name);
            }
          }
        } else if (key === 'compoundVariants') {
          for (const entries of resolveObjects(options.unit, property.initializer)) {
            if (!ts.isArrayLiteralExpression(entries.node)) continue;
            for (const entry of entries.node.elements) {
              if (!ts.isObjectLiteralExpression(entry)) continue;
              for (const field of entry.properties) {
                const fieldName = ts.isPropertyAssignment(field)
                  ? propertyName(field.name)
                  : undefined;
                if (
                  ts.isPropertyAssignment(field) &&
                  (fieldName === 'class' || fieldName === 'className')
                ) {
                  scanClasses(entries.unit, field.initializer);
                }
              }
            }
          }
        }
      }
    }
  };

  const callee = (call: ts.CallExpression): string | undefined =>
    ts.isIdentifier(call.expression) ? call.expression.text : undefined;

  function scanClasses(unit: SourceUnit, node: ts.Expression): void {
    const expression = unwrap(node);
    if (seen.has(expression)) return;
    seen.add(expression);

    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
      addText(unit, expression, expression.text);
    } else if (ts.isTemplateExpression(expression)) {
      addText(
        unit,
        expression.head,
        expression.head.text,
        false,
        !/\s$/.test(expression.head.text)
      );
      expression.templateSpans.forEach((span, index) => {
        scanClasses(unit, span.expression);
        const text = span.literal.text;
        const isLast = index === expression.templateSpans.length - 1;
        addText(unit, span.literal, text, !/^\s/.test(text), !isLast && !/\s$/.test(text));
      });
    } else if (ts.isConditionalExpression(expression)) {
      scanClasses(unit, expression.whenTrue);
      scanClasses(unit, expression.whenFalse);
    } else if (ts.isBinaryExpression(expression)) {
      const operator = expression.operatorToken.kind;
      if (operator === ts.SyntaxKind.AmpersandAmpersandToken) {
        scanClasses(unit, expression.right);
      } else if (
        operator === ts.SyntaxKind.BarBarToken ||
        operator === ts.SyntaxKind.QuestionQuestionToken
      ) {
        scanClasses(unit, expression.left);
        scanClasses(unit, expression.right);
      } else if (operator === ts.SyntaxKind.PlusToken) {
        scanConcatenation(unit, flattenConcatenation(expression));
      }
    } else if (ts.isArrayLiteralExpression(expression)) {
      for (const element of expression.elements) {
        scanClasses(unit, ts.isSpreadElement(element) ? element.expression : element);
      }
    } else if (ts.isObjectLiteralExpression(expression)) {
      for (const property of expression.properties) {
        if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
          const key = propertyName(property.name);
          if (key !== undefined) addText(unit, property.name, key);
        }
      }
    } else if (ts.isIdentifier(expression)) {
      scanDeclaration(resolveIdentifier(unit, expression));
    } else if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      for (const member of resolveMembers(unit, expression)) scanClasses(member.unit, member.node);
    } else if (ts.isCallExpression(expression)) {
      const name = callee(expression);
      if (name !== undefined && CLASS_FUNCTIONS.has(name)) {
        for (const argument of expression.arguments) {
          scanClasses(unit, ts.isSpreadElement(argument) ? argument.expression : argument);
        }
      } else if (name === 'cva') {
        scanCva(unit, expression);
      } else if (ts.isIdentifier(expression.expression)) {
        scanDeclaration(resolveIdentifier(unit, expression.expression));
      } else if (
        ts.isPropertyAccessExpression(expression.expression) &&
        CLASS_LIST_METHODS.has(expression.expression.name.text)
      ) {
        scanClasses(unit, expression.expression.expression);
      }
    }
  }

  for (const unit of units.values()) {
    const visit = (node: ts.Node): void => {
      if (
        ts.isJsxAttribute(node) &&
        CLASS_ATTRIBUTE.test(node.name.getText(unit.source)) &&
        node.initializer !== undefined
      ) {
        if (ts.isStringLiteral(node.initializer)) scanClasses(unit, node.initializer);
        else if (
          ts.isJsxExpression(node.initializer) &&
          node.initializer.expression !== undefined
        ) {
          scanClasses(unit, node.initializer.expression);
        }
      } else if (ts.isCallExpression(node)) {
        const name = callee(node);
        if (name !== undefined && (CLASS_FUNCTIONS.has(name) || name === 'cva')) {
          scanClasses(unit, node);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(unit.source);
  }
  return found;
}
