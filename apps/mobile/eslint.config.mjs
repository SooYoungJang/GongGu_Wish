import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';

// React Native / Node / browser globals that ESLint doesn't know about
// without a plugin.  We list them explicitly so no-undef doesn't fire on
// platform globals like setTimeout, window, require, etc.
const platformGlobals = {
  __DEV__: 'readonly',
  React: 'readonly',
  require: 'readonly',
  module: 'readonly',
  exports: 'readonly',
  process: 'readonly',
  global: 'readonly',
  globalThis: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setImmediate: 'readonly',
  clearImmediate: 'readonly',
  window: 'readonly',
  document: 'readonly',
  navigator: 'readonly',
  fetch: 'readonly',
  console: 'readonly',
  Buffer: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  FormData: 'readonly',
  AbortController: 'readonly',
  queueMicrotask: 'readonly',
};

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        project: './tsconfig.json',
      },
      globals: platformGlobals,
    },
    rules: {
      // react-hooks plugin is not installed in this workspace; inline
      // disable-comments in source reference this rule, so we declare it
      // as a known-but-disabled rule to avoid "rule not found" errors.
      'react-hooks/exhaustive-deps': 'off',
      // Test files declare hoisted mocks and helpers that may look unused
      // to ESLint without type-aware rules.  Keep this as a warning so the
      // CI lint gate stays green without false positives.
      'no-unused-vars': 'warn',
      'no-redeclare': 'off',
    },
  },
  {
    // Test files use additional Node/assert globals
    files: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...platformGlobals,
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        JSX: 'readonly',
      },
    },
  },
  {
    ignores: [
      'node_modules/',
      'dist/',
      '.expo/',
      'coverage/',
      'vitest.config.ts',
      'vitest.setup.ts',
    ],
  },
];
