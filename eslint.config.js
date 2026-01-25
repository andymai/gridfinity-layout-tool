import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import i18next from 'eslint-plugin-i18next'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.strict,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      i18next,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
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

      // React anti-patterns
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

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
  // Test files: relax TypeScript strictness and disable i18n rule
  {
    files: ['**/*.test.{ts,tsx}', '**/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
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
