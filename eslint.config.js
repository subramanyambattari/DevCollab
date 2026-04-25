import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooks from 'eslint-plugin-react-hooks';

const recommendedRules = tsPlugin.configs?.recommended?.rules ?? {};

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**']
  },
  {
    files: ['client/src/**/*.{ts,tsx}', 'server/src/**/*.ts', 'server/tests/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooks
    },
    rules: {
      ...recommendedRules,
      '@typescript-eslint/no-explicit-any': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
];
