import eslint from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import { globalIgnores } from 'eslint/config';

export default [
  eslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser,
      globals: {
        Response: 'readonly',
      },
    },
    plugins: {
      '@next/next': nextPlugin,
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
    },
  },
  globalIgnores(['.next/**', 'next-env.d.ts', 'node_modules/**']),
];
