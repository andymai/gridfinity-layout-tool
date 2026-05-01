/**
 * Flag top-level `const x = fn(importedY)` where both the callee and an
 * argument come from imports. Such calls capture imported bindings into
 * long-lived closures at module-init; under chunk-level static-import
 * cycles the captured binding can be `undefined` (see #1466, #1558).
 *
 * The safe alternative is a lazy singleton:
 *   let _x;
 *   function getX() { return (_x ??= fn(importedY)); }
 */

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow capturing imported bindings into module-init closures (chunk-init cycle hazard)',
    },
    schema: [],
    messages: {
      capture:
        'Calling imported `{{callee}}` with imported `{{arg}}` at module-init evaluates with ' +
        '`{{arg}}` whatever value the import resolves to AT THIS MOMENT — and under ' +
        'chunk-level static-import cycles (#1466) that may be `undefined`. If `{{callee}}` ' +
        'retains `{{arg}}` (closure or stored field), that undefined sticks. Defer the call ' +
        'until first use (e.g. `let cached; function getX() { return cached ??= {{callee}}({{arg}}); }`).',
    },
  },
  create(context) {
    /** @type {Set<string>} Identifiers brought in by `import` statements in this module. */
    const importedNames = new Set();

    // React HOCs and similar APIs that store the captured argument but only
    // INVOKE it during render / commit phase — by then every chunk is loaded.
    // Adding others here is fine as long as they share that property.
    const SAFE_CALLEES = new Set([
      'memo',
      'forwardRef',
      'lazy',
      'createContext',
    ]);

    function isTopLevelDeclarator(declarator) {
      const decl = declarator.parent;
      if (!decl || decl.type !== 'VariableDeclaration') return false;
      const parent = decl.parent;
      if (!parent) return false;
      // `const x = ...` directly in the program OR `export const x = ...`
      if (parent.type === 'Program') return true;
      if (parent.type === 'ExportNamedDeclaration' && parent.parent?.type === 'Program') {
        return true;
      }
      return false;
    }

    return {
      ImportDeclaration(node) {
        for (const spec of node.specifiers) {
          // Default, namespace, and named imports all expose a `local` binding.
          importedNames.add(spec.local.name);
        }
      },
      VariableDeclarator(node) {
        if (!isTopLevelDeclarator(node)) return;
        const init = node.init;
        if (!init || init.type !== 'CallExpression') return;
        if (init.callee.type !== 'Identifier') return;
        if (!importedNames.has(init.callee.name)) return;
        if (SAFE_CALLEES.has(init.callee.name)) return;

        for (const arg of init.arguments) {
          if (arg.type === 'Identifier' && importedNames.has(arg.name)) {
            context.report({
              node: init,
              messageId: 'capture',
              data: { callee: init.callee.name, arg: arg.name },
            });
            return;
          }
        }
      },
    };
  },
};

export default rule;
