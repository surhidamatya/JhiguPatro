// The packages are linked from ../ and ../../ts: the bundler may read them, and they are not
// pre-bundled differently on the server.
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  telemetry: false,
});
