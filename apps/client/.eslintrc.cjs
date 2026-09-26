module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react-hooks', 'react-refresh'],
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:react-hooks/recommended'],
  env: { browser: true, node: true, es2022: true },
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
  overrides: [
    {
      // shadcn/ui co-loca componentes con variantes/hooks por diseño.
      files: ['src/components/ui/**/*.{ts,tsx}'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
    {
      // Proveedores de contexto: exportan el Provider y su hook `useX` juntos a propósito.
      files: ['src/auth/*Context.tsx', 'src/components/ConfirmDialog.tsx', 'src/components/crm/CrmProfiles.tsx', 'src/components/team/MemberAvatar.tsx'],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
  ],
};
