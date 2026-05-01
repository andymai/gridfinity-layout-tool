# Engineer Agent Memory

## Project Patterns

- ESLint config uses flat config (eslint.config.js), no `--no-eslintrc` flag
- `JSON.parse()` returns `any` -- annotate as `unknown` and narrow with type guards
- `Array.isArray()` on `unknown` narrows to `any[]` -- use `.filter()` with type predicates or cast to `readonly T[]`
- `validateImport()` in `@/shared/utils/validation` already accepts `unknown`
- TypeScript strict mode is on; tsc --noEmit for type checking
- Pre-existing test failures may exist in working tree due to other uncommitted changes
- `max-lines: 500` rule enforced — extract helpers to sibling files when hooks/components grow past it
- `react-hooks/refs` lint rule forbids ref writes during render — wrap in `useEffect`
- ESLint `boundaries/dependencies` blocks cross-feature imports — features must import from `@/shared/generation/bridge` (re-export barrel), NOT `@/features/generation/bridge`. Same applies to other cross-feature deps.
- en.json is GENERATED from en.ts via `pnpm run build:en-locale`, skipped by check-i18n scripts. JSON locales (de, es, fr, nb, nl, pt-BR) are alphabetically sorted by key.
- Toast in `src/core/store/toast.ts` supports `action` + `secondaryAction` (added during harden-bin-export); rendered side-by-side in shared Toast.tsx
- `preserve-caught-error` rule: when re-throwing in catch, attach `cause: caughtErr`

## File Locations

- ESLint config: `eslint.config.js` (flat config format)
- Constants: `src/core/constants.ts`
- Validation utils: `src/shared/utils/validation.ts`
- Analytics: `src/shared/analytics/posthog/` (directory; events split by domain — events.ts, binExportEvents.ts, etc.)
- Generation bridge (canonical): `src/features/generation/bridge/`
- Generation bridge (cross-feature barrel): `src/shared/generation/bridge.ts`
- Bin designer export hook: `src/features/bin-designer/hooks/useExport.ts`
- Export resilience wrapper: `src/features/bin-designer/utils/exportWithResilience.ts`
