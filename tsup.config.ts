import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    next: 'src/integrations/next.ts',
    react: 'src/integrations/react.tsx',
  },
  external: ['react'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: false,
  treeshake: true,
  target: 'es2022',
  outExtension: ({ format }) => ({ js: format === 'cjs' ? '.cjs' : '.js' }),
});
