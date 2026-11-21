import { fileURLToPath } from 'node:url';

// The packages are linked from ../ and ../../ts, so the bundler's root is the repo root.
export default { turbopack: { root: fileURLToPath(new URL('../..', import.meta.url)) } };
