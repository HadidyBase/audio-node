import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node22',
  esbuildOptions(opts) {
    opts.legalComments = 'none';
    opts.platform = 'node';
  },
});
