import { RuleTester } from 'eslint';
// @ts-expect-error -- JS rule, no .d.ts; loaded for behavior tests only.
import rule from '../eslint-rules/no-init-time-imported-call.js';

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

tester.run('no-init-time-imported-call', rule, {
  valid: [
    // Calling an imported function with a literal arg — no captured binding.
    { code: `import { ok } from 'mod'; export const OK = ok(undefined);` },
    // Calling a LOCAL function (not imported) with an imported arg.
    {
      code: `
        import { dep } from 'mod';
        function build(x) { return x; }
        export const X = build(dep);
      `,
    },
    // Calling an imported function with no args.
    { code: `import { make } from 'mod'; export const X = make();` },
    // Lazy singleton — call lives inside a function, not at module-init.
    {
      code: `
        import { make, dep } from 'mod';
        let cached;
        export function getX() { return (cached ??= make(dep)); }
      `,
    },
    // Top-level call NOT in a variable declarator (e.g. side-effect).
    { code: `import { side } from 'mod'; side();` },
    // React.memo / forwardRef defer arg usage until render — safe.
    {
      code: `
        import { memo } from 'react';
        import { areEqual, Component } from './c';
        export const Wrapped = memo(Component, areEqual);
      `,
    },
    {
      code: `
        import { forwardRef } from 'react';
        import { Inner } from './c';
        export const Outer = forwardRef(Inner);
      `,
    },
  ],
  invalid: [
    // The exact pattern that broke #1558.
    {
      code: `
        import { createCqrsMutations, commandBus } from '@/core/cqrs';
        export const cqrsMutations = createCqrsMutations(commandBus);
      `,
      errors: [{ messageId: 'capture' }],
    },
    // Same pattern without `export`.
    {
      code: `
        import { build, dep } from 'mod';
        const x = build(dep);
      `,
      errors: [{ messageId: 'capture' }],
    },
    // Captured binding is the second arg.
    {
      code: `
        import { build, a, dep } from 'mod';
        export const x = build(a, dep);
      `,
      errors: [{ messageId: 'capture' }],
    },
  ],
});
