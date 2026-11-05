// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * packages/core is plain code with no network (docs/architecture.md, section 3).
 * These imports would let it reach Firestore, a browser or Claude directly.
 */
export const CORE_BANNED_IMPORTS = [
  'firebase',
  'firebase/*',
  '@firebase/*',
  'firebase-admin',
  'firebase-admin/*',
  'playwright',
  'playwright/*',
  'playwright-core',
  'playwright-core/*',
  '@playwright/*',
  '@anthropic-ai/sdk',
  '@anthropic-ai/sdk/*',
  'node:http',
  'node:https',
  'node:net',
  'node:tls',
  'node:dgram',
  'http',
  'https',
  'net',
  'tls',
  'dgram',
];

export default defineConfig(
  {
    ignores: ['**/node_modules/**', '**/coverage/**', 'design/**', '.firebase/**', '**/dist/**'],
  },
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: ['packages/core/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: CORE_BANNED_IMPORTS,
              message:
                'packages/core has no network code. Put this behind a port in packages/core/ports.ts and implement it in packages/adapters.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'packages/core has no network code. Use a port.' },
        { name: 'WebSocket', message: 'packages/core has no network code. Use a port.' },
        { name: 'XMLHttpRequest', message: 'packages/core has no network code. Use a port.' },
      ],
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
