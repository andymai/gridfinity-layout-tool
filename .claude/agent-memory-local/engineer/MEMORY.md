# Engineer Agent Memory

## Project Patterns

- ESLint config uses flat config (eslint.config.js), no `--no-eslintrc` flag
- `JSON.parse()` returns `any` -- annotate as `unknown` and narrow with type guards
- `Array.isArray()` on `unknown` narrows to `any[]` -- use `.filter()` with type predicates or cast to `readonly T[]`
- `validateImport()` in `@/shared/utils/validation` already accepts `unknown`
- TypeScript strict mode is on; tsc --noEmit for type checking
- Pre-existing test failures may exist in working tree due to other uncommitted changes

## File Locations

- ESLint config: `eslint.config.js` (flat config format)
- Constants: `src/core/constants.ts`
- Validation utils: `src/shared/utils/validation.ts`
- Analytics: `src/shared/analytics/posthog.ts`
