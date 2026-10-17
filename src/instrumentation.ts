export async function register() {
  // Intentionally do not open PGlite here.
  // Next may run instrumentation in multiple processes; concurrent PGlite
  // opens on the same data directory cause WASM "Aborted()" crashes.
  // The DB is initialised lazily on first query / via ensureDbReady().
}
