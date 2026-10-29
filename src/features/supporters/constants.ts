/**
 * Client mirrors of the supporter text caps.
 *
 * KEEP IN LOCKSTEP with `MAX_DISPLAY_NAME_LENGTH` / `MAX_MESSAGE_LENGTH` in
 * `api/lib/supporters.ts`. The server is the authority — it truncates and
 * content-filters every write regardless of what arrives — so a drift here
 * costs a confusing edit (typing past a limit that silently trims), never a
 * bypass. The client can't import from `api/`, hence the duplication.
 */

/** Ko-fi allows long names; the tape texture wraps but can't absorb an essay. */
export const MAX_DISPLAY_NAME_LENGTH = 32;

/** Ko-fi messages stop at 280 characters, so a supporter's words arrive whole. */
export const MAX_MESSAGE_LENGTH = 280;

/**
 * KEEP IN LOCKSTEP with `SUPPORTER_DEPARTMENT_COUNT` in `api/lib/supporters.ts`.
 * A drift here rejects the live list as malformed and falls back to the bundle.
 */
export const SUPPORTER_DEPARTMENT_COUNT = 8;

export function isSupporterDepartment(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < SUPPORTER_DEPARTMENT_COUNT
  );
}
