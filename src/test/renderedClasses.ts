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
  | { readonly kind: 'value'; readonly values: readonly Located<ts.Expression>[] }
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

/** One level of a destructuring pattern, from the outer value in. */
interface BindingStep {
  /** The property that the step reads; `undefined` reads every entry. */
  readonly key: string | undefined;
  readonly indexed: boolean;
  readonly rest: boolean;
  readonly fallback: ts.Expression | undefined;
}

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

function bindingKey(element: ts.BindingElement): string | undefined {
  const property = element.propertyName;
  if (property === undefined) return ts.isIdentifier(element.name) ? element.name.text : undefined;
  return ts.isComputedPropertyName(property)
    ? literalKey(property.expression)
    : propertyName(property);
}

function bindingPath(pattern: ts.BindingName, name: string): BindingStep[] | undefined {
  if (ts.isIdentifier(pattern)) return pattern.text === name ? [] : undefined;
  for (const element of pattern.elements) {
    if (ts.isOmittedExpression(element)) continue;
    const inner = bindingPath(element.name, name);
    if (inner === undefined) continue;
    const key = ts.isObjectBindingPattern(pattern) ? bindingKey(element) : undefined;
    const step: BindingStep = {
      key,
      indexed: key === undefined,
      rest: element.dotDotDotToken !== undefined,
      fallback: element.initializer,
    };
    return [step, ...inner];
  }
  return undefined;
}

function returnedExpressions(fn: ts.FunctionLikeDeclaration): ts.Expression[] {
  if (fn.body === undefined) return [];
  if (!ts.isBlock(fn.body)) return [fn.body];
  const returned: ts.Expression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node) && node.expression !== undefined) {
      returned.push(node.expression);
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(fn.body, visit);
  return returned;
}

function isClassNameAssignment(node: ts.Node): node is ts.BinaryExpression {
  return (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
    ts.isPropertyAccessExpression(node.left) &&
    node.left.name.text === 'className'
  );
}

/** The arguments of an `el.classList` call that put a class on the element. */
function classListArguments(call: ts.CallExpression): readonly ts.Expression[] {
  const method = call.expression;
  if (!ts.isPropertyAccessExpression(method)) return [];
  const owner = unwrap(method.expression);
  if (!ts.isPropertyAccessExpression(owner) || owner.name.text !== 'classList') return [];
  switch (method.name.text) {
    case 'add':
      return call.arguments;
    case 'toggle':
      return call.arguments.slice(0, 1);
    case 'replace':
      return call.arguments.slice(1, 2);
    default:
      return [];
  }
}

function hasExportModifier(node: ts.Node): boolean {
  return (
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
  );
}

/**
 * Collects the class names that the given sources render: the values of
 * `className` (and `*ClassName`, `*Class`) JSX attributes and of those props in
 * a JSX spread, the arguments of `cn`/`clsx`/`twMerge`, the base and variant
 * classes of `cva`, and what plain code writes to `el.className` and
 * `el.classList`. A constant, object map or helper function that one of those
 * positions names is followed, in the same file or through `@/` and relative
 * imports, and so is the object that a helper call returns. Other strings are
 * not read, so prose and option values never count as classes.
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
  const resolving = new Set<ts.Node>();

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

  // A binding can hold what its path reads from the source and each default
  // on the way, so it stands for all of them.
  const bindingValues = (
    unit: SourceUnit,
    pattern: ts.BindingName,
    source: ts.Expression | undefined,
    name: string
  ): Declaration | 'shadowed' | undefined => {
    const path = bindingPath(pattern, name);
    if (path === undefined) return undefined;
    let values: Located<ts.Expression>[] = source === undefined ? [] : [{ unit, node: source }];
    for (const step of path) {
      if (!step.rest) {
        values = values.flatMap((v) => readMember(v.unit, v.node, step.key, step.indexed));
      }
      if (step.fallback !== undefined) values = [...values, { unit, node: step.fallback }];
    }
    return values.length > 0 ? { kind: 'value', values } : 'shadowed';
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
            : { kind: 'value', values: [{ unit, node: declaration.initializer }] };
        }
        const fromPattern = bindingValues(unit, declaration.name, declaration.initializer, name);
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
          const fromParameter = bindingValues(unit, parameter.name, parameter.initializer, name);
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

  const findObjects = (unit: SourceUnit, expression: ts.Expression): Located<ObjectOrArray>[] => {
    if (ts.isObjectLiteralExpression(expression) || ts.isArrayLiteralExpression(expression)) {
      return [{ unit, node: expression }];
    }
    if (ts.isIdentifier(expression)) {
      const declaration = resolveIdentifier(unit, expression);
      return declaration?.kind === 'value'
        ? declaration.values.flatMap((v) => resolveObjects(v.unit, v.node))
        : [];
    }
    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
      return resolveMembers(unit, expression).flatMap((m) => resolveObjects(m.unit, m.node));
    }
    if (ts.isCallExpression(expression) && ts.isIdentifier(expression.expression)) {
      const declaration = resolveIdentifier(unit, expression.expression);
      if (declaration?.kind !== 'function') return [];
      return returnedExpressions(declaration.node).flatMap((node) =>
        resolveObjects(declaration.unit, node)
      );
    }
    return [];
  };

  // A value can read itself: a helper that returns a member of its own call
  // (`return { inner: props(n - 1).inner }`), or two maps that name each
  // other. A node on the stack resolves to nothing, so the other branches
  // (the base case) give the result.
  const resolveObjects = (unit: SourceUnit, node: ts.Expression): Located<ObjectOrArray>[] => {
    const expression = unwrap(node);
    if (resolving.has(expression)) return [];
    resolving.add(expression);
    const objects = findObjects(unit, expression);
    resolving.delete(expression);
    return objects;
  };

  // A key known only at runtime (`SIZES[size]`) can select any entry, so the
  // lookup stands for all of them. An array answers only an indexed read.
  const readMember = (
    unit: SourceUnit,
    owner: ts.Expression,
    key: string | undefined,
    indexed: boolean
  ): Located<ts.Expression>[] =>
    resolveObjects(unit, owner).flatMap((container): Located<ts.Expression>[] => {
      if (ts.isArrayLiteralExpression(container.node)) {
        if (!indexed) return [];
        return container.node.elements
          .filter((e) => !ts.isOmittedExpression(e))
          .map((e) => ({ unit: container.unit, node: ts.isSpreadElement(e) ? e.expression : e }));
      }
      return container.node.properties
        .filter(
          (p): p is ts.PropertyAssignment =>
            ts.isPropertyAssignment(p) && (key === undefined || propertyName(p.name) === key)
        )
        .map((p) => ({ unit: container.unit, node: p.initializer }));
    });

  const resolveMembers = (
    unit: SourceUnit,
    access: ts.PropertyAccessExpression | ts.ElementAccessExpression
  ): Located<ts.Expression>[] =>
    ts.isPropertyAccessExpression(access)
      ? readMember(unit, access.expression, access.name.text, false)
      : readMember(unit, access.expression, literalKey(access.argumentExpression), true);

  const scanDeclaration = (declaration: Declaration | undefined): void => {
    if (declaration === undefined) return;
    const values =
      declaration.kind === 'function'
        ? returnedExpressions(declaration.node).map((node) => ({ unit: declaration.unit, node }))
        : declaration.values;
    for (const value of values) scanClasses(value.unit, value.node);
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

  const scanClassProperties = (unit: SourceUnit, node: ts.Expression): void => {
    for (const container of resolveObjects(unit, node)) {
      if (!ts.isObjectLiteralExpression(container.node)) continue;
      for (const property of container.node.properties) {
        if (ts.isPropertyAssignment(property)) {
          const key = propertyName(property.name);
          if (key !== undefined && CLASS_ATTRIBUTE.test(key)) {
            scanClasses(container.unit, property.initializer);
          }
        } else if (
          ts.isShorthandPropertyAssignment(property) &&
          CLASS_ATTRIBUTE.test(property.name.text)
        ) {
          scanClasses(container.unit, property.name);
        }
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
      } else if (ts.isJsxSpreadAttribute(node)) {
        scanClassProperties(unit, node.expression);
      } else if (isClassNameAssignment(node)) {
        scanClasses(unit, node.right);
      } else if (ts.isCallExpression(node)) {
        const name = callee(node);
        if (name !== undefined && (CLASS_FUNCTIONS.has(name) || name === 'cva')) {
          scanClasses(unit, node);
        } else {
          for (const argument of classListArguments(node)) {
            scanClasses(unit, ts.isSpreadElement(argument) ? argument.expression : argument);
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(unit.source);
  }
  return found;
}
