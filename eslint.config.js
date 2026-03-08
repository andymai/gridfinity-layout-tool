import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { fixupPluginRules } from '@eslint/compat'
import i18next from 'eslint-plugin-i18next'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'e2e', 'scripts', 'benchmarks', 'playwright.config.ts', 'playwright-ct.config.ts', 'playwright', '**/*.visual.tsx']),
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
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
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

      // Accessibility (warn to fix incrementally)
      'jsx-a11y/click-events-have-key-events': 'warn',
      'jsx-a11y/no-static-element-interactions': 'warn',
      'jsx-a11y/no-noninteractive-element-interactions': 'warn',
      'jsx-a11y/no-autofocus': 'warn',
      'jsx-a11y/interactive-supports-focus': 'warn',

      // React anti-patterns
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',

      // General code quality
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],

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
          ],
        },
        callees: {
          exclude: ['t', 'console.log', 'console.warn', 'console.error', 'Error', 'TypeError'],
        },
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
    },
  },
  // i18n locale files: no i18n rule needed
  {
    files: ['**/i18n/**/*.{ts,tsx}'],
    rules: {
      'i18next/no-literal-string': 'off',
    },
  },
  // Scripts: no i18n rule needed
  {
    files: ['scripts/**/*.{ts,tsx}'],
    rules: {
      'i18next/no-literal-string': 'off',
    },
  },
])
