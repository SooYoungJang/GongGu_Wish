import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';

const platformGlobals = {
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
  prompt: 'readonly',
  requestAnimationFrame: 'readonly',
  cancelAnimationFrame: 'readonly',
};

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: platformGlobals,
    },
    rules: {
      'react-hooks/exhaustive-deps': 'off',
      // TypeScript already handles undefined-variable checks via tsc;
      // enabling no-undef on TS files produces false positives for DOM
      // types like HTMLDivElement that come from lib.dom.d.ts.
      'no-undef': 'off',
      'no-unused-vars': 'warn',
      'no-redeclare': 'off',
    },
  },
  {
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
        JSX: 'readonly',
      },
    },
  },
  {
    ignores: ['node_modules/', 'dist/', 'coverage/', 'src/**/*.stories.tsx', 'src/**/*.stories.ts'],
    // .storybook config and other non-src files that aren't in tsconfig
  },
];
