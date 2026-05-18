import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

const pkg = (name, entry) => ({
  input: path.join(root, name, entry),
  output: {
    file: path.join(root, name, 'dist', `${name === 'analytics-core' ? 'quasar-core' : 'quasar-replay'}.mjs`),
    format: 'es',
    sourcemap: true,
  },
  treeshake: { moduleSideEffects: false },
});

export default [
  pkg('analytics-core', 'src/index.js'),
  pkg('analytics-replay', 'src/index.js'),
];
