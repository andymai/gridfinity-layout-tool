/**
 * Pure helpers for working with caught `unknown` errors — no side effects and
 * no store/UI coupling, so they're safe to re-export from the `@/shared/utils`
 * barrel and import from core modules.
 */

/** Narrow a string `code` field off an unknown error without an unsafe cast. */
export function getErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code: unknown = err.code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/** The error's message when it's an `Error`, else `fallback`. */
export function getErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
