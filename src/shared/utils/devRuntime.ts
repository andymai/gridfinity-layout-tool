/**
 * True in local dev and E2E runs against the dev server, false under Vitest
 * so unit tests can still exercise the gated logic.
 */
export function isDevRuntime(): boolean {
  return import.meta.env.DEV && !import.meta.env.VITEST;
}
