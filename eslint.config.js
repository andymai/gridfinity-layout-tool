import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { fixupPluginRules } from '@eslint/compat'
import i18next from 'eslint-plugin-i18next'
import boundaries from 'eslint-plugin-boundaries'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'
import noInitTimeImportedCall from './eslint-rules/no-init-time-imported-call.js'

// i18next@6.1.5 anchors each words.exclude entry as a raw `^…$` regex source, so
// literal metacharacters (+, ., $, ~) must be escaped to match the intended text
// and to avoid crashing the linter on bare quantifiers like "+".
const literal = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'e2e', 'scripts', 'benchmarks', 'reports', 'brep-parts', 'playwright.config.ts', 'playwright.smoke.config.ts', 'playwright-ct.config.ts', 'playwright', '**/*.visual.tsx', 'src/test/setup.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    plugins: {
      i18next: fixupPluginRules(i18next),
      local: { rules: { 'no-init-time-imported-call': noInitTimeImportedCall } },
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        project: [
          'tsconfig.app.json',
          'tsconfig.node.json',
          'tsconfig.api.json',
          'tsconfig.test.json',
          'packages/branded-types/tsconfig.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Catch chunk-init capture hazards (#1466, #1558).
      'local/no-init-time-imported-call': 'error',
      // TypeScript strict rules
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
      }],
      '@typescript-eslint/consistent-type-imports': ['error', {
        prefer: 'type-imports',
        fixStyle: 'separate-type-imports',
      }],
      '@typescript-eslint/no-non-null-assertion': 'error',

      // Pragmatic type-checked rule tuning
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,
        allowBoolean: true,
      }],
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/no-deprecated': 'warn',
      '@typescript-eslint/no-misused-promises': ['error', {
        checksVoidReturn: { attributes: false },
      }],
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/restrict-plus-operands': ['error', {
        allowNumberAndString: true,
      }],
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unnecessary-type-arguments': 'warn',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'warn',
      '@typescript-eslint/no-unnecessary-type-parameters': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/no-misused-spread': 'warn',

      // Accessibility
      'jsx-a11y/click-events-have-key-events': 'error',
      'jsx-a11y/no-static-element-interactions': 'error',
      'jsx-a11y/no-noninteractive-element-interactions': 'error',
      'jsx-a11y/no-autofocus': 'error',
      'jsx-a11y/interactive-supports-focus': 'error',

      // React anti-patterns
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // General code quality
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],

      // Force every lazy() through lazyWithRetry so chunk-load failures on
      // stale clients retry + reload instead of leaking to PostHog as
      // unhandled rejections. See PR #1703. Two rules cover the two shapes:
      //   - `import { lazy } from 'react'` → no-restricted-imports (resolves
      //     through module graph, won't false-flag a locally-named `lazy`).
      //   - `React.lazy(...)` member call → no-restricted-syntax.
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'react',
          importNames: ['lazy'],
          message: 'Use lazyWithRetry() from @/shared/utils/lazyWithRetry instead of React.lazy() — raw lazy() leaks chunk-load failures to PostHog as unhandled rejections.',
        }],
      }],
      'no-restricted-syntax': ['error', {
        selector: 'CallExpression[callee.type="MemberExpression"][callee.property.name="lazy"][callee.object.name="React"]',
        message: 'Use lazyWithRetry() from @/shared/utils/lazyWithRetry instead of React.lazy() — raw lazy() leaks chunk-load failures to PostHog as unhandled rejections.',
      }],

      // i18n: Enforce localization of user-facing strings
      'i18next/no-literal-string': ['error', {
        mode: 'jsx-only',
        'jsx-attributes': {
          include: ['title', 'aria-label', 'placeholder', 'alt'],
        },
        'jsx-components': {
          exclude: ['code', 'kbd', 'pre'],
        },
        words: {
          exclude: [
            // Symbols and punctuation
            '×', '·', '—', '→', '←', '↔', '↑', '↓', '½', '~', '•', '%', '+', '/', ', ', ':',
            // Technical terms kept in English
            'Gridfinity', 'STL', '3MF', 'PLA', 'JSON', 'TSV', 'CSV', '3D',
            // Unit abbreviations and numeric fragments
            'mm', 'px', 'u', 'm', 'h', 'x', 'pcs', '.5', '+.5', 'g',
            // Ordered-list markers and loading ellipsis (presentational, not translatable)
            '1.', '2.', '3.', '...',
            // CSS/SVG values
            'normal', '0.02em', '100%',
            'xMidYMid meet', 'xMinYMin meet', 'xMinYMid meet', 'xMidYMax meet',
            // Currency symbol
            '$',
            // Numeric indicators
            '9+',
            // Brand names
            'Zack Freedman', 'Andy Aragon',
            // Keyboard shortcuts displayed as-is
            'Ctrl', 'Shift', 'Esc', 'Enter', 'Space',
            'WASD', 'H', 'R', 'V', 'L', 'M',
            // Arrow key display
            '↑↓←→',
          ].map(literal),
        },
        callees: {
          exclude: ['t', 'console.log', 'console.warn', 'console.error', 'Error', 'TypeError'],
        },
      }],
    },
  },
  // Architectural boundaries: enforce import rules between modules
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
        },
      },
      'boundaries/elements': [
        { type: 'core', pattern: ['src/core/*'] },
        { type: 'shared', pattern: ['src/shared/*'] },
        { type: 'design-system', pattern: ['src/design-system/*'] },
        { type: 'feature', pattern: ['src/features/*'], capture: ['featureName'] },
        { type: 'shell', pattern: ['src/shell/*'] },
        { type: 'i18n', pattern: ['src/i18n/*'] },
        { type: 'test-infra', pattern: ['src/test/*'] },
      ],
      'boundaries/dependency-nodes': ['import', 'dynamic-import'],
    },
    rules: {
      // Layer rules. Three kinds of constraint coexist:
      //   1. Cross-feature: features cannot import from OTHER features (with
      //      named exceptions for design-linking -> bin-designer and
      //      bin-inspector -> design-linking integration layers).
      //   2. `core/` is infrastructure: disallowed from `feature` and `shell`.
      //      (`core/` -> `shared/` stays allowed; several `core/storage/*`
      //      modules consume shared utilities/analytics by design.)
      //   3. `design-system/` is UI primitives: disallowed from every
      //      application-level layer (`feature`, `shell`, `shared`, `core`).
      //
      // This is a STRICTER superset of the bash mirror in
      // scripts/check-module-boundaries.sh — it also inspects dynamic
      // imports (see `boundaries/dependency-nodes` above).
      // Remaining edges (shared→feature, feature→shell) are intentionally
      // unrestricted today; tightening them needs a per-violator cleanup pass.
      'boundaries/dependencies': ['error', {
        default: 'allow',
        rules: [
          // Features: disallow importing other features (cross-feature coupling)
          { from: [{ type: 'feature' }], disallow: [{ to: { type: 'feature' } }] },
          // Same feature is OK
          {
            from: [{ type: 'feature' }],
            allow: [{ to: { type: 'feature', captured: { featureName: '{{ from.captured.featureName }}' } } }],
          },
          // Exception: design-linking -> bin-designer (integration layer)
          {
            from: [{ type: 'feature', captured: { featureName: 'design-linking' } }],
            allow: [{ to: { type: 'feature', captured: { featureName: 'bin-designer' } } }],
          },
          // Exception: bin-inspector -> design-linking (lazy-loaded linked design section)
          {
            from: [{ type: 'feature', captured: { featureName: 'bin-inspector' } }],
            allow: [{ to: { type: 'feature', captured: { featureName: 'design-linking' } } }],
          },
          // Exception: bin-inspector -> bin-recommender (lazy-loaded size suggestion)
          {
            from: [{ type: 'feature', captured: { featureName: 'bin-inspector' } }],
            allow: [{ to: { type: 'feature', captured: { featureName: 'bin-recommender' } } }],
          },
          // `core/` is infrastructure — it must not depend on features or the
          // app shell. (`core/` -> `shared/` is intentionally allowed; many
          // `core/storage/*` modules use shared utilities/analytics.)
          { from: [{ type: 'core' }], disallow: [{ to: { type: 'feature' } }, { to: { type: 'shell' } }] },
          // `design-system/` is UI primitives — it must not depend on any
          // application-level layer. UI primitives take strings via props;
          // they never read translations themselves, so `i18n` is in the
          // disallow list alongside the app layers.
          {
            from: [{ type: 'design-system' }],
            disallow: [
              { to: { type: 'feature' } },
              { to: { type: 'shell' } },
              { to: { type: 'i18n' } },
              { to: { type: 'shared' } },
              { to: { type: 'core' } },
            ],
          },
        ],
      }],
    },
  },
  // Bin-dimension discipline: every UI / validator / estimator that needs
  // outer/inner/total bin dimensions must derive them via binDimensions(params),
  // which reads `params.gridUnitMm` and `params.heightUnitMm`. Arithmetic
  // against the spec constants directly silently locks the math to 42mm/7mm
  // even when the user has configured a custom physical unit — the bug
  // shape behind #1809 and the broader audit follow-up.
  //
  // Allowlisted files: the helper, the constant definitions, scenario
  // fixtures (intentionally on the spec), and test code.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      '**/*.test.{ts,tsx}',
      '**/test/**/*.{ts,tsx}',
      '**/scenarios/**/*.{ts,tsx}',
      '**/__kernel-tests__/**/*.{ts,tsx}',
      'src/features/bin-designer/utils/binDimensions.ts',
      'src/shared/printSettings/gridfinityGeometry.ts',
    ],
    rules: {
      // Flat-config replaces (does not merge) per-rule values, so the
      // React.lazy guard from the global block is duplicated here.
      'no-restricted-syntax': ['error', {
        selector: 'CallExpression[callee.type="MemberExpression"][callee.property.name="lazy"][callee.object.name="React"]',
        message: 'Use lazyWithRetry() from @/shared/utils/lazyWithRetry instead of React.lazy() — raw lazy() leaks chunk-load failures to PostHog as unhandled rejections.',
      }, {
        selector: "BinaryExpression > MemberExpression[object.name='GRIDFINITY'][property.name='GRID_SIZE']",
        message: 'Do not multiply/divide GRIDFINITY.GRID_SIZE directly — use binDimensions(params) (or thread params.gridUnitMm through) so the math tracks the user-configured grid unit. See src/features/bin-designer/utils/binDimensions.ts.',
      }, {
        selector: "BinaryExpression > MemberExpression[object.name='GRIDFINITY'][property.name='HEIGHT_UNIT']",
        message: 'Do not multiply/divide GRIDFINITY.HEIGHT_UNIT directly — use binDimensions(params) (or thread params.heightUnitMm through) so the math tracks the user-configured height unit. See src/features/bin-designer/utils/binDimensions.ts.',
      }, {
        selector: "BinaryExpression > MemberExpression[object.name='GRIDFINITY_SPEC'][property.name='GRID_SIZE']",
        message: 'Do not multiply/divide GRIDFINITY_SPEC.GRID_SIZE directly — thread the per-layout gridUnitMm through instead. See src/features/bin-designer/utils/binDimensions.ts.',
      }, {
        selector: "BinaryExpression > MemberExpression[object.name='GRIDFINITY_SPEC'][property.name='HEIGHT_UNIT']",
        message: 'Do not multiply/divide GRIDFINITY_SPEC.HEIGHT_UNIT directly — thread the per-layout heightUnitMm through instead. See src/features/bin-designer/utils/binDimensions.ts.',
      }],
    },
  },
  // Barrel-only restriction: design-linking may only import bin-designer barrel.
  // Note: `paths` is duplicated from the global rule because flat-config overrides
  // replace (not merge) the rule value.
  {
    files: ['src/features/design-linking/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'react',
          importNames: ['lazy'],
          message: 'Use lazyWithRetry() from @/shared/utils/lazyWithRetry instead of React.lazy().',
        }],
        patterns: [{
          group: ['@/features/bin-designer/*', '@/features/bin-designer/**'],
          message: 'Import from @/features/bin-designer barrel only',
        }],
      }],
    },
  },
  // Barrel-only restriction: bin-inspector may only import design-linking barrel.
  {
    files: ['src/features/bin-inspector/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{
          name: 'react',
          importNames: ['lazy'],
          message: 'Use lazyWithRetry() from @/shared/utils/lazyWithRetry instead of React.lazy().',
        }],
        patterns: [{
          group: ['@/features/design-linking/*', '@/features/design-linking/**'],
          message: 'Import from @/features/design-linking barrel only',
        }],
      }],
    },
  },
  // Design system: compound components are valid exports, and English
  // accessibility defaults (aria-labels) don't go through i18n — consumers
  // pass translated labels via props when needed.
  {
    files: ['src/design-system/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
      'i18next/no-literal-string': 'off',
    },
  },
  // Test files: relax TypeScript strictness and disable i18n rule
  {
    files: ['**/*.test.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      'i18next/no-literal-string': 'off',
      'max-lines': 'off',
    },
  },
  // i18n locale files: no i18n or max-lines rule needed (locale data files are large by nature)
  {
    files: ['**/i18n/**/*.{ts,tsx}'],
    rules: {
      'i18next/no-literal-string': 'off',
      'max-lines': 'off',
    },
  },
  // Justified large files: cohesive modules where splitting would hurt readability.
  // Some paths are forward-looking (created by companion file-split PRs).
  {
    files: [
      'src/shared/analytics/labelVocabulary.ts', // pre-split (1670 LOC, pure data)
      'src/shared/analytics/labelVocabulary/vocabulary.ts', // post-split equivalent
      'src/features/bin-designer/components/panel/CutoutsSection/useCutoutInteraction.ts',
      'src/features/baseplate/components/BaseplatePreview/BaseplatePreview.tsx',
      'src/shell/Mobile/MobileLayoutsPanel/MobileLayoutsPanel.tsx',
      'src/shared/analytics/mlTelemetry/trackers.ts',
      'api/ml-telemetry.ts', // pre-split (2268 LOC)
      'api/lib/mlTelemetry/aggregators.ts', // post-split equivalent
      // Cohesive single-concern modules where splitting would harm readability:
      'src/shared/utils/validation.ts', // type guards + import/salvage validation pipeline (728 LOC); concerns are interleaved by design
      'src/features/generation/bridge/GenerationBridge.ts', // single GenerationBridge class with the full worker-message protocol
      'src/features/generation/worker/generators/baseplateGenerator.ts', // single linear generation pipeline
      'src/features/generation/worker/generators/baseplateDirectMesh.ts', // single direct-mesh generator pipeline
      'src/features/generation/worker/generators/wallPatternBuilder.ts', // single per-wall pattern builder
      'src/features/bin-designer/components/panel/CutoutsSection/svgImport/svgParser.ts', // SVG element-conversion pipeline; helpers separated where useful
      'src/features/inspiration-gallery/data/themes/workshop.ts', // pure theme data, large by nature
      // Component files dense with conditional rendering / inline handlers; sub-components
      // exist where useful but the orchestration layer remains in the main file:
      'src/features/bin-designer/components/CompartmentEditor/CompartmentEditor.tsx',
      'src/features/bin-designer/components/CutoutWorkspace/CutoutWorkspace.tsx',
      'src/features/bin-designer/components/CutoutWorkspace/WorkspaceHeader.tsx',
      'src/features/bin-designer/components/DesignListDialog/DesignListDialog.tsx',
      'src/features/bin-designer/components/PreviewCanvas/PreviewCanvas.tsx',
      'src/features/bin-inspector/hooks/useBinInspector.ts', // single coordinating hook
      'src/features/cloud-share/components/ShareButton/ShareButton.tsx',
      'src/features/command-palette/components/CommandPalette/CommandPalette.tsx',
      'src/features/grid-editor/components/Grid/Overlay/Overlay.tsx',
      'src/features/staging/components/Staging/Staging.tsx',
      'src/shell/Modals/HelpModal/HelpModal.tsx', // tabbed help content kept inline by design
      'src/shell/RightPanel/RightPanel.tsx',
      'src/shell/Sidebar/Sidebar.tsx',
    ],
    rules: { 'max-lines': 'off' },
  },
  // Scripts: no i18n rule needed
  {
    files: ['scripts/**/*.{ts,tsx}'],
    rules: {
      'i18next/no-literal-string': 'off',
    },
  },
])
